import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const [upgradePending, cashoutPending] = await Promise.all([
      prisma.upgradeRequest.count({ where: { status: "pending" } }),
      prisma.cashoutRequest.count({ where: { status: "pending" } }).catch(() => 0),
    ]);
    return NextResponse.json({ pending: upgradePending + cashoutPending, upgradePending, cashoutPending });
  } catch (err) {
    return NextResponse.json({ pending: 0, upgradePending: 0, cashoutPending: 0 });
  }
}
