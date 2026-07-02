import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { sendEmail, resetCodeEmail } from "@/lib/email";

const hashResetCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

const forgotMap = new Map();

export async function POST(req) {
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = ip + ":" + email.toLowerCase().trim();
    const now = Date.now();
    const attempts = (forgotMap.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
    if (attempts.length >= 3) {
      return NextResponse.json({ message: "If this email is registered, a reset code has been sent." });
    }
    attempts.push(now);
    forgotMap.set(key, attempts);

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return NextResponse.json({ message: "If this email is registered, a reset code has been sent." });
    }

    const resetCode = crypto.randomBytes(4).toString("hex");
    const resetCodeExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({ where: { id: user.id }, data: { resetCode: hashResetCode(resetCode), resetCodeExpires } });

    const emailContent = resetCodeEmail(resetCode);
    await sendEmail({ to: user.email, ...emailContent });

    return NextResponse.json({ message: "Reset code sent to your email. Check your inbox." });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
