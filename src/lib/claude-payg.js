import prisma from "@/lib/db";
import { API_PAYG_PRICING, DEFAULT_USD_IDR_RATE } from "@/lib/api-products";

export const CLAUDE_API_PLAN = "claude_api";
export const API_PLANS = new Set(["claude_api", "api_claude", "api_gpt", "api_grok"]);
const FX_SETTING_KEY = "usd_idr_managed_rate";
const FX_REFRESH_MS = 24 * 60 * 60 * 1000;
const FX_BUFFER_PERCENT = 2;
const FX_MAX_AUTO_CHANGE_PERCENT = 10;

export const CLAUDE_PAYG_PRICING = API_PAYG_PRICING;

export const CLAUDE_API_TOPUPS = {
  18500: 18500,
  25000: 25000,
  50000: 50000,
  100000: 100000,
  250000: 250000,
  500000: 500000,
  1000000: 1000000,
};

export function isClaudeApiPlan(plan) {
  return API_PLANS.has(plan);
}

export function isClaudePaygModel(model) {
  return Object.prototype.hasOwnProperty.call(CLAUDE_PAYG_PRICING, model);
}

export function getUsdIdrRate() {
  const value = Number(process.env.USD_IDR_RATE || process.env.NEXT_PUBLIC_USD_IDR_RATE || DEFAULT_USD_IDR_RATE);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_USD_IDR_RATE;
}

function roundUpToNearest(value, nearest = 100) {
  return Math.ceil(value / nearest) * nearest;
}

function parseStoredFx(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!Number.isFinite(Number(parsed.rate)) || Number(parsed.rate) <= 0) return null;
    return {
      rate: Math.round(Number(parsed.rate)),
      rawRate: Number(parsed.rawRate) || null,
      fetchedAt: parsed.fetchedAt || null,
      provider: parsed.provider || "unknown",
    };
  } catch {
    return null;
  }
}

async function fetchLiveUsdIdrRate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=IDR", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
    const data = await res.json();
    const rawRate = Number(data?.rates?.IDR);
    if (!Number.isFinite(rawRate) || rawRate < 10000 || rawRate > 30000) {
      throw new Error("FX provider returned an invalid USD/IDR rate.");
    }
    return { rawRate, provider: "frankfurter.app" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getManagedUsdIdrRate({ forceRefresh = false } = {}) {
  const fallbackRate = getUsdIdrRate();
  const storedRow = await prisma.setting.findUnique({ where: { key: FX_SETTING_KEY } }).catch(() => null);
  const stored = parseStoredFx(storedRow?.value);
  const storedFetchedAt = stored?.fetchedAt ? new Date(stored.fetchedAt).getTime() : 0;
  const storedFresh = storedFetchedAt && Date.now() - storedFetchedAt < FX_REFRESH_MS;

  if (stored?.rate && storedFresh && !forceRefresh) return stored.rate;

  try {
    const live = await fetchLiveUsdIdrRate();
    const bufferedRate = roundUpToNearest(live.rawRate * (1 + FX_BUFFER_PERCENT / 100));
    if (stored?.rate) {
      const percentChange = Math.abs(bufferedRate - stored.rate) / stored.rate * 100;
      if (percentChange > FX_MAX_AUTO_CHANGE_PERCENT) return stored.rate;
    }

    const payload = JSON.stringify({
      rate: bufferedRate,
      rawRate: live.rawRate,
      bufferPercent: FX_BUFFER_PERCENT,
      provider: live.provider,
      fetchedAt: new Date().toISOString(),
    });
    await prisma.setting.upsert({
      where: { key: FX_SETTING_KEY },
      create: { key: FX_SETTING_KEY, value: payload },
      update: { value: payload },
    }).catch(() => null);
    return bufferedRate;
  } catch (error) {
    console.error("Managed FX rate refresh failed:", error);
    return stored?.rate || fallbackRate;
  }
}

export function idrToUsdMicros(amountRp, fxRate = getUsdIdrRate()) {
  return Math.max(0, Math.floor((Number(amountRp) / fxRate) * 1_000_000));
}

export function usdMicrosToIdr(usdMicros, fxRate = getUsdIdrRate()) {
  return Math.max(0, Math.floor((Number(usdMicros) / 1_000_000) * fxRate));
}

export function calculateClaudePaygCostUsdMicros({ model, promptTokens = 0, completionTokens = 0 }) {
  const pricing = CLAUDE_PAYG_PRICING[model];
  if (!pricing) return null;
  const usd = ((Math.max(0, promptTokens) * pricing.inputUsdPerMillion) + (Math.max(0, completionTokens) * pricing.outputUsdPerMillion)) / 1_000_000;
  return Math.max(1, Math.ceil(usd * 1_000_000));
}

export function calculateClaudeOfficialCostUsdMicros({ model, promptTokens = 0, completionTokens = 0 }) {
  const pricing = CLAUDE_PAYG_PRICING[model];
  if (!pricing) return 0;
  const usd = ((Math.max(0, promptTokens) * pricing.officialInputUsdPerMillion) + (Math.max(0, completionTokens) * pricing.officialOutputUsdPerMillion)) / 1_000_000;
  return Math.ceil(usd * 1_000_000);
}

export async function chargeClaudeApiCredit({ userId, model, promptTokens, completionTokens, apiKeyId = null, providerPool = "kiro", fallbackUsed = false }) {
  const costUsdMicros = calculateClaudePaygCostUsdMicros({ model, promptTokens, completionTokens });
  if (!costUsdMicros) throw new Error("Unsupported Claude PAYG model.");
  const fxRate = await getManagedUsdIdrRate();

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { userId } });
    const legacyBalanceUsdMicros = subscription?.apiCreditBalanceRp ? idrToUsdMicros(subscription.apiCreditBalanceRp, fxRate) : 0;
    const currentBalance = (subscription?.apiCreditBalanceUsdMicros || 0) + legacyBalanceUsdMicros;
    if (currentBalance < costUsdMicros) {
      throw Object.assign(new Error("Insufficient API credit balance. Top up to continue."), { status: 402 });
    }

    await tx.subscription.update({
      where: { userId },
      data: { apiCreditBalanceUsdMicros: currentBalance - costUsdMicros, apiCreditBalanceRp: 0 },
    });
    await tx.apiCreditLedger.create({
      data: {
        userId,
        type: "usage",
        amountRp: -usdMicrosToIdr(costUsdMicros, fxRate),
        amountUsdMicros: -costUsdMicros,
        fxRate,
        modelUsed: model,
        promptTokens,
        completionTokens,
        apiKeyId,
        providerPool,
        fallbackUsed,
      },
    });

    return { costUsdMicros, balanceUsdMicros: currentBalance - costUsdMicros };
  });
}

export async function addClaudeApiCredit({ userId, amountRp, note = null, plan = CLAUDE_API_PLAN }) {
  const fxRate = await getManagedUsdIdrRate();
  const amountUsdMicros = idrToUsdMicros(amountRp, fxRate);
  const apiPlan = API_PLANS.has(plan) ? plan : CLAUDE_API_PLAN;
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: apiPlan,
        status: "active",
        expiryDate: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
        apiAccessEnabled: true,
        apiCreditBalanceRp: 0,
        apiCreditBalanceUsdMicros: amountUsdMicros,
      },
      update: {
        plan: apiPlan,
        status: "active",
        expiryDate: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
        apiAccessEnabled: true,
        apiCreditBalanceRp: 0,
        apiCreditBalanceUsdMicros: { increment: amountUsdMicros },
      },
    });

    await tx.apiCreditLedger.create({
      data: {
        userId,
        type: "topup",
        amountRp,
        amountUsdMicros,
        fxRate,
        note,
      },
    });

    return subscription;
  });
}
