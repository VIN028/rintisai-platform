import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashVerificationToken } from "@/lib/auth";

const verifyAttemptMap = new Map();

function getClientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function checkVerifyRateLimit(req, email) {
  const key = `${getClientIp(req)}:${String(email || "").trim().toLowerCase()}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempts = (verifyAttemptMap.get(key) || []).filter((t) => now - t < windowMs);
  verifyAttemptMap.set(key, attempts);
  if (attempts.length >= 5) return { allowed: false, key };
  return { allowed: true, key };
}

function recordVerifyFailure(key) {
  const attempts = verifyAttemptMap.get(key) || [];
  attempts.push(Date.now());
  verifyAttemptMap.set(key, attempts);
}

async function verifyByEmailAndCode(email, token) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !token) return null;

  const tokenHash = hashVerificationToken(token, normalizedEmail);
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      emailVerifyToken: tokenHash,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) return null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    }),
    prisma.subscription.updateMany({
      where: { userId: user.id, plan: "free", status: "inactive" },
      data: { status: "active" },
    }),
  ]);

  return user;
}

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(`${origin}/verify-email?error=missing_token`);
  }

  const rateLimit = checkVerifyRateLimit(req, email);
  if (!rateLimit.allowed) {
    return NextResponse.redirect(`${origin}/verify-email?email=${encodeURIComponent(email)}&error=too_many_attempts`);
  }

  const user = await verifyByEmailAndCode(email, token);

  if (!user) {
    recordVerifyFailure(rateLimit.key);
    return NextResponse.redirect(`${origin}/verify-email?email=${encodeURIComponent(email)}&error=invalid_or_expired`);
  }

  verifyAttemptMap.delete(rateLimit.key);

  return NextResponse.redirect(`${origin}/verify-email?verified=1`);
}

export async function POST(req) {
  const { email, code } = await req.json().catch(() => ({}));

  if (!email || !code) {
    return NextResponse.json({ error: "Email and verification code are required." }, { status: 400 });
  }

  const rateLimit = checkVerifyRateLimit(req, email);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many verification attempts. Please request a new code or try again later." }, { status: 429 });
  }

  const user = await verifyByEmailAndCode(email, String(code).trim());
  if (!user) {
    recordVerifyFailure(rateLimit.key);
    return NextResponse.json({ error: "Verification code is invalid or expired." }, { status: 400 });
  }

  verifyAttemptMap.delete(rateLimit.key);

  return NextResponse.json({ message: "Email verified. You can now sign in." });
}
