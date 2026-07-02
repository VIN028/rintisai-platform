import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";
import { sendEmail, upgradeEmail } from "@/lib/email";

export async function GET(req) {
  try {
    await authenticateAdmin(req);

    const requests = prisma.upgradeRequest
      ? await prisma.upgradeRequest.findMany({
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      : await prisma.$queryRawUnsafe(
        'SELECT r.*, u.email as "user.email", u.name as "user.name" FROM "UpgradeRequest" r LEFT JOIN "User" u ON u.id = r."userId" ORDER BY r."createdAt" DESC LIMIT 50',
      ).then((rows) =>
        rows.map((row) => ({
          ...row,
          user: { email: row["user.email"], name: row["user.name"] },
        }))
      );

    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req) {
  try {
    await authenticateAdmin(req);
    const { requestId, status } = await req.json().catch(() => ({}));

    if (!requestId || !["confirmed", "completed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let request;
    if (prisma.upgradeRequest) {
      request = await prisma.upgradeRequest.findUnique({
        where: { id: requestId },
        include: { user: { include: { subscription: true } } },
      });
    } else {
      const rows = await prisma.$queryRawUnsafe(
        'SELECT * FROM "UpgradeRequest" WHERE id = ?',
        requestId,
      );
      if (rows[0]) {
        const user = await prisma.user.findUnique({
          where: { id: rows[0].userId },
          include: { subscription: true },
        });
        request = { ...rows[0], user };
      }
    }

    if (!request) {
      return NextResponse.json({ error: "Upgrade request not found." }, { status: 404 });
    }

    if (status === "completed") {
      if (request.plan === "topup") {
        const topupCredits = { 10000: 2000000, 25000: 5000000, 50000: 12000000 };
        const baseAmount = request.transferAmount ? Math.round((request.transferAmount - Number(request.uniqueCode || 0)) / 1000) * 1000 : 10000;
        const extraCredits = topupCredits[baseAmount] || Math.round(baseAmount * 200);
        
        const sub = request.user?.subscription;
        const currentCustom = sub?.customLimitMonthly || 0;
        
        await prisma.subscription.upsert({
          where: { userId: request.userId },
          create: { userId: request.userId, plan: sub?.plan || "free", status: sub?.status || "active", expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), customLimitMonthly: currentCustom + extraCredits },
          update: { customLimitMonthly: currentCustom + extraCredits },
        });
      } else {
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const apiAccessEnabled = request.plan === "developer";

      await prisma.subscription.upsert({
        where: { userId: request.userId },
        create: {
          userId: request.userId,
          plan: request.plan,
          status: "active",
          expiryDate,
          apiAccessEnabled,
        },
        update: {
          plan: request.plan,
          status: "active",
          expiryDate,
          apiAccessEnabled,
        },
      });
      }
      if (status === "completed" && request.plan !== "topup") {
        const u = request.user;
        if (u?.email) sendEmail({ to: u.email, ...upgradeEmail(request.plan) }).catch(() => {});
      }
    }

    const updated = prisma.upgradeRequest
      ? await prisma.upgradeRequest.update({ where: { id: requestId }, data: { status } })
      : await (async () => {
        await prisma.$executeRawUnsafe('UPDATE "UpgradeRequest" SET status = ? WHERE id = ?', status, requestId);
        return { id: requestId, status };
      })();

    return NextResponse.json({ message: "Upgrade request updated.", request: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
