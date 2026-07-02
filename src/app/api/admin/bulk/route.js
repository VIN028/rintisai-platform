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
    if (!["activate", "suspend", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "delete") {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
