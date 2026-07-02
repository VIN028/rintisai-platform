import { NextResponse } from "next/server";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const { plan, amount } = await req.json().catch(() => ({}));
    if (!plan || !["student", "starter", "pro", "developer", "topup"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const priceMap = { student: 29000, starter: 49000, pro: 89000, developer: 149000 };
    const creditMap = { 10000: 2000000, 25000: 5000000, 50000: 12000000 };
    const uniqueCode = String(Math.floor(Math.random() * 900) + 100);
    
    if (plan === "topup") {
      const topupAmount = Number(amount) || 10000;
      const transferAmount = topupAmount + Number(uniqueCode);
      const credits = creditMap[topupAmount] || Math.round(topupAmount * 200);
      return NextResponse.json({ uniqueCode, transferAmount, credits, isTopup: true });
    }

    const transferAmount = priceMap[plan] + Number(uniqueCode);
    return NextResponse.json({ uniqueCode, transferAmount, isTopup: false });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
