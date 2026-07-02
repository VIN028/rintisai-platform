import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { getEffectiveLimits } from "@/app/api/auth/me/route";
import { maskApiKey } from "@/lib/security";

function normalizeLimit(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const apiKeys = prisma.apiKey
      ? await prisma.apiKey.findMany({
        select: { id: true, name: true, key: true, createdAt: true, userId: true },
        orderBy: { createdAt: "desc" },
      })
      : await prisma.$queryRawUnsafe('SELECT id, name, key, createdAt, userId FROM "ApiKey" ORDER BY createdAt DESC');

    const apiKeysByUserId = apiKeys.reduce((acc, key) => {
      acc[key.userId] = acc[key.userId] || [];
      acc[key.userId].push({
        id: key.id,
        name: key.name,
        key: maskApiKey(key.key),
        createdAt: key.createdAt,
      });
      return acc;
    }, {});

    const rows = await Promise.all(users.map(async (user) => {
      const [usage5h, usage7d, usage30d] = await Promise.all([
        prisma.tokenUsage.aggregate({ where: { userId: user.id, timestamp: { gte: fiveHoursAgo } }, _sum: { totalTokens: true } }),
        prisma.tokenUsage.aggregate({ where: { userId: user.id, timestamp: { gte: sevenDaysAgo } }, _sum: { totalTokens: true } }),
        prisma.tokenUsage.aggregate({ where: { userId: user.id, timestamp: { gte: thirtyDaysAgo } }, _sum: { totalTokens: true } }),
      ]);

      const limits = getEffectiveLimits(user.subscription);
      const userApiKeys = apiKeysByUserId[user.id] || [];

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        apiKeys: userApiKeys,
        apiKeyCount: userApiKeys.length,
        subscription: user.subscription,
        usage: {
          rolling5h: usage5h._sum.totalTokens || 0,
          weekly: usage7d._sum.totalTokens || 0,
          monthly: usage30d._sum.totalTokens || 0,
          limits,
        },
      };
    }));

    return NextResponse.json({ users: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { userId, plan, status, expiryDate, apiAccessEnabled, customLimit5h, customLimitWeekly, customLimitMonthly } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const nextPlan = ["free", "student", "starter", "pro", "developer"].includes(plan) ? plan : existingUser.subscription?.plan || "free";
    const nextStatus = ["active", "inactive", "expired", "cancelled", "suspended"].includes(status) ? status : existingUser.subscription?.status || "inactive";
    const nextExpiry = expiryDate ? new Date(expiryDate) : existingUser.subscription?.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const nextApiAccess = typeof apiAccessEnabled === "boolean" ? apiAccessEnabled : nextPlan === "developer";

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: nextPlan,
        status: nextStatus,
        expiryDate: nextExpiry,
        apiAccessEnabled: nextApiAccess,
        customLimit5h: normalizeLimit(customLimit5h),
        customLimitWeekly: normalizeLimit(customLimitWeekly),
        customLimitMonthly: normalizeLimit(customLimitMonthly),
      },
      update: {
        plan: nextPlan,
        status: nextStatus,
        expiryDate: nextExpiry,
        apiAccessEnabled: nextApiAccess,
        customLimit5h: normalizeLimit(customLimit5h),
        customLimitWeekly: normalizeLimit(customLimitWeekly),
        customLimitMonthly: normalizeLimit(customLimitMonthly),
      },
    });

    return NextResponse.json({ message: "User berhasil diperbarui.", subscription });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
