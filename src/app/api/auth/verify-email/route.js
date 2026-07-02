import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashVerificationToken } from "@/lib/auth";

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/verify-email?error=missing_token`);
  }

  const tokenHash = hashVerificationToken(token);
  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: tokenHash,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.redirect(`${origin}/verify-email?error=invalid_or_expired`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  return NextResponse.redirect(`${origin}/verify-email?verified=1`);
}
