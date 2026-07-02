import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { authenticateUser, AuthError } from "@/lib/auth";

export async function PATCH(req) {
  try {
    const user = await authenticateUser(req);
    const body = await req.json().catch(() => ({}));
    const { name, currentPassword, newPassword } = body;

    const updates = {};

    if (typeof name === "string") {
      const cleanName = name.trim();
      if (cleanName.length < 2) {
        return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
      }
      updates.name = cleanName;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Password lama wajib diisi." }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: "Password lama tidak sesuai." }, { status: 401 });
      }

      updates.password = await bcrypt.hash(newPassword, 10);
      updates.tokenVersion = { increment: 1 };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "Account updated.",
      user: updatedUser,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}
