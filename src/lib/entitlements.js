import { randomUUID } from "crypto";
import prisma from "@/lib/db";
import { getPlanDefinition, getPlanLimit, getUsageWindowConfig, isDiscontinuedPlan, normalizeBillingInterval } from "@/lib/plans";
import { getModelFamily, isModelAllowedForPlan } from "@/lib/models";
import { buildFreeSubscriptionData } from "@/lib/subscription-expiry";

const STACKABLE_FAMILIES = new Set(["gpt", "claude", "grok"]);

const LEGACY_ENTITLEMENT_LIMITS = {
  gpt_chat: { "3day": 8000000, weekly: 20000000, monthly: 40000000 },
  gpt_code: { "3day": 40000000, weekly: 70000000, monthly: 90000000 },
  claude_code: { "3day": 40000000, weekly: 100000000, monthly: 160000000 },
  grok_code: { "3day": 40000000, weekly: 90000000, monthly: 135000000 },
};

function toDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function toIso(value) {
  return toDate(value).toISOString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function intervalDays(interval) {
  const normalized = normalizeBillingInterval(interval);
  if (normalized === "3day") return 3;
  if (normalized === "weekly") return 7;
  return 30;
}

function intervalLimitKey(interval) {
  const normalized = normalizeBillingInterval(interval);
  if (normalized === "3day") return "threeDay";
  if (normalized === "weekly") return "weekly";
  return "monthly";
}

function getLegacyLimit(plan, billingInterval) {
  return LEGACY_ENTITLEMENT_LIMITS[plan]?.[normalizeBillingInterval(billingInterval)] || null;
}

function getPlanDefaultLimit(plan, billingInterval) {
  const definition = getPlanDefinition(plan);
  return definition?.limits?.[intervalLimitKey(billingInterval)] || 0;
}

export function getPlanFamily(plan) {
  return getPlanDefinition(plan)?.family || null;
}

export function isStackablePlan(plan) {
  return STACKABLE_FAMILIES.has(getPlanFamily(plan));
}

export async function ensureEntitlementSchema() {
  // Schema managed via Prisma migrations
}

function deriveStatus(row, now = new Date()) {
  if (row.status === "cancelled") return "cancelled";
  const startsAt = toDate(row.startsAt);
  const expiresAt = toDate(row.expiresAt);
  if (expiresAt <= now) return "expired";
  if (startsAt > now) return "queued";
  return "active";
}

function normalizeRow(row, now = new Date()) {
  return {
    id: row.id,
    userId: row.userId,
    plan: row.plan,
    family: row.family || getPlanFamily(row.plan),
    billingInterval: normalizeBillingInterval(row.billingInterval),
    storedStatus: row.status,
    status: deriveStatus(row, now),
    startsAt: toIso(row.startsAt),
    expiresAt: toIso(row.expiresAt),
    activatedAt: row.activatedAt ? toIso(row.activatedAt) : null,
    limitUnits: row.limitUnits == null ? null : Number(row.limitUnits),
    sourceRequestId: row.sourceRequestId || null,
    createdAt: row.createdAt ? toIso(row.createdAt) : null,
    updatedAt: row.updatedAt ? toIso(row.updatedAt) : null,
  };
}

async function fetchRawEntitlements(userId) {
  await ensureEntitlementSchema();
  return prisma.$queryRaw`SELECT * FROM "PlanEntitlement" WHERE "userId" = ${userId} ORDER BY "startsAt" ASC, "createdAt" ASC`;
}

async function backfillLegacyUsage({ userId, packageId, family, startsAt, expiresAt }) {
  let likePattern = null;
  if (family === "gpt") likePattern = "gpt-%";
  if (family === "claude") likePattern = "claude-%";
  if (family === "grok") likePattern = "grok-%";
  if (!likePattern) return;
  await prisma.$executeRaw`UPDATE "TokenUsage" SET "packageId" = ${packageId} WHERE "userId" = ${userId} AND "packageId" IS NULL AND "timestamp" >= ${toIso(startsAt)} AND "timestamp" < ${toIso(expiresAt)} AND "modelUsed" LIKE ${likePattern}`.catch(() => null);
}

async function insertEntitlement({ userId, plan, billingInterval, startsAt, expiresAt, sourceRequestId = null, status = "active", limitUnits = null }) {
  await ensureEntitlementSchema();
  const family = getPlanFamily(plan);
  if (!STACKABLE_FAMILIES.has(family)) return null;

  const id = randomUUID();
  const now = new Date();
  const activatedAt = toDate(startsAt) <= now ? now : null;
  const snapshotLimit = Number.isFinite(Number(limitUnits)) ? Math.round(Number(limitUnits)) : getPlanDefaultLimit(plan, billingInterval);
  await prisma.$executeRaw`INSERT INTO "PlanEntitlement" ("id", "userId", "plan", "family", "billingInterval", "status", "startsAt", "expiresAt", "activatedAt", "sourceRequestId", "limitUnits", "createdAt", "updatedAt") VALUES (${id}, ${userId}, ${plan}, ${family}, ${normalizeBillingInterval(billingInterval)}, ${status}, ${toIso(startsAt)}, ${toIso(expiresAt)}, ${activatedAt ? activatedAt.toISOString() : null}, ${sourceRequestId}, ${snapshotLimit}, ${now.toISOString()}, ${now.toISOString()})`;
  return normalizeRow({ id, userId, plan, family, billingInterval, status, startsAt, expiresAt, activatedAt, limitUnits: snapshotLimit, sourceRequestId, createdAt: now, updatedAt: now });
}

async function seedLegacyEntitlement(userId, subscription) {
  if (!subscription || isDiscontinuedPlan(subscription.plan) || !isStackablePlan(subscription.plan)) return null;
  const startsAt = subscription.updatedAt || subscription.createdAt || new Date();
  const intervalExpiry = addDays(toDate(startsAt), intervalDays(subscription.billingInterval));
  const requestedExpiry = subscription.expiryDate ? toDate(subscription.expiryDate) : intervalExpiry;
  const expiresAt = requestedExpiry > intervalExpiry ? intervalExpiry : requestedExpiry;
  const status = subscription.status === "active" && toDate(expiresAt) > new Date() ? "active" : "expired";
  const entitlement = await insertEntitlement({
    userId,
    plan: subscription.plan,
    billingInterval: subscription.billingInterval,
    startsAt,
    expiresAt,
    sourceRequestId: "legacy-subscription",
    status,
    limitUnits: getLegacyLimit(subscription.plan, subscription.billingInterval) || getPlanDefaultLimit(subscription.plan, subscription.billingInterval),
  });
  if (entitlement) await backfillLegacyUsage({ userId, packageId: entitlement.id, family: entitlement.family, startsAt, expiresAt });
  return entitlement;
}

export async function getUserEntitlements(userId, subscription = null) {
  let rows = await fetchRawEntitlements(userId);
  if (rows.length === 0 && subscription) {
    await seedLegacyEntitlement(userId, subscription);
    rows = await fetchRawEntitlements(userId);
  }
  const now = new Date();
  return rows.map((row) => normalizeRow(row, now));
}

export function getActiveEntitlements(entitlements, now = new Date()) {
  return (entitlements || []).filter((item) => deriveStatus(item, now) === "active");
}

export function getActiveEntitlementForModel(entitlements, model, now = new Date()) {
  const family = getModelFamily(model);
  if (!family) return null;
  return getActiveEntitlements(entitlements, now)
    .filter((item) => item.family === family)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0] || null;
}

export function getEntitlementLimits(entitlement) {
  if (!entitlement) return null;
  const window = getUsageWindowConfig(entitlement.billingInterval);
  const planDef = getPlanDefinition(entitlement.plan);
  const limit = entitlement.limitUnits == null ? getPlanLimit(entitlement.plan, entitlement.billingInterval) : Number(entitlement.limitUnits || 0);
  return {
    billingInterval: entitlement.billingInterval,
    family: entitlement.family,
    packageId: entitlement.id,
    plan: entitlement.plan,
    windowKey: window.key,
    windowLabel: `${planDef?.shortLabel || planDef?.label || entitlement.plan} ${window.label}`,
    windowMs: window.ms,
    windowStart: new Date(entitlement.startsAt),
    limit,
    threeDay: entitlement.billingInterval === "3day" ? limit : null,
    weekly: entitlement.billingInterval === "weekly" ? limit : null,
    monthly: entitlement.billingInterval === "monthly" ? limit : null,
  };
}

export async function resolveEntitlementForModel({ userId, subscription, model, fallbackPlan }) {
  const entitlements = await getUserEntitlements(userId, subscription);
  const entitlement = getActiveEntitlementForModel(entitlements, model);
  if (entitlement && isModelAllowedForPlan(model, entitlement.plan)) {
    return { entitlements, entitlement, plan: entitlement.plan, limits: getEntitlementLimits(entitlement) };
  }
  return { entitlements, entitlement: null, plan: fallbackPlan, limits: null };
}

export async function activatePlanEntitlement({ userId, plan, billingInterval, subscription = null, sourceRequestId = null }) {
  if (!isStackablePlan(plan)) return null;
  await getUserEntitlements(userId, subscription);
  const family = getPlanFamily(plan);
  const now = new Date();
  const existingFamilyRows = (await fetchRawEntitlements(userId))
    .map((row) => normalizeRow(row, now))
    .filter((row) => row.family === family && row.status !== "cancelled" && toDate(row.expiresAt) > now);
  const latestFamilyExpiry = existingFamilyRows.reduce((latest, row) => {
    const expiresAt = toDate(row.expiresAt);
    return expiresAt > latest ? expiresAt : latest;
  }, now);
  const startsAt = latestFamilyExpiry > now ? latestFamilyExpiry : now;
  const expiresAt = addDays(startsAt, intervalDays(billingInterval));
  const status = startsAt > now ? "queued" : "active";
  return insertEntitlement({ userId, plan, billingInterval, startsAt, expiresAt, sourceRequestId, status });
}

export async function syncSubscriptionSummaryFromEntitlements({ userId, preferredEntitlement = null }) {
  const entitlements = await getUserEntitlements(userId, null);
  const now = new Date();
  const currentOrFuture = entitlements.filter((item) => !isDiscontinuedPlan(item.plan) && item.status !== "cancelled" && toDate(item.expiresAt) > now);
  if (currentOrFuture.length === 0) {
    return prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...buildFreeSubscriptionData(now) },
      update: buildFreeSubscriptionData(now),
    });
  }

  let maxExpiry = currentOrFuture.reduce((latest, item) => {
    const expiresAt = toDate(item.expiresAt);
    return expiresAt > latest ? expiresAt : latest;
  }, now);
  const existingSubscription = await prisma.subscription.findUnique({ where: { userId } }).catch(() => null);
  const existingExpiry = existingSubscription?.status === "active" && existingSubscription.expiryDate ? toDate(existingSubscription.expiryDate, null) : null;
  if (existingExpiry && existingExpiry > maxExpiry) maxExpiry = existingExpiry;
  const representative = preferredEntitlement || currentOrFuture
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.startsAt).getTime() - new Date(a.createdAt || a.startsAt).getTime())[0];
  const apiAccessEnabled = currentOrFuture.some((item) => getPlanDefinition(item.plan)?.apiAccess === true);

  return prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: representative.plan,
      billingInterval: representative.billingInterval,
      status: "active",
      expiryDate: maxExpiry,
      apiAccessEnabled,
    },
    update: {
      plan: representative.plan,
      billingInterval: representative.billingInterval,
      status: "active",
      expiryDate: maxExpiry,
      apiAccessEnabled,
    },
  });
}

export async function getEntitlementUsageUnits({ userId, entitlement }) {
  if (!entitlement?.id) return 0;
  await ensureEntitlementSchema();
  const rows = await prisma.$queryRaw`SELECT COALESCE(SUM("totalTokens"), 0) as total FROM "TokenUsage" WHERE "userId" = ${userId} AND "packageId" = ${entitlement.id} AND "timestamp" >= ${toIso(entitlement.startsAt)} AND "timestamp" < ${toIso(entitlement.expiresAt)}`;
  return Number(rows?.[0]?.total || 0);
}

export async function buildEntitlementUsageWindows({ userId, entitlements }) {
  const summaries = [];
  for (const entitlement of entitlements || []) {
    if (isDiscontinuedPlan(entitlement.plan)) continue;
    if (!["active", "queued"].includes(entitlement.status)) continue;
    const limits = getEntitlementLimits(entitlement);
    if (!limits) continue;
    const used = entitlement.status === "active" ? await getEntitlementUsageUnits({ userId, entitlement }) : 0;
    const percent = limits.limit ? Math.min(Math.round((used / limits.limit) * 100), 100) : 0;
    summaries.push({
      key: entitlement.id,
      packageId: entitlement.id,
      plan: entitlement.plan,
      family: entitlement.family,
      billingInterval: entitlement.billingInterval,
      label: limits.windowLabel,
      used,
      limit: limits.limit,
      percent,
      status: entitlement.status === "queued" ? "Queued" : percent >= 100 ? "Full" : percent >= 90 ? "Almost full" : percent >= 75 ? "Nearly full" : "Normal",
      startsAt: entitlement.startsAt,
      resetAt: entitlement.expiresAt,
    });
  }
  return summaries;
}

export async function addActiveEntitlementLimitUnits({ userId, family, amount, subscription = null }) {
  const extra = Math.max(0, Math.round(Number(amount) || 0));
  if (!userId || !family || extra <= 0) return null;
  const entitlements = await getUserEntitlements(userId, subscription);
  const now = new Date();
  const active = getActiveEntitlements(entitlements, now)
    .filter((item) => item.family === family)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0];
  if (!active) return null;
  const currentLimit = getEntitlementLimits(active)?.limit || 0;
  const nextLimit = currentLimit + extra;
  await prisma.$executeRaw`UPDATE "PlanEntitlement" SET "limitUnits" = ${nextLimit}, "updatedAt" = ${new Date().toISOString()} WHERE "id" = ${active.id}`;
  return { ...active, limitUnits: nextLimit };
}
