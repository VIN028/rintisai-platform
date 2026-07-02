import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { hashApiKey, maskApiKey } from "@/lib/security";

export async function GET(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);
    
    // API Keys only allowed when enabled by admin for Developer tier.
    if (user.subscription?.status !== "active" || user.subscription?.plan !== "developer" || !user.subscription?.apiAccessEnabled) {
      return NextResponse.json(
        { error: "API keys are only available for active Developer plans." },
        { status: 403 }
      );
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        key: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys: keys.map((key) => ({ ...key, key: maskApiKey(key.key) })) });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    if (user.subscription?.status !== "active" || user.subscription?.plan !== "developer" || !user.subscription?.apiAccessEnabled) {
      return NextResponse.json(
        { error: "API keys are only available for active Developer plans." },
        { status: 403 }
      );
    }

    const currentKeysCount = await prisma.apiKey.count({
      where: { userId: user.id },
    });

    if (currentKeysCount >= 3) {
      return NextResponse.json(
        { error: "Maksimal 3 API Key yang diijinkan per user." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = body.name || `Kunci VS Code ${currentKeysCount + 1}`;

    // Generate secure platform key: sk-cai- + 24 random bytes (48 hex chars)
    const secureKey = `sk-cai-${crypto.randomBytes(24).toString("hex")}`;

    const newKey = await prisma.apiKey.create({
      data: {
        key: hashApiKey(secureKey),
        name,
        userId: user.id,
      },
    });

    return NextResponse.json({
      message: "API Key berhasil dibuat.",
      key: {
        id: newKey.id,
        key: secureKey,
        maskedKey: maskApiKey(secureKey),
        name: newKey.name,
        createdAt: newKey.createdAt,
      },
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(req) {
  try {
    const user = await authenticateUser(req);

    const body = await req.json().catch(() => ({}));
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json(
        { error: "Parameter keyId wajib dilampirkan." },
        { status: 400 }
      );
    }

    // Verify key ownership before deleting
    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey || existingKey.userId !== user.id) {
      return NextResponse.json(
        { error: "API Key tidak ditemukan atau Anda tidak memiliki akses." },
        { status: 404 }
      );
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    return NextResponse.json({ message: "API Key berhasil dihapus/direvoke." });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}
