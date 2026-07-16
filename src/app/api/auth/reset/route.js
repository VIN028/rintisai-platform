import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import crypto from "crypto";

const resetMap = new Map();
const hashResetCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

export async function POST(req) {
  try {
    const { email, resetCode, newPassword } = await req.json().catch(() => ({}));
    if (!email || !resetCode || !newPassword) {
      return NextResponse.json({ error: "Email, reset code, and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const now = Date.now();
    const attempts = (resetMap.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
    if (attempts.length >= 5) {
      return NextResponse.json({ error: "Too many attempts. Please request a new reset code." }, { status: 429 });
    }
    attempts.push(now);
    resetMap.set(key, attempts);

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const normalizedCode = String(resetCode).trim().toLowerCase();
    if (!user || user.resetCode !== hashResetCode(normalizedCode)) {
      return NextResponse.json({ error: "Invalid reset code. If you requested another code, use the newest email. Older reset codes no longer work." }, { status: 400 });
    }
    if (!user.resetCodeExpires || new Date() > new Date(user.resetCodeExpires)) {
      return NextResponse.json({ error: "Reset code has expired." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetCode: null, resetCodeExpires: null, tokenVersion: { increment: 1 } },
    });

    return NextResponse.json({ message: "Password reset. You can now sign in." });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
