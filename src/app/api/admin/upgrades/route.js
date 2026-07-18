import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { sendEmail, upgradeEmail } from "@/lib/email";
import { addClaudeApiCredit, getManagedUsdIdrRate, idrToUsdMicros } from "@/lib/claude-payg";
import { getCustomLimitField, getUsageWindowConfig, getPlanDefinition, isApiPlan } from "@/lib/plans";
import { activatePlanEntitlement, addActiveEntitlementLimitUnits, syncSubscriptionSummaryFromEntitlements } from "@/lib/entitlements";

function buildPaymentOps(request, fxRate) {
  const transferAmount = Number(request.transferAmount || 0);
  const uniqueCode = Number(request.uniqueCode || 0);
  const baseAmount = Math.max(0, transferAmount - uniqueCode);
  const isApiTopup = request.plan === "api_topup" || isApiPlan(request.plan);
  const isWebTopup = request.plan === "topup";
  const isSubscription = !isApiTopup && !isWebTopup;
  const now = new Date();
  const subscription = request.user?.subscription;
  const currentExpiry = subscription?.expiryDate ? new Date(subscription.expiryDate) : null;
  const requestFamily = getPlanDefinition(request.plan)?.family || null;
  const currentFamily = getPlanDefinition(subscription?.plan)?.family || null;
  const hasActiveSubscription = Boolean(isSubscription && subscription?.status === "active" && currentExpiry && currentExpiry > now);
  const isRenewal = Boolean(hasActiveSubscription && requestFamily && requestFamily === currentFamily);
  const isStacking = Boolean(hasActiveSubscription && requestFamily && currentFamily && requestFamily !== currentFamily);
  const interval = request.billingInterval === "3day" ? "3day" : request.billingInterval === "weekly" ? "weekly" : "monthly";
  const days = interval === "3day" ? 3 : interval === "weekly" ? 7 : 30;
  const activeBaseExpiry = isRenewal ? currentExpiry : now;
  const nextExpiry = isSubscription ? new Date(activeBaseExpiry.getTime() + days * 24 * 60 * 60 * 1000) : null;
  return {
    type: isApiTopup ? "api_topup" : isWebTopup ? "web_topup" : "subscription",
    isRenewal,
    isStacking,
    currentPlan: subscription?.plan || null,
    currentExpiry: currentExpiry?.toISOString?.() || null,
    nextExpiry: nextExpiry?.toISOString?.() || null,
    baseAmount,
    uniqueCode,
    transferAmount,
    fxRate: isApiTopup ? fxRate : null,
    estimatedUsdMicros: isApiTopup ? idrToUsdMicros(baseAmount, fxRate) : 0,
    ageMinutes: Math.max(0, Math.floor((now.getTime() - new Date(request.createdAt).getTime()) / 60000)),
    expectedLabel: isSubscription ? `${request.plan} ${request.billingInterval || "monthly"}` : isApiTopup ? `${getPlanDefinition(request.plan)?.label || "API"} credit` : "Web usage top-up",
  };
}

export async function GET(req) {
  try {
    const admin = await authenticateAdmin(req);

    const fxRate = await getManagedUsdIdrRate();
    const requests = prisma.upgradeRequest
      ? await prisma.upgradeRequest.findMany({
        include: { user: { select: { email: true, name: true, subscription: { select: { plan: true, status: true, expiryDate: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      : await prisma.$queryRaw`SELECT r.*, u.email as "user.email", u.name as "user.name" FROM "UpgradeRequest" r LEFT JOIN "User" u ON u.id = r."userId" ORDER BY r."createdAt" DESC LIMIT 50`.then((rows) =>
        rows.map((row) => ({
          ...row,
          user: { email: row["user.email"], name: row["user.name"] },
        }))
      );

    return NextResponse.json({ requests: requests.map((request) => ({ ...request, ops: buildPaymentOps(request, fxRate) })) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req) {
  try {
    const admin = await authenticateAdmin(req);
    const { requestId, status } = await req.json().catch(() => ({}));

    if (!requestId || !["confirmed", "completed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let request;
    if (prisma.upgradeRequest) {
      request = await prisma.upgradeRequest.findUnique({
        where: { id: requestId },
        include: { user: { include: { subscription: true } } },
      });
    } else {
      const rows = await prisma.$queryRaw`SELECT * FROM "UpgradeRequest" WHERE "id" = ${requestId}`;
      if (rows[0]) {
        const user = await prisma.user.findUnique({
          where: { id: rows[0].userId },
          include: { subscription: true },
        });
        request = { ...rows[0], user };
      }
    }

    if (!request) {
      return NextResponse.json({ error: "Upgrade request not found." }, { status: 404 });
    }
    if (["completed", "rejected"].includes(request.status)) {
      return NextResponse.json({ error: "This upgrade request has already been finalized." }, { status: 400 });
    }

    if (status === "completed") {
      const now = new Date();
      const currentExpiry = request.user?.subscription?.expiryDate ? new Date(request.user.subscription.expiryDate) : null;
      const activeBaseExpiry = currentExpiry && request.user?.subscription?.status === "active" && currentExpiry > now ? currentExpiry : now;
      if (request.plan === "topup") {
        const topupCredits = { 25000: 10000000, 50000: 25000000, 100000: 60000000 };
        const baseAmount = request.transferAmount ? Math.round((request.transferAmount - Number(request.uniqueCode || 0)) / 1000) * 1000 : 25000;
        const extraCredits = topupCredits[baseAmount];
        if (!extraCredits) {
          return NextResponse.json({ error: "Invalid top-up package on this request." }, { status: 400 });
        }
        
        const sub = request.user?.subscription;
        const activeInterval = getUsageWindowConfig(sub?.billingInterval).key;
        const customLimitField = getCustomLimitField(activeInterval);
        const currentCustom = sub?.[customLimitField] || 0;
        const expiryDate = sub?.expiryDate ? new Date(sub.expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        await prisma.subscription.upsert({
          where: { userId: request.userId },
          create: { userId: request.userId, plan: sub?.plan || "free", billingInterval: activeInterval, status: sub?.status || "active", expiryDate, [customLimitField]: currentCustom + extraCredits },
          update: { [customLimitField]: currentCustom + extraCredits },
        });
        const family = getPlanDefinition(sub?.plan)?.family;
        if (family) {
          await addActiveEntitlementLimitUnits({ userId: request.userId, family, amount: extraCredits, subscription: sub }).catch(() => null);
        }
      } else if (request.plan === "api_topup" || isApiPlan(request.plan)) {
        const minimumApiTopupAmount = await getManagedUsdIdrRate();
        const creditRp = request.transferAmount ? request.transferAmount - Number(request.uniqueCode || 0) : minimumApiTopupAmount;
        if (!Number.isInteger(creditRp) || creditRp < minimumApiTopupAmount) {
          return NextResponse.json({ error: "Invalid API top-up amount on this request." }, { status: 400 });
        }
        await addClaudeApiCredit({ userId: request.userId, amountRp: creditRp, plan: request.plan, note: `Admin completed request ${request.id}` });
      } else {
        const billingInterval = request.billingInterval === "3day" ? "3day" : request.billingInterval === "weekly" ? "weekly" : "monthly";
        const days = billingInterval === "3day" ? 3 : billingInterval === "weekly" ? 7 : 30;
        const entitlement = await activatePlanEntitlement({
          userId: request.userId,
          plan: request.plan,
          billingInterval,
          subscription: request.user?.subscription,
          sourceRequestId: request.id,
        });
        const expiryDate = entitlement?.expiresAt ? new Date(entitlement.expiresAt) : new Date(activeBaseExpiry.getTime() + days * 24 * 60 * 60 * 1000);
        const apiAccessEnabled = getPlanDefinition(request.plan)?.apiAccess === true;

        if (entitlement) {
          await syncSubscriptionSummaryFromEntitlements({ userId: request.userId, preferredEntitlement: entitlement });
        } else {
          await prisma.subscription.upsert({
            where: { userId: request.userId },
            create: {
              userId: request.userId,
              plan: request.plan,
              billingInterval,
              status: "active",
              expiryDate,
              apiAccessEnabled,
            },
            update: {
              plan: request.plan,
              billingInterval,
              status: "active",
              expiryDate,
              apiAccessEnabled,
            },
          });
        }
      }
      if (status === "completed" && !["topup", "api_topup"].includes(request.plan) && !isApiPlan(request.plan)) {
        const u = request.user;
        if (u?.email) sendEmail({ to: u.email, ...upgradeEmail(request.plan) }).catch(() => {});
      }
    }

    const actionData = {
      status,
      adminActionBy: admin.email || admin.id || "admin",
      adminActionAt: new Date(),
      ...(status === "confirmed" ? { confirmedAt: new Date() } : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
      ...(status === "rejected" ? { rejectedAt: new Date() } : {}),
    };

    const updated = prisma.upgradeRequest
      ? await prisma.upgradeRequest.update({ where: { id: requestId }, data: actionData })
      : await (async () => {
        await prisma.$executeRaw`UPDATE "UpgradeRequest" SET "status" = ${status} WHERE "id" = ${requestId}`;
        return { id: requestId, status };
      })();

    return NextResponse.json({ message: "Upgrade request updated.", request: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
