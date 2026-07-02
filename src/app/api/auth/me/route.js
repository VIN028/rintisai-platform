import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError } from "@/lib/auth";

// Plan Limits config mapping
export const PLAN_LIMITS = {
  free: {
    rolling5h: 20000,
    weekly: 100000,
    monthly: 300000,
  },
  student: {
    rolling5h: 1500000,
    weekly: 8000000,
    monthly: 25000000,
  },
  starter: {
    rolling5h: 2500000,
    weekly: 10000000,
    monthly: 35000000,
  },
  pro: {
    rolling5h: 6000000,
    weekly: 25000000,
    monthly: 60000000,
  },
  developer: {
    rolling5h: 14000000,
    weekly: 55000000,
    monthly: 150000000,
  },
  inactive: {
    rolling5h: 0,
    weekly: 0,
    monthly: 0,
  },
};

export function getActivePlan(subscription) {
  if (!subscription || subscription.status !== "active") return "inactive";
  if (subscription.expiryDate && new Date() > new Date(subscription.expiryDate)) return "inactive";
  return PLAN_LIMITS[subscription.plan] ? subscription.plan : "inactive";
}

export function getEffectiveLimits(subscription) {
  const activePlan = getActivePlan(subscription);
  const base = PLAN_LIMITS[activePlan] || PLAN_LIMITS.inactive;

  return {
    rolling5h: subscription?.customLimit5h ?? base.rolling5h,
    weekly: subscription?.customLimitWeekly ?? base.weekly,
    monthly: subscription?.customLimitMonthly ?? base.monthly,
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

  return { key, label, percent, status, resetAt };
}

export async function GET(req) {
  try {
    const user = await authenticateUser(req);
    const userId = user.id;

    // Check if subscription has expired
    let subscription = user.subscription;
    if (subscription && new Date() > new Date(subscription.expiryDate) && subscription.status === "active") {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "expired" },
      });
    }

    const plan = getActivePlan(subscription);
    const limits = getEffectiveLimits(subscription);

    // Calculate rolling token usages
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run aggregations in DB
    const [usage5h, usage7d, usage30d] = await Promise.all([
      prisma.tokenUsage.aggregate({
        where: { userId, timestamp: { gte: fiveHoursAgo } },
        _sum: { totalTokens: true },
      }),
      prisma.tokenUsage.aggregate({
        where: { userId, timestamp: { gte: sevenDaysAgo } },
        _sum: { totalTokens: true },
      }),
      prisma.tokenUsage.aggregate({
        where: { userId, timestamp: { gte: thirtyDaysAgo } },
        _sum: { totalTokens: true },
      }),
    ]);

    const total5h = usage5h._sum.totalTokens || 0;
    const total7d = usage7d._sum.totalTokens || 0;
    const total30d = usage30d._sum.totalTokens || 0;

    // Find oldest transaction in 5 hours window to calculate next reset
    const oldest5hRecord = await prisma.tokenUsage.findFirst({
      where: { userId, timestamp: { gte: fiveHoursAgo } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    const nextReset5h = oldest5hRecord
      ? new Date(oldest5hRecord.timestamp.getTime() + 5 * 60 * 60 * 1000).toISOString()
      : null;

    // Find oldest transaction in 7 days window to calculate next reset
    const oldest7dRecord = await prisma.tokenUsage.findFirst({
      where: { userId, timestamp: { gte: sevenDaysAgo } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    const nextReset7d = oldest7dRecord
      ? new Date(oldest7dRecord.timestamp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Monthly reset: rolling 30-day window (oldest txn + 30 days, or now + 30 days)
    const oldest30dRecord = await prisma.tokenUsage.findFirst({
      where: { userId, timestamp: { gte: thirtyDaysAgo } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    const nextResetMonthly = oldest30dRecord
      ? new Date(oldest30dRecord.timestamp.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
        windows: [
          toUsageWindow("5h", "Active session", total5h, limits.rolling5h, nextReset5h),
          toUsageWindow("weekly", "Weekly", total7d, limits.weekly, nextReset7d),
          toUsageWindow("monthly", "Monthly", total30d, limits.monthly, nextResetMonthly),
        ],
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
