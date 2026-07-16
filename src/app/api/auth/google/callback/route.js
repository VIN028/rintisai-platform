import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthCookieOptions, signToken } from "@/lib/auth";

const appUrl = (path) => new URL(path, process.env.NEXT_PUBLIC_URL || "http://localhost:3001");

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) return NextResponse.redirect(appUrl("/login?error=no_code"));

    const authCookie = getAuthCookieOptions();
    const stateCookieName = authCookie.secure ? "__Host-google-state" : "google-state";
    const expectedState = req.cookies.get(stateCookieName)?.value;
    if (!state || !expectedState || state !== expectedState) {
      const response = NextResponse.redirect(appUrl("/login?error=invalid_state"));
      response.cookies.delete(stateCookieName);
      return response;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return NextResponse.redirect(appUrl("/login?error=not_configured"));

    const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3001"}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });

    if (!tokenRes.ok) return NextResponse.redirect(appUrl("/login?error=token_failed"));

    const tokens = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) return NextResponse.redirect(appUrl("/login?error=userinfo_failed"));

    const googleUser = await userRes.json();
    if (!googleUser.email) return NextResponse.redirect(appUrl("/login?error=no_email"));

    let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          password: "",
          name: googleUser.name || googleUser.email.split("@")[0],
          subscription: { create: { plan: "free", status: "active", expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } },
        },
      });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 });
    const response = NextResponse.redirect(appUrl("/"));
    response.cookies.delete(stateCookieName);
    response.cookies.set({
      name: authCookie.name,
      value: token,
      httpOnly: true,
      secure: authCookie.secure,
      sameSite: authCookie.sameSite,
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.redirect(appUrl("/login?error=server_error"));
  }
}
