import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { authenticateAdmin } from "@/lib/auth";
import { hashApiKey, maskApiKey } from "@/lib/security";

export async function POST(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { userId, name } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const currentKeysCount = prisma.apiKey
      ? await prisma.apiKey.count({ where: { userId } })
      : Number((await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "ApiKey" WHERE userId = ?', userId))?.[0]?.count || 0);
    if (currentKeysCount >= 3) {
      return NextResponse.json({ error: "Maximum 3 API keys per user." }, { status: 400 });
    }

    const secureKey = `sk-cai-${crypto.randomBytes(24).toString("hex")}`;
    const storedKey = hashApiKey(secureKey);
    const keyName = name?.trim() || `Admin Generated Key ${currentKeysCount + 1}`;
    const apiKey = prisma.apiKey
      ? await prisma.apiKey.create({
        data: { key: storedKey, name: keyName, userId },
      })
      : await (async () => {
        const id = crypto.randomUUID();
        const createdAt = new Date();
        await prisma.$executeRawUnsafe(
          'INSERT INTO "ApiKey" (id, key, name, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
          id,
          storedKey,
          keyName,
          userId,
          createdAt,
        );
        return { id, key: storedKey, name: keyName, userId, createdAt };
      })();

    return NextResponse.json({ message: "API key created.", key: { ...apiKey, key: secureKey, maskedKey: maskApiKey(secureKey) } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function DELETE(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required." }, { status: 400 });
    }

    if (prisma.apiKey) {
      await prisma.apiKey.delete({ where: { id: keyId } });
    } else {
      await prisma.$executeRawUnsafe('DELETE FROM "ApiKey" WHERE id = ?', keyId);
    }
    return NextResponse.json({ message: "API key revoked." });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
