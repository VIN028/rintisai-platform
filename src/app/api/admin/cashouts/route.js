import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin, AuthError } from "@/lib/auth";
import { idrToUsdMicros } from "@/lib/claude-payg";

const VALID_STATUSES = ["confirmed", "completed", "rejected"];
const ONGOING_STATUSES = ["pending", "confirmed"];

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const requests = await prisma.cashoutRequest.findMany({
      include: { user: { select: { email: true, name: true, subscription: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ requests });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 403;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(req) {
  try {
    const admin = await authenticateAdmin(req);
    const { requestId, status } = await req.json().catch(() => ({}));
    if (!requestId || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid cash-out action." }, { status: 400 });
    }

    const request = await prisma.cashoutRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { subscription: true } } },
    });
    if (!request) {
      return NextResponse.json({ error: "Cash-out request not found." }, { status: 404 });
    }
    if (!ONGOING_STATUSES.includes(request.status)) {
      return NextResponse.json({ error: "Only pending or confirmed cash-out requests can be updated." }, { status: 400 });
    }

    const actionData = {
      status,
      adminActionBy: admin.email || admin.id || "admin",
      adminActionAt: new Date(),
      ...(status === "confirmed" ? { confirmedAt: new Date() } : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
      ...(status === "rejected" ? { rejectedAt: new Date() } : {}),
    };

    if (status === "completed") {
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.cashoutRequest.updateMany({
          where: { id: request.id, status: { in: ONGOING_STATUSES } },
          data: actionData,
        });
        if (claimed.count !== 1) {
          throw Object.assign(new Error("Cash-out request has already been processed."), { status: 409 });
        }
        const subscription = await tx.subscription.findUnique({ where: { userId: request.userId } });
        const legacyBalanceUsdMicros = subscription?.apiCreditBalanceRp ? idrToUsdMicros(subscription.apiCreditBalanceRp, request.fxRate) : 0;
        const currentBalance = (subscription?.apiCreditBalanceUsdMicros || 0) + legacyBalanceUsdMicros;
        if (currentBalance < request.amountUsdMicros) {
          throw Object.assign(new Error("User balance is no longer sufficient for this cash-out."), { status: 400 });
        }
        await tx.subscription.update({
          where: { userId: request.userId },
          data: {
            apiCreditBalanceUsdMicros: currentBalance - request.amountUsdMicros,
            apiCreditBalanceRp: 0,
          },
        });
        await tx.apiCreditLedger.create({
          data: {
            userId: request.userId,
            type: "refund",
            amountRp: -request.amountRp,
            amountUsdMicros: -request.amountUsdMicros,
            fxRate: request.fxRate,
            note: `Cash-out request ${request.id} via ${request.payoutMethod}${request.payoutRef ? ` (${request.payoutRef})` : ""}; fee Rp${Number(request.feeRp || 0).toLocaleString("id-ID")}; net payout Rp${Number(request.payoutAmountRp || Math.max(0, request.amountRp - (request.feeRp || 0))).toLocaleString("id-ID")}`,
          },
        });
        return tx.cashoutRequest.findUnique({ where: { id: request.id } });
      });
      return NextResponse.json({ message: "Cash-out completed and balance deducted.", request: updated });
    }

    const updated = await prisma.cashoutRequest.update({ where: { id: request.id }, data: actionData });
    return NextResponse.json({ message: "Cash-out request updated.", request: updated });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 403;
    return NextResponse.json({ error: err.message }, { status });
  }
}
