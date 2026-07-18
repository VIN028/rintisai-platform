import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

const isPostgres = () =>
  process.env.DATABASE_URL?.startsWith("postgresql://") || process.env.DATABASE_URL?.startsWith("postgres://");

const getDbSize = async () => {
  if (isPostgres()) {
    const r = await prisma.$queryRawUnsafe("SELECT pg_database_size(current_database()) as size");
    return Number(r[0]?.size || 0);
  }
  const r = await prisma.$queryRawUnsafe("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
  return Number(r[0]?.size || 0);
};

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const [userCount, dbSize, requests24h, recent] = await Promise.all([
      prisma.user.count(),
      getDbSize(),
      prisma.tokenUsage.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.tokenUsage.aggregate({ where: { timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } }, _count: true, _sum: { totalTokens: true } }),
    ]);

    return NextResponse.json({
      uptime: Math.floor(process.uptime()),
      users: userCount,
      dbSizeMB: Math.round(Number(dbSize) / 1024 / 1024 * 100) / 100,
      requests24h,
      requests5m: recent._count || 0,
      tokens5m: recent._sum?.totalTokens || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
