import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

const planPrices = { free: 0, student: 29000, starter: 49000, pro: 89000, developer: 149000 };

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      subsByPlan,
      totalTokensRow,
      topUsers,
      newUsersThisWeek,
      activeUsersToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.groupBy({ by: ["plan", "status"], _count: true }),
      prisma.tokenUsage.aggregate({ _sum: { totalTokens: true } }),
      prisma.tokenUsage.groupBy({ by: ["userId"], _sum: { totalTokens: true }, orderBy: { _sum: { totalTokens: "desc" } }, take: 5 }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.tokenUsage.groupBy({ by: ["userId"], where: { timestamp: { gte: todayStart } }, _count: true }),
    ]);

    const totalTokens = totalTokensRow._sum.totalTokens || 0;
    const estimatedCost = (totalTokens / 1_000_000) * 0.06 * 18000;

    let estimatedRevenue = 0;
    let activeSubsByPlan = {};
    for (const s of subsByPlan) {
      const price = planPrices[s.plan] || 0;
      if (s.status === "active") {
        estimatedRevenue += s._count * price;
        activeSubsByPlan[s.plan] = (activeSubsByPlan[s.plan] || 0) + s._count;
      }
    }

    const profitMargin = estimatedRevenue > 0
      ? Math.round(((estimatedRevenue - estimatedCost) / estimatedRevenue) * 10000) / 100
      : 0;

    const topUserIds = topUsers.map((u) => u.userId);
    const topUserRows = topUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: topUserIds } }, include: { subscription: true } })
      : [];
    const topUsersById = Object.fromEntries(topUserRows.map((u) => [u.id, u]));

    return NextResponse.json({
      totalUsers,
      activeSubscriptions: activeSubsByPlan,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      estimatedRevenue,
      profitMargin,
      topUsers: topUsers.map((u) => ({
        id: u.userId,
        name: topUsersById[u.userId]?.name || null,
        email: topUsersById[u.userId]?.email || "Unknown",
        plan: topUsersById[u.userId]?.subscription?.plan || "free",
        totalTokens: u._sum.totalTokens,
      })),
      newUsersThisWeek,
      activeUsersToday: activeUsersToday.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
