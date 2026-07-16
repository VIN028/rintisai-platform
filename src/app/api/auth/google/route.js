import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthCookieOptions } from "@/lib/auth";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google SSO not configured" }, { status: 501 });

  const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3001"}/api/auth/google/callback`;
  const scope = "openid email profile";
  const state = crypto.randomBytes(24).toString("hex");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

  const response = NextResponse.redirect(url);
  const authCookie = getAuthCookieOptions();
  response.cookies.set({
    name: authCookie.secure ? "__Host-google-state" : "google-state",
    value: state,
    httpOnly: true,
    secure: authCookie.secure,
    sameSite: authCookie.sameSite,
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
