import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required. Please set it in .env.");
}

const TOKEN_EXPIRY = process.env.JWT_EXPIRY || "7d";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function getAuthCookieOptions() {
  const isHttps = (process.env.NEXT_PUBLIC_URL || "").startsWith("https://");
  return {
    name: isHttps ? "__Host-token" : "token",
    secure: isHttps,
    sameSite: isHttps ? "strict" : "lax",
  };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function isEmailVerificationRequired() {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}

export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashVerificationToken(token) };
}

export function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function authenticateUser(req, { requireActive = false } = {}) {
  const tokenCookie = req.cookies.get("__Host-token") || req.cookies.get("token");
  if (!tokenCookie) throw new AuthError("Not authenticated", 401);

  let decoded;
  try {
    decoded = verifyToken(tokenCookie.value);
  } catch {
    throw new AuthError("Session expired or invalid", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { subscription: true },
  });

  if (!user) throw new AuthError("User not found", 401);

  if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
    throw new AuthError("Session expired — please sign in again", 401);
  }

  if (requireActive) {
    if (user.subscription?.status !== "active") {
      throw new AuthError("Account is not active", 403);
    }
    if (user.subscription?.expiryDate && new Date() > new Date(user.subscription.expiryDate)) {
      throw new AuthError("Subscription has expired", 403);
    }
  }

  return user;
}

export async function requireVerifiedEmail(user) {
  if (!isEmailVerificationRequired()) return;
  if (!user.emailVerifiedAt) throw new AuthError("Email verification required", 403);
}

export async function authenticateAdmin(req) {
  const user = await authenticateUser(req);
  if (user.role !== "ADMIN") throw new AuthError("Admin access required", 403);
  return user;
}

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}
