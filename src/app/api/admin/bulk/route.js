import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

export async function PATCH(req) {
  try {
    await authenticateAdmin(req);
    const { userIds, action } = await req.json().catch(() => ({}));

    if (!Array.isArray(userIds) || !userIds.length) {
      return NextResponse.json({ error: "userIds array required" }, { status: 400 });
    }
    if (!["activate", "suspend", "delete", "disable", "enable"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "delete") {
      const admins = await prisma.user.findMany({ where: { id: { in: userIds }, role: "ADMIN" }, select: { id: true } });
      if (admins.length > 0) {
        return NextResponse.json({ error: "Admin users cannot be deleted with bulk delete." }, { status: 400 });
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds }, role: { not: "ADMIN" } } });
    } else if (action === "disable") {
      const adminIds = await prisma.user.findMany({ where: { id: { in: userIds }, role: "ADMIN", disabled: false }, select: { id: true } });
      const totalEnabledAdmins = await prisma.user.count({ where: { role: "ADMIN", disabled: false } });
      if (adminIds.length > 0 && totalEnabledAdmins <= adminIds.length) {
        return NextResponse.json({ error: "Tidak bisa menonaktifkan semua admin." }, { status: 400 });
      }
      await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { disabled: true } });
    } else if (action === "enable") {
      await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { disabled: false } });
    } else {
      const status = action === "activate" ? "active" : "suspended";
      await prisma.subscription.updateMany({
        where: { userId: { in: userIds } },
        data: { status },
      });
    }

    return NextResponse.json({ message: `${userIds.length} users ${action}d` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
