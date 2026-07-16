import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { getAuthCookieOptions, isEmailVerificationRequired, signToken } from "@/lib/auth";
import { expireSubscriptionIfNeeded } from "@/lib/subscription-expiry";

const failedLoginMap = new Map();
const ADMIN_2FA_CODE = process.env.ADMIN_2FA_CODE;

const checkBruteForce = (email) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  if (!failedLoginMap.has(email)) {
    failedLoginMap.set(email, []);
  }

  const attempts = failedLoginMap.get(email).filter((t) => now - t < windowMs);
  failedLoginMap.set(email, attempts);

  if (attempts.length >= maxAttempts) {
    return false;
  }

  return true;
};

const recordFailedAttempt = (email) => {
  const now = Date.now();
  if (!failedLoginMap.has(email)) {
    failedLoginMap.set(email, []);
  }
  failedLoginMap.get(email).push(now);
};

export async function POST(req) {
  try {
    const { email, password, adminOtp, adminOnly } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (!checkBruteForce(normalizedEmail)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // Find user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { subscription: true },
    });

    if (!user || typeof user.password !== "string" || !user.password) {
      recordFailedAttempt(normalizedEmail);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(normalizedEmail);
      return NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    failedLoginMap.delete(normalizedEmail);

    if (adminOnly && user.role !== "ADMIN") {
      return NextResponse.json({ error: "This account does not have admin access." }, { status: 403 });
    }

    if (isEmailVerificationRequired() && !user.emailVerifiedAt) {
      return NextResponse.json(
        {
          error: "Please verify your email first. Check your inbox for the 6-digit code.",
          needsVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    if (user.role === "ADMIN") {
      if (!ADMIN_2FA_CODE) {
        return NextResponse.json({ error: "Admin 2FA is not configured." }, { status: 503 });
      }
      const providedOtp = typeof adminOtp === "string" ? adminOtp.trim() : "";
      if (!providedOtp) {
        return NextResponse.json(
          { message: "Admin 2FA code required.", requiresAdminOtp: true, email: user.email },
          { status: 202 }
        );
      }
      if (providedOtp !== ADMIN_2FA_CODE) {
        recordFailedAttempt(normalizedEmail);
        return NextResponse.json({ error: "Invalid admin 2FA code." }, { status: 401 });
      }
    }

    if (!isEmailVerificationRequired() && user.subscription?.plan === "free" && (user.subscription?.status !== "active" || !user.emailVerifiedAt)) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: user.emailVerifiedAt || new Date() },
        }),
        prisma.subscription.updateMany({
          where: { userId: user.id, plan: "free", status: "inactive" },
          data: { status: "active" },
        }),
      ]);
      user = {
        ...user,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        subscription: {
          ...user.subscription,
          status: "active",
        },
      };
    }

    let subscription = user.subscription;
    subscription = await expireSubscriptionIfNeeded(subscription);

    // Sign JWT
    const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion });

    // Create response
    const response = NextResponse.json({
      message: "Login berhasil.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscription,
      },
    });

    // Set HTTP-Only cookie
    const authCookie = getAuthCookieOptions();
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
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
