import prisma from "@/lib/db";
import { getPlanDefinition, isApiPlan, isDiscontinuedPlan, normalizeBillingInterval } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPlanDurationMs(plan, billingInterval = "monthly") {
  if (plan === "free") return 365 * DAY_MS;
  if (isApiPlan(plan)) return 3650 * DAY_MS;
  const interval = normalizeBillingInterval(billingInterval);
  if (interval === "3day") return 3 * DAY_MS;
  if (interval === "weekly") return 7 * DAY_MS;
  return 30 * DAY_MS;
}

export function calculatePlanExpiry({ plan, billingInterval = "monthly", from = new Date() } = {}) {
  return new Date(new Date(from).getTime() + getPlanDurationMs(plan, billingInterval));
}

export function isSubscriptionExpired(subscription, now = new Date()) {
  if (!subscription?.expiryDate) return false;
  return new Date(subscription.expiryDate) <= now;
}

export function buildFreeSubscriptionData(now = new Date()) {
  return {
    plan: "free",
    billingInterval: "monthly",
    status: "active",
    expiryDate: calculatePlanExpiry({ plan: "free", billingInterval: "monthly", from: now }),
    apiAccessEnabled: false,
    customLimit5h: null,
    customLimitWeekly: null,
    customLimitMonthly: null,
  };
}

export async function expireSubscriptionIfNeeded(subscription, now = new Date()) {
  if (!subscription) return subscription;
  const paidPlanExpired = subscription.plan !== "free" && (isDiscontinuedPlan(subscription.plan) || subscription.status === "expired" || (subscription.status === "active" && isSubscriptionExpired(subscription, now)));
  if (!paidPlanExpired) return subscription;
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: buildFreeSubscriptionData(now),
  });
  return updated;
}

function dateOnly(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

export function resolveAdminPatchExpiry({ existingSubscription, nextPlan, nextBillingInterval, requestedExpiryDate, now = new Date() } = {}) {
  const existingPlan = existingSubscription?.plan || "free";
  const existingInterval = normalizeBillingInterval(existingSubscription?.billingInterval);
  const planChanged = nextPlan !== existingPlan;
  const intervalChanged = normalizeBillingInterval(nextBillingInterval) !== existingInterval;
  const existingExpiry = existingSubscription?.expiryDate ? new Date(existingSubscription.expiryDate) : null;
  const requestedExpiry = requestedExpiryDate ? new Date(requestedExpiryDate) : null;
  const requestedIsValid = requestedExpiry && !Number.isNaN(requestedExpiry.getTime());
  const expiryUnchanged = requestedIsValid && existingExpiry && dateOnly(requestedExpiry) === dateOnly(existingExpiry);
  const nextDefinition = getPlanDefinition(nextPlan);

  if (nextDefinition && (planChanged || intervalChanged) && (!requestedIsValid || expiryUnchanged)) {
    return calculatePlanExpiry({ plan: nextPlan, billingInterval: nextBillingInterval, from: now });
  }

  if (requestedIsValid) return requestedExpiry;
  if (existingExpiry && !Number.isNaN(existingExpiry.getTime())) return existingExpiry;
  return calculatePlanExpiry({ plan: nextPlan, billingInterval: nextBillingInterval, from: now });
}

export function normalizeStatusForExpiry(status, expiryDate, now = new Date()) {
  const normalized = ["active", "inactive", "expired", "cancelled", "suspended"].includes(status) ? status : "inactive";
  if (normalized === "active" && expiryDate && new Date(expiryDate) <= now) return "expired";
  return normalized;
}

export function shouldDowngradeToFree({ plan, status, expiryDate, now = new Date() } = {}) {
  if (!plan || plan === "free") return false;
  return isDiscontinuedPlan(plan) || status === "expired" || (status === "active" && expiryDate && new Date(expiryDate) <= now);
}
