import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { getAuthCookieOptions, signToken } from "@/lib/auth";

const failedLoginMap = new Map();

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
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (!checkBruteForce(email)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    });

    if (!user || !user.password) {
      recordFailedAttempt(email);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(email);
      return NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    failedLoginMap.delete(email);

    // Check if subscription has expired
    let subscription = user.subscription;
    if (subscription && new Date() > new Date(subscription.expiryDate) && subscription.status === "active") {
      // Update expired subscription
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "expired" },
      });
    }

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
