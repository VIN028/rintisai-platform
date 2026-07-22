import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const { searchParams } = new URL(req.url);
    const rawDays = searchParams.get("days") || "30";
    const days = rawDays === "all" ? null : Math.min(Math.max(Number(rawDays) || 30, 1), 3650);
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const tokenCondition = since ? Prisma.sql`WHERE "timestamp" >= ${since}` : Prisma.sql``;
    const ledgerCondition = since ? Prisma.sql`WHERE "type" = 'usage' AND "createdAt" >= ${since}` : Prisma.sql`WHERE "type" = 'usage'`;
    const recentCondition = since ? Prisma.sql`WHERE t."timestamp" >= ${since}` : Prisma.sql``;
    const ledgerRecentCondition = since ? Prisma.sql`WHERE l."type" = 'usage' AND l."createdAt" >= ${since}` : Prisma.sql`WHERE l."type" = 'usage'`;

    const [totals, recent, userRows, ledgerTotals, ledgerRecent, ledgerUserRows, apiKeys] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM("promptTokens"),0) as "promptTokens", COALESCE(SUM("completionTokens"),0) as "completionTokens", COALESCE(SUM("totalTokens"),0) as "totalTokens", COUNT(*) as "count", COALESCE(SUM(CASE WHEN "source" = 'web' THEN 1 ELSE 0 END),0) as "webCount", COALESCE(SUM(CASE WHEN "source" = 'api' THEN 1 ELSE 0 END),0) as "apiCount" FROM "TokenUsage" ${tokenCondition}`,
      prisma.$queryRaw`SELECT t.id, t."userId", t."modelUsed", t."promptTokens", t."completionTokens", t."totalTokens", t."source", t."timestamp", u.email as "userEmail", u.name as "userName" FROM "TokenUsage" t LEFT JOIN "User" u ON u.id = t."userId" ${recentCondition} ORDER BY t."timestamp" DESC LIMIT 30`,
      prisma.$queryRaw`SELECT "userId", SUM("promptTokens") as "promptTokens", SUM("completionTokens") as "completionTokens", SUM("totalTokens") as "totalTokens", COUNT(*) as "count", SUM(CASE WHEN "source" = 'web' THEN 1 ELSE 0 END) as "webCount", SUM(CASE WHEN "source" = 'api' THEN 1 ELSE 0 END) as "apiCount" FROM "TokenUsage" ${tokenCondition} GROUP BY "userId" ORDER BY SUM("totalTokens") DESC`,
      prisma.$queryRaw`SELECT COALESCE(SUM("promptTokens"),0) as "promptTokens", COALESCE(SUM("completionTokens"),0) as "completionTokens", COALESCE(SUM("promptTokens" + "completionTokens"),0) as "totalTokens", COUNT(*) as "count" FROM "ApiCreditLedger" ${ledgerCondition}`,
      prisma.$queryRaw`SELECT l.id, l."userId", l."modelUsed", l."promptTokens", l."completionTokens", (l."promptTokens" + l."completionTokens") as "totalTokens", 'payg' as "source", l."createdAt" as "timestamp", u.email as "userEmail", u.name as "userName" FROM "ApiCreditLedger" l LEFT JOIN "User" u ON u.id = l."userId" ${ledgerRecentCondition} ORDER BY l."createdAt" DESC LIMIT 30`,
      prisma.$queryRaw`SELECT "userId", SUM("promptTokens") as "promptTokens", SUM("completionTokens") as "completionTokens", SUM("promptTokens" + "completionTokens") as "totalTokens", COUNT(*) as "count" FROM "ApiCreditLedger" ${ledgerCondition} GROUP BY "userId" ORDER BY SUM("promptTokens" + "completionTokens") DESC`,
      prisma.apiKey
        ? prisma.apiKey.findMany({ select: { id: true, userId: true } })
        : prisma.$queryRaw`SELECT id, "userId" FROM "ApiKey"`,
    ]);

    const apiKeyCounts = apiKeys.reduce((acc, key) => {
      acc[key.userId] = (acc[key.userId] || 0) + 1;
      return acc;
    }, {});

    const rowsByUser = new Map();
    for (const row of userRows) {
      const current = rowsByUser.get(row.userId) || { userId: row.userId, promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0, webRequests: 0, apiRequests: 0, paygRequests: 0 };
      current.promptTokens += Number(row.promptTokens || 0);
      current.completionTokens += Number(row.completionTokens || 0);
      current.totalTokens += Number(row.totalTokens || 0);
      current.count += Number(row.count || 0);
      current.webRequests += Number(row.webCount || 0);
      current.apiRequests += Number(row.apiCount || 0);
      rowsByUser.set(row.userId, current);
    }
    for (const row of ledgerUserRows) {
      const current = rowsByUser.get(row.userId) || { userId: row.userId, promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0, webRequests: 0, apiRequests: 0, paygRequests: 0 };
      current.promptTokens += Number(row.promptTokens || 0);
      current.completionTokens += Number(row.completionTokens || 0);
      current.totalTokens += Number(row.totalTokens || 0);
      current.count += Number(row.count || 0);
      current.paygRequests += Number(row.count || 0);
      rowsByUser.set(row.userId, current);
    }
    const combinedUserRows = [...rowsByUser.values()].sort((a, b) => b.totalTokens - a.totalTokens);

    const userIds = [...new Set(combinedUserRows.map((row) => row.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds.length > 0 ? userIds : ["none"] } },
      include: { subscription: true },
    });

    const usersById = Object.fromEntries(users.map((user) => [user.id, user]));

    const totalsRow = totals[0] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };
    const ledgerTotalsRow = ledgerTotals[0] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };
    const combinedRecent = [...recent, ...ledgerRecent]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30);

    return NextResponse.json({
      window: days ? `${days}d` : "all",
      days,
      totals: {
        requests: Number(totalsRow.count) + Number(ledgerTotalsRow.count),
        webRequests: Number(totalsRow.webCount || 0),
        apiRequests: Number(totalsRow.apiCount || 0),
        paygRequests: Number(ledgerTotalsRow.count || 0),
        promptTokens: Number(totalsRow.promptTokens) + Number(ledgerTotalsRow.promptTokens),
        completionTokens: Number(totalsRow.completionTokens) + Number(ledgerTotalsRow.completionTokens),
        usageUnits: Number(totalsRow.totalTokens) + Number(ledgerTotalsRow.totalTokens),
      },
      byUser: combinedUserRows
        .map((row) => ({
          userId: row.userId,
          email: usersById[row.userId]?.email || "Unknown user",
          name: usersById[row.userId]?.name || null,
          plan: usersById[row.userId]?.subscription?.plan || "starter",
          status: usersById[row.userId]?.subscription?.status || "inactive",
          apiKeyCount: apiKeyCounts[row.userId] || 0,
          requests: Number(row.count),
          webRequests: Number(row.webRequests || 0),
          apiRequests: Number(row.apiRequests || 0),
          paygRequests: Number(row.paygRequests || 0),
          promptTokens: Number(row.promptTokens),
          completionTokens: Number(row.completionTokens),
          usageUnits: Number(row.totalTokens),
        })),
      recent: combinedRecent.map((row) => ({
        id: row.id,
        userEmail: row.userEmail,
        userName: row.userName,
        model: row.modelUsed,
        source: row.source || "api",
        promptTokens: Number(row.promptTokens),
        completionTokens: Number(row.completionTokens),
        usageUnits: Number(row.totalTokens),
        timestamp: row.timestamp,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
