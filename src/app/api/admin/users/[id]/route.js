import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { maskApiKey } from "@/lib/security";

export async function GET(req, { params }) {
  try {
    await authenticateAdmin(req);
    const { id } = await params;

    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [user, usage5h, usage24h, usage7d, usageTotal, convos, lastActivity, upgradeRequests] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: {
          subscription: true,
          apiKeys: { select: { id: true, name: true, key: true, createdAt: true }, orderBy: { createdAt: "desc" } },
          conversations: { select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5 },
        },
      }),

      prisma.tokenUsage.aggregate({ where: { userId: id, timestamp: { gte: fiveHoursAgo } }, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true }),

      prisma.tokenUsage.aggregate({ where: { userId: id, timestamp: { gte: oneDayAgo } }, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true }),

      prisma.tokenUsage.aggregate({ where: { userId: id, timestamp: { gte: sevenDaysAgo } }, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true }),

      prisma.tokenUsage.findMany({
        where: { userId: id },
        select: { totalTokens: true, timestamp: true },
        orderBy: { timestamp: "desc" },
        take: 100,
      }),

      prisma.conversation.count({ where: { userId: id } }),

      prisma.tokenUsage.findFirst({
        where: { userId: id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true, modelUsed: true },
      }),

      prisma.upgradeRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const totalUsage = usageTotal.reduce((sum, r) => sum + r.totalTokens, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      subscription: user.subscription,
      apiKeys: user.apiKeys.map((key) => ({ ...key, key: maskApiKey(key.key) })),
      conversations: user.conversations,
      conversationCount: convos,
      lastActivity: lastActivity,
      usage: {
        fiveHour: { requests: usage5h._count || 0, input: usage5h._sum?.promptTokens || 0, output: usage5h._sum?.completionTokens || 0, units: usage5h._sum?.totalTokens || 0 },
        daily: { requests: usage24h._count || 0, input: usage24h._sum?.promptTokens || 0, output: usage24h._sum?.completionTokens || 0, units: usage24h._sum?.totalTokens || 0 },
        weekly: { requests: usage7d._count || 0, input: usage7d._sum?.promptTokens || 0, output: usage7d._sum?.completionTokens || 0, units: usage7d._sum?.totalTokens || 0 },
        total: totalUsage,
      },
      upgradeRequests,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
