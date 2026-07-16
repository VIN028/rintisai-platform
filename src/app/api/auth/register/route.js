import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";
import { createVerificationToken, getAuthCookieOptions, isEmailVerificationRequired, signToken } from "@/lib/auth";
import { sendEmail, verifyEmailCode, welcomeEmail } from "@/lib/email";

const regAttempts = new Map();
const RESERVED_EMAILS = new Set(["admin@rintisai.site"]);
const RESERVED_DOMAINS = new Set(["example.com", "test.local"]);

export async function POST(req) {
  try {
    const { email, password, name, website } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (website) {
      return NextResponse.json({ error: "Registrasi berhasil." }, { status: 201 });
    }

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const emailDomain = normalizedEmail.split("@").pop() || "";
    if (RESERVED_EMAILS.has(normalizedEmail) || RESERVED_DOMAINS.has(emailDomain)) {
      return NextResponse.json({ error: "This email address cannot be used for registration." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";

    if (ip !== "unknown") {
      const now = Date.now();
      const attempts = (regAttempts.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
      if (attempts.length >= 5) {
        return NextResponse.json({ error: "Registration temporarily unavailable. Please try again later." }, { status: 429 });
      }
      attempts.push(now);
      regAttempts.set(ip, attempts);
    }

    const requiresVerification = isEmailVerificationRequired();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (requiresVerification && !existingUser.emailVerifiedAt) {
        return NextResponse.json(
          {
            error: "This email is already registered but not verified yet.",
            needsVerification: true,
            email: normalizedEmail,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Email sudah terdaftar." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verification = requiresVerification ? createVerificationToken(normalizedEmail) : null;

    // Create user with inactive starter subscription. Admin activates paid access.
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || normalizedEmail.split("@")[0],
        emailVerifyToken: verification?.hash || null,
        emailVerifyExpires: verification ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        emailVerifiedAt: requiresVerification ? null : new Date(),
        subscription: {
          create: {
            plan: "free",
            status: requiresVerification ? "inactive" : "active",
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { subscription: true },
    });

    if (requiresVerification && verification) {
      sendEmail({ to: user.email, ...verifyEmailCode(verification.token, user.email) }).catch(() => {});
    }

    if (!requiresVerification) {
      const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: 0 });
      sendEmail({ to: user.email, ...welcomeEmail(user.name) }).catch(() => {});

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
    }

    return NextResponse.json({
      message: "Account created. Check your email for the 6-digit verification code.",
      requiresVerification: true,
      email: user.email,
    }, { status: 201 });
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
