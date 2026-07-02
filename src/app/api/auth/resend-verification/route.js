import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, createVerificationToken } from "@/lib/auth";
import { sendEmail, verifyEmail } from "@/lib/email";

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
    const user = await authenticateUser(req);

    if (user.emailVerifiedAt) {
      return NextResponse.json({ message: "Email already verified." });
    }
    if (!canResend(user.id)) {
      return NextResponse.json({ error: "Too many verification emails. Try again later." }, { status: 429 });
    }

    const { token, hash } = createVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hash,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendEmail({ to: user.email, ...verifyEmail(token) });
    return NextResponse.json({ message: "Verification email sent." });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
