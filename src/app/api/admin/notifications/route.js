import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const count = await prisma.upgradeRequest.count({ where: { status: "pending" } });
    return NextResponse.json({ pending: count });
  } catch (err) {
    return NextResponse.json({ pending: 0 });
  }
}
