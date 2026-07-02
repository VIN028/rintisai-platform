import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const { plan, paymentMethod, paymentRef, paymentProof, requestedCode, transferAmount: topupAmount } = await req.json().catch(() => ({}));

    if (!plan || !["student", "starter", "pro", "developer", "topup"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    if (!paymentMethod || !["gopay", "ovo", "bank", "crypto"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }
    if (paymentProof && (typeof paymentProof !== "string" || paymentProof.length > 750_000 || !paymentProof.startsWith("data:image/"))) {
      return NextResponse.json({ error: "Invalid payment proof image." }, { status: 400 });
    }
    if (plan === "topup" && (!Number.isFinite(Number(topupAmount)) || Number(topupAmount) < 10_000)) {
      return NextResponse.json({ error: "Minimum topup is Rp10.000." }, { status: 400 });
    }

    const prices = { student: 29000, starter: 49000, pro: 89000, developer: 149000 };
    const uniqueCode = requestedCode && /^\d{3}$/.test(requestedCode) ? requestedCode : String(Math.floor(Math.random() * 900) + 100);
    const transferAmount = plan === "topup" ? (Number(topupAmount) || 0) + Number(uniqueCode) : prices[plan] + Number(uniqueCode);

    let request;
    if (prisma.upgradeRequest) {
      request = await prisma.upgradeRequest.create({
        data: {
          userId: user.id,
          plan,
          paymentMethod,
          paymentRef: paymentRef?.trim() || null,
          paymentProof: paymentProof || null,
          uniqueCode,
          transferAmount,
        },
      });
    } else {
      const id = crypto.randomUUID();
      const createdAt = new Date();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "UpgradeRequest" (id, userId, plan, paymentMethod, paymentRef, paymentProof, uniqueCode, transferAmount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        user.id,
        plan,
        paymentMethod,
        paymentRef?.trim() || null,
        paymentProof || null,
        uniqueCode,
        transferAmount,
        "pending",
        createdAt,
      );
      request = { id, userId: user.id, plan, paymentMethod, paymentRef, status: "pending", createdAt };
    }

    return NextResponse.json({ message: "Upgrade request submitted.", request, transferAmount, uniqueCode });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
