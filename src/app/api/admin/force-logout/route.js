import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function POST(req) {
  try {
    await authenticateAdmin(req);

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: user.tokenVersion + 1 },
    });

    return NextResponse.json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Force Logout error:", error);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
