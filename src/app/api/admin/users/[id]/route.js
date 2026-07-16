import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { maskApiKey } from "@/lib/security";
import { getEffectiveLimits } from "@/app/api/auth/me/route";
import { expireSubscriptionIfNeeded } from "@/lib/subscription-expiry";

export async function GET(req, { params }) {
  try {
    await authenticateAdmin(req);
    const { id } = await params;

    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        apiKeys: { select: { id: true, name: true, key: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        conversations: { select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5 },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subscription = await expireSubscriptionIfNeeded(user.subscription, now);
    const limits = getEffectiveLimits(subscription);
    const currentWindowStart = limits.windowStart ? new Date(limits.windowStart) : new Date(now.getTime() - (limits.windowMs || 30 * 24 * 60 * 60 * 1000));

    const [usageCurrent, usageAllTime, convos, lastActivity, upgradeRequests] = await Promise.all([
      prisma.tokenUsage.aggregate({ where: { userId: id, timestamp: { gte: currentWindowStart } }, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true }),
      prisma.tokenUsage.aggregate({ where: { userId: id }, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true }),
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

    const usageWindow = (usage) => ({
      requests: usage._count || 0,
      rawInputTokens: usage._sum?.promptTokens || 0,
      rawOutputTokens: usage._sum?.completionTokens || 0,
      usageUnits: usage._sum?.totalTokens || 0,
      input: usage._sum?.promptTokens || 0,
      output: usage._sum?.completionTokens || 0,
      units: usage._sum?.totalTokens || 0,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      subscription,
      apiKeys: user.apiKeys.map((key) => ({ ...key, key: maskApiKey(key.key) })),
      conversations: user.conversations,
      conversationCount: convos,
      lastActivity: lastActivity,
      usage: {
        current: usageWindow(usageCurrent),
        allTime: usageWindow(usageAllTime),
        windowLabel: limits.windowLabel,
        windowKey: limits.windowKey,
        total: usageAllTime._sum?.totalTokens || 0,
      },
      upgradeRequests,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
