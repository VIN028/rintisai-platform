import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { createUpgradeQuote, getUpgradeQuote } from "@/lib/upgradeQuote";
import { getManagedUsdIdrRate } from "@/lib/claude-payg";
import { adminUpgradeRequestEmail, sendEmail } from "@/lib/email";
import { getPlanPrice, isApiPlan, isDiscontinuedPlan, isPurchasablePlan } from "@/lib/plans";

const upgradeSubmitAttempts = new Map();
const OWNER_NOTIFICATION_EMAILS = ["vincentius028@gmail.com", "Hoseaglen88@gmail.com"];

function checkUpgradeSubmitRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxAttempts = 5;
  const key = String(userId || "unknown");
  const attempts = (upgradeSubmitAttempts.get(key) || []).filter((time) => now - time < windowMs);
  if (attempts.length >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - attempts[0])) / 1000) };
  }
  attempts.push(now);
  upgradeSubmitAttempts.set(key, attempts);
  return { allowed: true };
}

async function notifyAdmins({ user, request, baseAmount, transferAmount, uniqueCode }) {
  const configured = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const adminEmails = configured.length > 0
    ? configured
    : await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } }).then((rows) => rows.map((row) => row.email)).catch(() => []);
  const uniqueRecipients = [...new Set([...adminEmails, ...OWNER_NOTIFICATION_EMAILS].filter(Boolean))];
  if (uniqueRecipients.length === 0) return;
  const email = adminUpgradeRequestEmail({ user, request, baseAmount, transferAmount, uniqueCode });
  await Promise.all(uniqueRecipients.map((to) => sendEmail({ to, ...email }).catch(() => null)));
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const rateLimit = checkUpgradeSubmitRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upgrade or top-up attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const { plan, paymentMethod, paymentRef, paymentProof, amount, billingInterval } = await req.json().catch(() => ({}));

    if (!plan || !(isPurchasablePlan(plan) || isApiPlan(plan) || ["topup", "api_topup"].includes(plan))) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    if (isDiscontinuedPlan(plan)) {
      return NextResponse.json({ error: "This plan is no longer available." }, { status: 400 });
    }
    if (!paymentMethod || !["gopay", "ovo", "bank", "crypto"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }
    if (paymentProof && (typeof paymentProof !== "string" || paymentProof.length > 750_000 || !paymentProof.startsWith("data:image/"))) {
      return NextResponse.json({ error: "Invalid payment proof image." }, { status: 400 });
    }

    const activePlan = user.subscription?.status === "active" ? user.subscription?.plan : "free";
    if (plan === "topup" && (activePlan === "free" || isApiPlan(activePlan))) {
      return NextResponse.json({ error: "Web usage top-up is only available for active web plans." }, { status: 403 });
    }
    if ((plan === "api_topup" || isApiPlan(plan)) && !isApiPlan(activePlan)) {
      return NextResponse.json({ error: "API top-up is only available for active API plans." }, { status: 403 });
    }

    const pendingRequest = await prisma.upgradeRequest.findFirst({
      where: {
        userId: user.id,
        status: "pending",
      },
      select: { id: true, plan: true, transferAmount: true, uniqueCode: true },
    });
    if (pendingRequest) {
      return NextResponse.json(
        { error: "You already have a pending upgrade or top-up request. Please wait for admin review before submitting another one.", request: pendingRequest },
        { status: 409 }
      );
    }

    const interval = billingInterval === "3day" ? "3day" : billingInterval === "weekly" ? "weekly" : "monthly";
    const topupCredits = { 25000: 10000000, 50000: 25000000, 100000: 60000000 };
    const topupAmount = Number(amount);
    if (plan === "topup" && !Object.prototype.hasOwnProperty.call(topupCredits, topupAmount)) {
      return NextResponse.json({ error: "Invalid top-up package." }, { status: 400 });
    }
    const isApiTopup = plan === "api_topup" || isApiPlan(plan);
    const minimumApiTopupAmount = isApiTopup ? await getManagedUsdIdrRate() : null;
    if (isApiTopup && (!Number.isInteger(topupAmount) || topupAmount < minimumApiTopupAmount)) {
      return NextResponse.json({ error: `Minimum API top-up is Rp${minimumApiTopupAmount.toLocaleString("id-ID")} ($1.00).` }, { status: 400 });
    }

    const quoteAmount = plan === "topup" || isApiTopup ? topupAmount : interval;
    const baseAmount = plan === "topup" || isApiTopup ? topupAmount : getPlanPrice(plan, interval);
    if (!baseAmount) return NextResponse.json({ error: "Invalid plan price." }, { status: 400 });
    const quote = getUpgradeQuote({ userId: user.id, plan, amount: quoteAmount }) || createUpgradeQuote({ userId: user.id, plan, amount: quoteAmount, baseAmount });
    const uniqueCode = quote.uniqueCode;
    const transferAmount = quote.transferAmount;

    let request;
    if (prisma.upgradeRequest) {
      request = await prisma.upgradeRequest.create({
        data: {
          userId: user.id,
          plan,
          billingInterval: plan === "topup" || isApiTopup ? "monthly" : interval,
          paymentMethod,
          paymentRef: paymentRef?.trim() || null,
          paymentProof: paymentProof || null,
          uniqueCode,
          transferAmount,
        },
      });
    } else {
      const id = crypto.randomUUID();
      const createdAt = new Date();
      await prisma.$executeRaw`INSERT INTO "UpgradeRequest" ("id", "userId", "plan", "billingInterval", "paymentMethod", "paymentRef", "paymentProof", "uniqueCode", "transferAmount", "status", "createdAt") VALUES (${id}, ${user.id}, ${plan}, ${plan === "topup" || isApiTopup ? "monthly" : interval}, ${paymentMethod}, ${paymentRef?.trim() || null}, ${paymentProof || null}, ${uniqueCode}, ${transferAmount}, ${"pending"}, ${createdAt})`;
      request = { id, userId: user.id, plan, paymentMethod, paymentRef, status: "pending", createdAt };
    }

    notifyAdmins({ user, request, baseAmount, transferAmount, uniqueCode }).catch((err) => console.error("Admin payment notification failed:", err));

    return NextResponse.json({ message: "Upgrade request submitted.", request, transferAmount, uniqueCode });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
