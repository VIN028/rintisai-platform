import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function getDbPath() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  if (!url.startsWith("file:")) return null;
  const filePath = url.slice(5);
  return path.resolve(process.cwd(), filePath);
}

function getBackupDir() {
  return path.resolve(process.cwd(), "backups");
}

async function getCounts() {
  const [users, admins, subscriptions, conversations, messages, apiKeys, tokenUsage, upgradeRequests] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.subscription.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.apiKey.count(),
    prisma.tokenUsage.count(),
    prisma.upgradeRequest.count(),
  ]);

  return { users, admins, subscriptions, conversations, messages, apiKeys, tokenUsage, upgradeRequests };
}

function listBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const dbPath = getDbPath();
    const dbSize = dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    return NextResponse.json({
      counts: await getCounts(),
      database: {
        path: dbPath,
        sizeMB: Math.round((dbSize / 1024 / 1024) * 100) / 100,
      },
      backups: listBackups(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }
}

export async function POST(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { action, email, confirmEmail } = body;

    if (action === "backup") {
      const dbPath = getDbPath();
      if (!dbPath || !fs.existsSync(dbPath)) {
        return NextResponse.json({ error: "SQLite database file not found." }, { status: 500 });
      }

      const dir = getBackupDir();
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const backupName = `dev-${stamp}.db`;
      fs.copyFileSync(dbPath, path.join(dir, backupName));
      return NextResponse.json({ message: "Database backup created.", backup: backupName });
    }

    if (action === "vacuum") {
      await prisma.$executeRawUnsafe("VACUUM");
      return NextResponse.json({ message: "Database vacuum completed." });
    }

    if (action === "resetUsage") {
      if (!email) return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
      if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
      const deleted = await prisma.tokenUsage.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ message: `Usage reset for ${user.email}.`, deleted: deleted.count });
    }

    if (action === "deleteUser") {
      if (!email || confirmEmail !== email) {
        return NextResponse.json({ error: "Email dan konfirmasi email harus sama." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
      if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
      if (user.role === "ADMIN") return NextResponse.json({ error: "Admin user tidak bisa dihapus dari maintenance page." }, { status: 400 });

      await prisma.user.delete({ where: { id: user.id } });
      return NextResponse.json({ message: `User ${user.email} deleted.` });
    }

    return NextResponse.json({ error: "Unknown maintenance action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
