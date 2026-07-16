import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { getManagedUsdIdrRate, idrToUsdMicros, usdMicrosToIdr } from "@/lib/claude-payg";

const MIN_CASHOUT_USD_MICROS = 1_000_000;
const ONGOING_STATUSES = ["pending", "confirmed"];

function cashoutFeeRp(method) {
  if (["gopay", "ovo"].includes(method)) return 2500;
  if (method === "bca") return 0;
  if (method === "bank") return 6500;
  return 0;
}

function normalizeUsdMicros(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export async function GET(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const requests = await prisma.cashoutRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).catch(() => []);

    return NextResponse.json({ requests });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const body = await req.json().catch(() => ({}));
    const amountUsdMicros = normalizeUsdMicros(body.amountUsdMicros);
    const payoutMethod = typeof body.payoutMethod === "string" ? body.payoutMethod.trim().toLowerCase() : "";
    const payoutRef = typeof body.payoutRef === "string" ? body.payoutRef.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    if (!amountUsdMicros || amountUsdMicros < MIN_CASHOUT_USD_MICROS) {
      return NextResponse.json({ error: "Minimum cash-out amount is $1.00." }, { status: 400 });
    }
    if (!payoutMethod || !["gopay", "ovo", "bca", "bank", "crypto"].includes(payoutMethod)) {
      return NextResponse.json({ error: "Invalid payout method." }, { status: 400 });
    }
    if (!payoutRef) {
      return NextResponse.json({ error: "Payout account or wallet reference is required." }, { status: 400 });
    }

    const ongoing = await prisma.cashoutRequest.findFirst({
      where: { userId: user.id, status: { in: ONGOING_STATUSES } },
      select: { id: true, status: true, amountUsdMicros: true, createdAt: true },
    });
    if (ongoing) {
      return NextResponse.json({ error: "You already have an active cash-out request. Wait for admin review before requesting another.", request: ongoing }, { status: 409 });
    }

    const fxRate = await getManagedUsdIdrRate();
    const balanceUsdMicros = (user.subscription?.apiCreditBalanceUsdMicros || 0) + idrToUsdMicros(user.subscription?.apiCreditBalanceRp || 0, fxRate);
    if (user.subscription?.status !== "active" || user.subscription?.plan === "free") {
      return NextResponse.json({ error: "Cash-out requires an active paid account with API PAYG balance." }, { status: 403 });
    }
    if (balanceUsdMicros < MIN_CASHOUT_USD_MICROS) {
      return NextResponse.json({ error: "Your available API balance is below the $1.00 cash-out minimum." }, { status: 400 });
    }
    if (amountUsdMicros > balanceUsdMicros) {
      return NextResponse.json({ error: "Cash-out amount cannot exceed your available API balance." }, { status: 400 });
    }

    const amountRp = usdMicrosToIdr(amountUsdMicros, fxRate);
    const feeRp = cashoutFeeRp(payoutMethod);
    const payoutAmountRp = Math.max(0, amountRp - feeRp);

    const request = await prisma.cashoutRequest.create({
      data: {
        userId: user.id,
        amountUsdMicros,
        amountRp,
        feeRp,
        payoutAmountRp,
        fxRate,
        payoutMethod,
        payoutRef,
        reason: reason || null,
      },
    });

    return NextResponse.json({ message: "Cash-out request submitted for admin review.", request });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
