import { NextResponse } from "next/server";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { createUpgradeQuote } from "@/lib/upgradeQuote";
import { getManagedUsdIdrRate } from "@/lib/claude-payg";
import { getPlanPrice, isApiPlan, isDiscontinuedPlan, isPurchasablePlan } from "@/lib/plans";

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const { plan, amount, billingInterval } = await req.json().catch(() => ({}));
    if (!plan || !(isPurchasablePlan(plan) || isApiPlan(plan) || ["topup", "api_topup"].includes(plan))) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    if (isDiscontinuedPlan(plan)) {
      return NextResponse.json({ error: "This plan is no longer available." }, { status: 400 });
    }

    const activePlan = user.subscription?.status === "active" ? user.subscription?.plan : "free";
    if (plan === "topup" && (activePlan === "free" || isApiPlan(activePlan))) {
      return NextResponse.json({ error: "Web usage top-up is only available for active web plans." }, { status: 403 });
    }
    if ((plan === "api_topup" || isApiPlan(plan)) && !isApiPlan(activePlan)) {
      return NextResponse.json({ error: "API top-up is only available for active API plans." }, { status: 403 });
    }

    const interval = billingInterval === "3day" ? "3day" : billingInterval === "weekly" ? "weekly" : "monthly";
    const creditMap = { 25000: 10000000, 50000: 25000000, 100000: 60000000 };
    if (plan === "topup") {
      const topupAmount = Number(amount) || 25000;
      if (!Object.prototype.hasOwnProperty.call(creditMap, topupAmount)) {
        return NextResponse.json({ error: "Invalid top-up package." }, { status: 400 });
      }
      const quote = createUpgradeQuote({ userId: user.id, plan, amount: topupAmount, baseAmount: topupAmount });
      const credits = creditMap[topupAmount];
      return NextResponse.json({ uniqueCode: quote.uniqueCode, transferAmount: quote.transferAmount, credits, isTopup: true });
    }
    if (plan === "api_topup" || isApiPlan(plan)) {
      const minimumAmount = await getManagedUsdIdrRate();
      const topupAmount = Number(amount) || minimumAmount;
      if (!Number.isInteger(topupAmount) || topupAmount < minimumAmount) {
        return NextResponse.json({ error: `Minimum API top-up is Rp${minimumAmount.toLocaleString("id-ID")} ($1.00).` }, { status: 400 });
      }
      const quote = createUpgradeQuote({ userId: user.id, plan, amount: topupAmount, baseAmount: topupAmount });
      return NextResponse.json({ uniqueCode: quote.uniqueCode, transferAmount: quote.transferAmount, creditsRp: topupAmount, isApiTopup: true, minimumAmount });
    }

    const baseAmount = getPlanPrice(plan, interval);
    if (!baseAmount) return NextResponse.json({ error: "Invalid plan price." }, { status: 400 });
    const quote = createUpgradeQuote({ userId: user.id, plan, amount: interval, baseAmount });
    return NextResponse.json({ uniqueCode: quote.uniqueCode, transferAmount: quote.transferAmount, isTopup: false, billingInterval: interval });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
