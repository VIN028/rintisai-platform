import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, createVerificationToken } from "@/lib/auth";
import { isEmailConfigured, sendEmail, verifyEmailCode } from "@/lib/email";

const resendMap = new Map();

function canResend(userId) {
  const now = Date.now();
  const attempts = (resendMap.get(userId) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (attempts.length >= 3) return false;
  attempts.push(now);
  resendMap.set(userId, attempts);
  return true;
}

export async function POST(req) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "Email verification is temporarily unavailable." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    let user = null;
    try {
      user = await authenticateUser(req);
    } catch {
      if (requestedEmail) {
        user = await prisma.user.findUnique({ where: { email: requestedEmail } });
      }
    }

    if (!user) {
      return NextResponse.json({ message: "If this email can be verified, a new code has been sent." });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ message: "Email already verified." });
    }
    if (!canResend(user.id || user.email)) {
      return NextResponse.json({ error: "Too many verification emails. Try again later." }, { status: 429 });
    }

    const { token, hash } = createVerificationToken(user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hash,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendEmail({ to: user.email, ...verifyEmailCode(token, user.email) });
    return NextResponse.json({ message: "Verification code sent." });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
