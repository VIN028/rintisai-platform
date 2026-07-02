import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import bcrypt from "bcrypt";
import crypto from "crypto";

export async function POST(req) {
  try {
    await authenticateAdmin(req);
    const { userId } = await req.json().catch(() => ({}));
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const newPassword = crypto.randomBytes(8).toString("hex");
    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    return NextResponse.json({ message: "Password reset", newPassword });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
