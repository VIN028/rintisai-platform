import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

const isPostgres = () =>
  process.env.DATABASE_URL?.startsWith("postgresql://") || process.env.DATABASE_URL?.startsWith("postgres://");

const csvCell = (value) => {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const type = new URL(req.url).searchParams.get("type") || "users";

    if (type === "users") {
      const users = await prisma.user.findMany({
        include: { subscription: true },
        orderBy: { createdAt: "desc" },
      });

      const header = "name,email,plan,status,createdAt\n";
      const rows = users.map((u) => [
        csvCell(u.name || ""),
        csvCell(u.email),
        csvCell(u.subscription?.plan || "free"),
        csvCell(u.subscription?.status || "inactive"),
        csvCell(u.createdAt?.toISOString() || ""),
      ].join(",")).join("\n");

      return new NextResponse(header + rows, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=users.csv" },
      });
    }

    if (type === "usage") {
      const dateFilter = isPostgres()
        ? `t."timestamp" >= NOW() - INTERVAL '30 days'`
        : `t."timestamp" >= datetime("now", "-30 days")`;

      const rows = await prisma.$queryRawUnsafe(
        `SELECT u.email, u.name, s.plan, s.status, SUM(t."totalTokens") as total_units, SUM(t."promptTokens") as input, SUM(t."completionTokens") as output, COUNT(*) as requests FROM "TokenUsage" t LEFT JOIN "User" u ON u.id = t."userId" LEFT JOIN "Subscription" s ON s."userId" = t."userId" WHERE ${dateFilter} GROUP BY t."userId" ORDER BY total_units DESC`
      );

      const header = "email,name,plan,status,total_units,input,output,requests\n";
      const csv = rows.map((r) => [
        csvCell(r.email || ""),
        csvCell(r.name || ""),
        csvCell(r.plan || ""),
        csvCell(r.status || ""),
        Number(r.total_units || 0),
        Number(r.input || 0),
        Number(r.output || 0),
        Number(r.requests || 0),
      ].join(",")).join("\n");

      return new NextResponse(header + csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=usage.csv" },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
