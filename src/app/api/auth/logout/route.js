import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, getAuthCookieOptions } from "@/lib/auth";

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });

    const response = NextResponse.json({ message: "Signed out." });
    const authCookie = getAuthCookieOptions();
    response.cookies.set({ name: authCookie.name, value: "", httpOnly: true, secure: authCookie.secure, sameSite: authCookie.sameSite, maxAge: 0, path: "/" });
    response.cookies.set({ name: "__Host-token", value: "", httpOnly: true, secure: true, sameSite: "strict", maxAge: 0, path: "/" });
    response.cookies.set({ name: "token", value: "", httpOnly: true, secure: false, sameSite: "lax", maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
