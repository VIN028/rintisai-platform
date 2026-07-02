import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const now = new Date();
    const thirtyDaysAgo = now.toISOString().replace("T", " ").slice(0, 19);

    const [totals, recent, userRows, apiKeys] = await Promise.all([
      prisma.$queryRawUnsafe(
        'SELECT COALESCE(SUM("promptTokens"),0) as "promptTokens", COALESCE(SUM("completionTokens"),0) as "completionTokens", COALESCE(SUM("totalTokens"),0) as "totalTokens", COUNT(*) as "count" FROM "TokenUsage" WHERE "source" = \'api\' AND "timestamp" >= ?',
        thirtyDaysAgo,
      ),
      prisma.$queryRawUnsafe(
        'SELECT t.id, t."userId", t."modelUsed", t."promptTokens", t."completionTokens", t."totalTokens", t."timestamp", u.email as "userEmail", u.name as "userName" FROM "TokenUsage" t LEFT JOIN "User" u ON u.id = t."userId" WHERE t."source" = \'api\' AND t."timestamp" >= ? ORDER BY t."timestamp" DESC LIMIT 30',
        thirtyDaysAgo,
      ),
      prisma.$queryRawUnsafe(
        'SELECT "userId", SUM("promptTokens") as "promptTokens", SUM("completionTokens") as "completionTokens", SUM("totalTokens") as "totalTokens", COUNT(*) as "count" FROM "TokenUsage" WHERE "source" = \'api\' AND "timestamp" >= ? GROUP BY "userId" ORDER BY SUM("totalTokens") DESC',
        thirtyDaysAgo,
      ),
      prisma.apiKey
        ? prisma.apiKey.findMany({ select: { id: true, userId: true } })
        : prisma.$queryRawUnsafe('SELECT id, userId FROM "ApiKey"'),
    ]);

    const apiKeyCounts = apiKeys.reduce((acc, key) => {
      acc[key.userId] = (acc[key.userId] || 0) + 1;
      return acc;
    }, {});

    const userIds = [...new Set([...userRows.map((row) => row.userId)])];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds.length > 0 ? userIds : ["none"] } },
      include: { subscription: true },
    });

    const usersById = Object.fromEntries(users.map((user) => [user.id, user]));

    const totalsRow = totals[0] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };

    return NextResponse.json({
      window: "30d",
      totals: {
        requests: Number(totalsRow.count),
        promptTokens: Number(totalsRow.promptTokens),
        completionTokens: Number(totalsRow.completionTokens),
        usageUnits: Number(totalsRow.totalTokens),
      },
      byUser: userRows
        .filter((row) => apiKeyCounts[row.userId] > 0)
        .map((row) => ({
          userId: row.userId,
          email: usersById[row.userId]?.email || "Unknown user",
          name: usersById[row.userId]?.name || null,
          plan: usersById[row.userId]?.subscription?.plan || "starter",
          status: usersById[row.userId]?.subscription?.status || "inactive",
          apiKeyCount: apiKeyCounts[row.userId] || 0,
          requests: Number(row.count),
          promptTokens: Number(row.promptTokens),
          completionTokens: Number(row.completionTokens),
          usageUnits: Number(row.totalTokens),
        })),
      recent: recent.map((row) => ({
        id: row.id,
        userEmail: row.userEmail,
        userName: row.userName,
        model: row.modelUsed,
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
