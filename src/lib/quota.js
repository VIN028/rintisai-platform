import prisma from "@/lib/db";
import { calculateUsageUnits, estimateTokens } from "@/lib/security";
import { ensureEntitlementSchema } from "@/lib/entitlements";
import { randomUUID } from "crypto";

const userLocks = new Map();

async function withUserLock(userId, fn) {
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  userLocks.set(userId, previous.then(() => current));

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === current) userLocks.delete(userId);
  }
}

export function estimateUsageUnits({ promptText, model, maxTokens, reasoningEffort, plan = null }) {
  return calculateUsageUnits({
    promptTokens: estimateTokens(promptText),
    completionTokens: maxTokens,
    model,
    plan,
    reasoningEffort,
  });
}

export function getBillableReasoningEffort({ model, plan, source, requestedReasoningEffort }) {
  if (!requestedReasoningEffort || model?.startsWith("claude-")) return null;
  if (requestedReasoningEffort === "xhigh") return "high";
  if (requestedReasoningEffort === "high") return "medium";
  return requestedReasoningEffort;
}

export async function reserveUsage({ userId, model, source, apiKeyId = null, estimatedPromptTokens, estimatedTotalTokens, limits, plan, packageId = null }) {
  return withUserLock(userId, async () => {
    if (packageId) await ensureEntitlementSchema();
    const now = new Date();
    const windowMs = limits?.windowMs || 30 * 24 * 60 * 60 * 1000;
    const configuredWindowStart = limits?.windowStart ? new Date(limits.windowStart) : null;
    const windowStart = configuredWindowStart && !Number.isNaN(configuredWindowStart.getTime())
      ? configuredWindowStart
      : new Date(now.getTime() - windowMs);
    const total = packageId
      ? Number((await prisma.$queryRaw`SELECT COALESCE(SUM("totalTokens"), 0) as total FROM "TokenUsage" WHERE "userId" = ${userId} AND "packageId" = ${packageId} AND "timestamp" >= ${windowStart.toISOString()}`)?.[0]?.total || 0)
      : (await prisma.tokenUsage.aggregate({ where: { userId, timestamp: { gte: windowStart } }, _sum: { totalTokens: true } }))._sum.totalTokens || 0;
    const limit = Number(limits?.limit || 0);

    if (limit > 0 && total + estimatedTotalTokens > limit) {
      return { error: `Your ${limits?.windowLabel || "plan"} usage limit has been reached.`, status: 429 };
    }

    if (packageId) {
      const id = randomUUID();
      await prisma.$executeRaw`INSERT INTO "TokenUsage" ("id", "userId", "timestamp", "modelUsed", "promptTokens", "completionTokens", "totalTokens", "source", "apiKeyId", "packageId") VALUES (${id}, ${userId}, ${now.toISOString()}, ${model}, ${estimatedPromptTokens}, ${0}, ${estimatedTotalTokens}, ${source}, ${apiKeyId}, ${packageId})`;
      return { reservation: { id } };
    }

    const reservation = await prisma.tokenUsage.create({
      data: {
        userId,
        modelUsed: model,
        promptTokens: estimatedPromptTokens,
        completionTokens: 0,
        totalTokens: estimatedTotalTokens,
        source,
        apiKeyId,
      },
    });

    return { reservation };
  });
}

export function finalizeUsageReservation({ reservationId, promptTokens, completionTokens, model, reasoningEffort, providerPool = null, fallbackUsed = false, plan = null }) {
  const totalTokens = calculateUsageUnits({ promptTokens, completionTokens, model, plan, reasoningEffort });
  return prisma.tokenUsage.update({
    where: { id: reservationId },
    data: { promptTokens, completionTokens, totalTokens, providerPool, fallbackUsed },
  });
}

export async function cancelUsageReservation(reservationId) {
  if (!reservationId) return;
  await prisma.tokenUsage.delete({ where: { id: reservationId } }).catch(() => {});
}
