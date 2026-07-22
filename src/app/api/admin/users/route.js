import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { getPlanDefinition } from "@/lib/plans";
import { getEffectiveLimits } from "@/app/api/auth/me/route";
import { maskApiKey } from "@/lib/security";
import { buildFreeSubscriptionData, expireSubscriptionIfNeeded, normalizeStatusForExpiry, resolveAdminPatchExpiry, shouldDowngradeToFree } from "@/lib/subscription-expiry";
import bcrypt from "bcrypt";
import crypto from "crypto";

function normalizeLimit(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const now = new Date();
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
      const subscription = await expireSubscriptionIfNeeded(user.subscription, now);
      const limits = getEffectiveLimits(subscription);
      const currentWindowStart = limits.windowStart ? new Date(limits.windowStart) : new Date(now.getTime() - (limits.windowMs || 30 * 24 * 60 * 60 * 1000));
      const usageCurrent = await prisma.tokenUsage.aggregate({ where: { userId: user.id, timestamp: { gte: currentWindowStart } }, _sum: { totalTokens: true }, _count: true });
      const userApiKeys = apiKeysByUserId[user.id] || [];

      const usageWindow = (usage) => ({
        requests: usage._count || 0,
        usageUnits: usage._sum?.totalTokens || 0,
        units: usage._sum?.totalTokens || 0,
      });

      return {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        name: user.name,
        role: user.role,
        disabled: user.disabled,
        createdAt: user.createdAt,
        apiKeys: userApiKeys,
        apiKeyCount: userApiKeys.length,
        subscription,
        usage: {
          current: usageWindow(usageCurrent),
          windowLabel: limits.windowLabel,
          windowKey: limits.windowKey,
          limit: limits.limit,
          limits,
        },
      };
    }));

    return NextResponse.json({ users: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(req) {
  try {
    const admin = await authenticateAdmin(req);
    const { email, password, name, role } = await req.json().catch(() => ({}));

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const userPassword = password && password.length >= 6
      ? password
      : crypto.randomUUID().replace(/-/g, "").slice(0, 12) + "Aa1!";

    const hashedPassword = await bcrypt.hash(userPassword, 10);

    const userRole = role === "ADMIN" ? "ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || null,
        role: userRole,
        disabled: false,
      },
      select: {
        id: true, email: true, name: true, role: true, disabled: true,
        emailVerifiedAt: true, createdAt: true,
      },
    });

    return NextResponse.json({
      message: "User berhasil dibuat.",
      user,
      generatedPassword: password ? undefined : userPassword,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { userId, plan, billingInterval, status, expiryDate, apiAccessEnabled, customLimit5h, customLimitWeekly, customLimitMonthly } = body;

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

    const nextPlan = plan === "free" || getPlanDefinition(plan) ? plan : existingUser.subscription?.plan || "free";
    const nextBillingInterval = billingInterval === "3day" ? "3day" : billingInterval === "weekly" ? "weekly" : "monthly";
    const now = new Date();
    const nextExpiry = resolveAdminPatchExpiry({ existingSubscription: existingUser.subscription, nextPlan, nextBillingInterval, requestedExpiryDate: expiryDate, now });
    const requestedStatus = ["active", "inactive", "expired", "cancelled", "suspended"].includes(status) ? status : existingUser.subscription?.status || "inactive";
    const nextStatus = normalizeStatusForExpiry(requestedStatus, nextExpiry, now);
    const nextApiAccess = typeof apiAccessEnabled === "boolean" ? apiAccessEnabled : getPlanDefinition(nextPlan)?.apiAccess === true;
    const downgradeToFree = shouldDowngradeToFree({ plan: nextPlan, status: nextStatus, expiryDate: nextExpiry, now });
    const subscriptionData = downgradeToFree
      ? buildFreeSubscriptionData(now)
      : {
        plan: nextPlan,
        billingInterval: nextBillingInterval,
        status: nextStatus,
        expiryDate: nextExpiry,
        apiAccessEnabled: nextApiAccess,
        customLimit5h: normalizeLimit(customLimit5h),
        customLimitWeekly: normalizeLimit(customLimitWeekly),
        customLimitMonthly: normalizeLimit(customLimitMonthly),
      };

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        ...subscriptionData,
      },
      update: subscriptionData,
    });

    return NextResponse.json({ message: "User berhasil diperbarui.", subscription });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
