import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, isEmailVerificationRequired } from "@/lib/auth";
import { calculateClaudeOfficialCostUsdMicros, getManagedUsdIdrRate, idrToUsdMicros, isClaudeApiPlan, usdMicrosToIdr } from "@/lib/claude-payg";
import { getPlanDefinition, getPlanLimit, getUsageWindowConfig, getUsageWindowStart, normalizeBillingInterval } from "@/lib/plans";
import { buildEntitlementUsageWindows, getUserEntitlements } from "@/lib/entitlements";
import { expireSubscriptionIfNeeded } from "@/lib/subscription-expiry";

export function getActivePlan(subscription) {
  if (!subscription) return "free";
  if (subscription?.plan === "free" && !isEmailVerificationRequired()) return "free";
  if (subscription.status !== "active") return "inactive";
  if (subscription.expiryDate && new Date() > new Date(subscription.expiryDate)) return "inactive";
  return getPlanDefinition(subscription.plan) ? subscription.plan : "inactive";
}

export function getEffectiveLimits(subscription) {
  const activePlan = getActivePlan(subscription);
  const interval = normalizeBillingInterval(subscription?.billingInterval);
  const window = getUsageWindowConfig(interval);
  const limit = getPlanLimit(activePlan, interval, subscription);

  return {
    billingInterval: interval,
    windowKey: window.key,
    windowLabel: window.label,
    windowMs: window.ms,
    windowStart: getUsageWindowStart(subscription, { windowMs: window.ms }),
    limit,
    threeDay: interval === "3day" ? limit : null,
    weekly: interval === "weekly" ? limit : null,
    monthly: interval === "monthly" ? limit : null,
  };
}

function toUsageWindow(key, label, used, limit, resetAt) {
  const percent = limit ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  let status = "Normal";

  if (percent >= 100) {
    status = "Full";
  } else if (percent >= 90) {
    status = "Almost full";
  } else if (percent >= 75) {
    status = "Nearly full";
  }

  return { key, label, used, limit, percent, status, resetAt };
}

export async function GET(req) {
  try {
    let user = await authenticateUser(req);
    const userId = user.id;

    // Check if subscription has expired
    let subscription = user.subscription;
    subscription = await expireSubscriptionIfNeeded(subscription);

    if (!isEmailVerificationRequired() && subscription?.plan === "free" && (subscription.status !== "active" || !user.emailVerifiedAt)) {
      const verifiedAt = user.emailVerifiedAt || new Date();
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: verifiedAt } }),
        prisma.subscription.updateMany({ where: { userId, plan: "free", status: "inactive" }, data: { status: "active" } }),
      ]);
      user = { ...user, emailVerifiedAt: verifiedAt };
      subscription = { ...subscription, status: "active" };
    }

    const plan = getActivePlan(subscription);
    const limits = getEffectiveLimits(subscription);

    const now = new Date();
    const monthlyWindowMs = getUsageWindowConfig("monthly").ms;
    const planWindowStart = limits.windowStart ? new Date(limits.windowStart) : getUsageWindowStart(subscription, limits, now);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [planUsage] = await Promise.all([
      prisma.tokenUsage.aggregate({
        where: { userId, timestamp: { gte: planWindowStart } },
        _sum: { totalTokens: true },
      }),
    ]);

    const totalPlanUsage = planUsage._sum.totalTokens || 0;
    const entitlements = await getUserEntitlements(userId, subscription);
    const packageSummaries = await buildEntitlementUsageWindows({ userId, entitlements });
    const activePackageWindows = packageSummaries.filter((item) => item.status !== "Queued");
    const usdIdrRate = await getManagedUsdIdrRate();
    const apiCreditBalanceUsdMicros = (subscription?.apiCreditBalanceUsdMicros || 0) + idrToUsdMicros(subscription?.apiCreditBalanceRp || 0, usdIdrRate);
    const apiCreditLedger = await prisma.apiCreditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }).catch(() => []);
    const apiUsageRows = await prisma.apiCreditLedger.findMany({
        where: { userId, type: "usage", createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }).catch(() => []);
    const cashoutRequests = await prisma.cashoutRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).catch(() => []);
    const apiKeyCount = await prisma.apiKey.count({ where: { userId } }).catch(() => 0);
    const hasApiWorkspace = subscription?.apiAccessEnabled === true || isClaudeApiPlan(subscription?.plan) || apiCreditBalanceUsdMicros > 0 || apiCreditLedger.length > 0 || apiKeyCount > 0;
    const publicApiCreditLedger = apiCreditLedger.map(({ providerPool, fallbackUsed, ...entry }) => entry);
    const apiModelMap = new Map();
    let apiInputTokens = 0;
    let apiOutputTokens = 0;
    let apiActualUsdMicros = 0;
    let apiStandardUsdMicros = 0;
    for (const row of apiUsageRows) {
      const model = row.modelUsed || "unknown";
      const input = row.promptTokens || 0;
      const output = row.completionTokens || 0;
      const actual = Math.abs(row.amountUsdMicros || 0);
      const standard = calculateClaudeOfficialCostUsdMicros({ model, promptTokens: input, completionTokens: output });
      apiInputTokens += input;
      apiOutputTokens += output;
      apiActualUsdMicros += actual;
      apiStandardUsdMicros += standard;
      const current = apiModelMap.get(model) || { model, requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, actualUsdMicros: 0, standardUsdMicros: 0 };
      current.requests += 1;
      current.inputTokens += input;
      current.outputTokens += output;
      current.totalTokens += input + output;
      current.actualUsdMicros += actual;
      current.standardUsdMicros += standard;
      apiModelMap.set(model, current);
    }

    const nextPlanReset = new Date(planWindowStart.getTime() + (limits.windowMs || monthlyWindowMs)).toISOString();
    const fallbackUsageWindow = toUsageWindow(limits.windowKey || "monthly", limits.windowLabel || "Monthly", totalPlanUsage, limits.limit, nextPlanReset);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      subscription,
      plan,
      usage: {
        windows: activePackageWindows.length > 0 ? activePackageWindows : [fallbackUsageWindow],
        packages: packageSummaries,
        apiCreditBalanceRp: usdMicrosToIdr(apiCreditBalanceUsdMicros, usdIdrRate),
        apiCreditBalanceUsdMicros,
        apiCreditBalanceUsd: apiCreditBalanceUsdMicros / 1_000_000,
        usdIdrRate,
        apiCreditLedger: publicApiCreditLedger,
        cashoutRequests,
        hasApiWorkspace,
        apiKeyCount,
        apiUsageSummary: {
          range: "Last 30 Days",
          totalRequests: apiUsageRows.length,
          inputTokens: apiInputTokens,
          outputTokens: apiOutputTokens,
          totalTokens: apiInputTokens + apiOutputTokens,
          actualUsdMicros: apiActualUsdMicros,
          standardUsdMicros: apiStandardUsdMicros,
          modelDistribution: Array.from(apiModelMap.values()).sort((a, b) => b.actualUsdMicros - a.actualUsdMicros),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Auth Me Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
