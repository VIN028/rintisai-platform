import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google SSO not configured" }, { status: 501 });

  const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3001"}/api/auth/google/callback`;
  const scope = "openid email profile";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(url);
}
