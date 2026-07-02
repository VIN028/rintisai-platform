import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { createVerificationToken, getAuthCookieOptions, isEmailVerificationRequired, signToken } from "@/lib/auth";
import { sendEmail, verifyEmail, welcomeEmail } from "@/lib/email";

const regAttempts = new Map();

export async function POST(req) {
  try {
    const { email, password, name, website } = await req.json();

    if (website) {
      return NextResponse.json({ error: "Registrasi berhasil." }, { status: 201 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";

    if (ip !== "unknown") {
      const now = Date.now();
      const attempts = (regAttempts.get(ip) || []).filter((t) => now - t < 24 * 60 * 60 * 1000);
      if (attempts.length >= 3) {
        return NextResponse.json({ error: "Registration temporarily unavailable. Please try again later." }, { status: 429 });
      }
      attempts.push(now);
      regAttempts.set(ip, attempts);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verification = createVerificationToken();

    // Create user with inactive starter subscription. Admin activates paid access.
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split("@")[0],
        emailVerifyToken: verification.hash,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        emailVerifiedAt: isEmailVerificationRequired() ? null : new Date(),
        subscription: {
          create: {
            plan: "free",
            status: "active",
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { subscription: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: 0 });

    sendEmail({ to: user.email, ...welcomeEmail(user.name) }).catch(() => {});
    sendEmail({ to: user.email, ...verifyEmail(verification.token) }).catch(() => {});

    const response = NextResponse.json(
      {
        message: "Registrasi berhasil.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscription: user.subscription,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      },
      { status: 201 }
    );

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
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
