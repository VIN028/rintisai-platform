import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { calculateClaudeOfficialCostUsdMicros, getManagedUsdIdrRate, usdMicrosToIdr } from "@/lib/claude-payg";
import { isApiPlan } from "@/lib/plans";

const UPSTREAM_PERCENT = Number(process.env.CLAUDE_PAYG_UPSTREAM_PERCENT || 5);
const WEB_CLAUDE_UPSTREAM_PERCENT = Number(process.env.WEB_CLAUDE_UPSTREAM_PERCENT || 4.8);

function baseAmount(request) {
  const transfer = Number(request.transferAmount || 0);
  const code = Number(request.uniqueCode || 0);
  return Math.max(0, transfer - code);
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function groupRevenue(requests) {
  return requests.reduce((acc, request) => {
    const key = request.plan === "api_topup" || isApiPlan(request.plan)
      ? "apiTopup"
      : request.plan === "topup"
        ? "webTopup"
        : `${request.plan}_${request.billingInterval === "3day" ? "3day" : request.billingInterval === "weekly" ? "weekly" : "monthly"}`;
    acc[key] = acc[key] || { key, count: 0, revenueRp: 0 };
    acc[key].count += 1;
    acc[key].revenueRp += baseAmount(request);
    return acc;
  }, {});
}

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get("days") || 30), 1), 3650);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const fxRate = await getManagedUsdIdrRate();
    const upstreamPercent = Number.isFinite(UPSTREAM_PERCENT) && UPSTREAM_PERCENT > 0 ? UPSTREAM_PERCENT : 5;
    const webClaudeUpstreamPercent = Number.isFinite(WEB_CLAUDE_UPSTREAM_PERCENT) && WEB_CLAUDE_UPSTREAM_PERCENT > 0 ? WEB_CLAUDE_UPSTREAM_PERCENT : 4.8;

    const [completedRequests, topups, usageRows, webClaudeUsageRows, subscriptions, activeUsers] = await Promise.all([
      prisma.upgradeRequest.findMany({
        where: { status: "completed", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.apiCreditLedger.findMany({
        where: { type: "topup", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }).catch(() => []),
      prisma.apiCreditLedger.findMany({
        where: { type: "usage", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }).catch(() => []),
      prisma.tokenUsage.findMany({
        where: {
          timestamp: { gte: since },
          modelUsed: { startsWith: "claude-" },
          source: { in: ["web", "api"] },
        },
        orderBy: { timestamp: "desc" },
        take: 5000,
      }).catch(() => []),
      prisma.subscription.findMany({
        where: { apiCreditBalanceUsdMicros: { gt: 0 } },
        select: { plan: true, status: true, apiCreditBalanceUsdMicros: true },
      }).catch(() => []),
      prisma.subscription.count({ where: { status: "active" } }).catch(() => 0),
    ]);

    const revenueRp = sum(completedRequests, baseAmount);
    const subscriptionRevenueRp = sum(completedRequests.filter((r) => !["topup", "api_topup"].includes(r.plan) && !isApiPlan(r.plan)), baseAmount);
    const webTopupRevenueRp = sum(completedRequests.filter((r) => r.plan === "topup"), baseAmount);
    const apiTopupRevenueRp = sum(completedRequests.filter((r) => r.plan === "api_topup" || isApiPlan(r.plan)), baseAmount);
    const apiTopupUsdMicros = sum(topups, (row) => row.amountUsdMicros);
    const apiUsageRevenueUsdMicros = Math.abs(sum(usageRows, (row) => row.amountUsdMicros));
    const apiOfficialUsdMicros = sum(usageRows, (row) => calculateClaudeOfficialCostUsdMicros({
      model: row.modelUsed,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
    }));
    const estimatedUpstreamCostUsdMicros = Math.ceil(apiOfficialUsdMicros * upstreamPercent / 100);
    const estimatedPaygGrossMarginUsdMicros = apiUsageRevenueUsdMicros - estimatedUpstreamCostUsdMicros;
    const webClaudeOfficialUsdMicros = sum(webClaudeUsageRows, (row) => calculateClaudeOfficialCostUsdMicros({
      model: row.modelUsed,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
    }));
    const estimatedWebClaudeUpstreamUsdMicros = Math.ceil(webClaudeOfficialUsdMicros * webClaudeUpstreamPercent / 100);
    const estimatedWebClaudeUpstreamRp = usdMicrosToIdr(estimatedWebClaudeUpstreamUsdMicros, fxRate);
    const estimatedPaygUpstreamRp = usdMicrosToIdr(estimatedUpstreamCostUsdMicros, fxRate);
    const grossProfitRp = revenueRp - estimatedWebClaudeUpstreamRp - estimatedPaygUpstreamRp;
    const outstandingUsdMicros = sum(subscriptions, (row) => row.apiCreditBalanceUsdMicros);
    const activeApiBalanceUsers = subscriptions.filter((row) => Number(row.apiCreditBalanceUsdMicros || 0) > 0).length;
    const revenueGroups = Object.values(groupRevenue(completedRequests)).sort((a, b) => b.revenueRp - a.revenueRp);

    return NextResponse.json({
      window: { days, since: since.toISOString() },
      assumptions: {
        fxRate,
        upstreamPercentOfOfficial: upstreamPercent,
        webClaudeUpstreamPercentOfOfficial: webClaudeUpstreamPercent,
      },
      totals: {
        activeUsers,
        completedPayments: completedRequests.length,
        revenueRp,
        subscriptionRevenueRp,
        webTopupRevenueRp,
        apiTopupRevenueRp,
        apiTopupUsdMicros,
        apiUsageRevenueUsdMicros,
        apiOfficialUsdMicros,
        estimatedUpstreamCostUsdMicros,
        estimatedPaygGrossMarginUsdMicros,
        webClaudeOfficialUsdMicros,
        estimatedWebClaudeUpstreamUsdMicros,
        estimatedWebClaudeUpstreamRp,
        estimatedPaygUpstreamRp,
        grossProfitRp,
        grossMarginPercent: revenueRp ? Math.round((grossProfitRp / revenueRp) * 1000) / 10 : 0,
        outstandingUsdMicros,
        outstandingRp: usdMicrosToIdr(outstandingUsdMicros, fxRate),
        activeApiBalanceUsers,
      },
      revenueGroups,
      recentPayments: completedRequests.slice(0, 20).map((request) => ({
        id: request.id,
        plan: request.plan,
        billingInterval: request.billingInterval,
        baseAmountRp: baseAmount(request),
        uniqueCode: Number(request.uniqueCode || 0),
        transferAmount: request.transferAmount || 0,
        createdAt: request.createdAt,
      })),
      recentPaygUsage: usageRows.slice(0, 20).map((row) => ({
        id: row.id,
        model: row.modelUsed,
        revenueUsdMicros: Math.abs(row.amountUsdMicros || 0),
        officialUsdMicros: calculateClaudeOfficialCostUsdMicros({ model: row.modelUsed, promptTokens: row.promptTokens, completionTokens: row.completionTokens }),
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
