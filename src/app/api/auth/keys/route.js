import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { decryptApiKey, encryptApiKey, hashApiKey, maskApiKey } from "@/lib/security";
import { ensureApiKeyMetadataColumns, getApiKeyUsageUsdMicros, isDeprecatedApiKeyScope, normalizeApiKeyScope, normalizeApiKeyStatus, normalizeQuotaUsdMicros } from "@/lib/api-key-policy";

export async function GET(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);
    
    if (user.subscription?.status !== "active" || user.subscription?.plan === "free" || user.subscription?.apiAccessEnabled !== true) {
      return NextResponse.json(
        { error: "API access is available for active plans with API access." },
        { status: 403 }
      );
    }

    await ensureApiKeyMetadataColumns();
    const keys = await prisma.$queryRawUnsafe(
      "SELECT id, key, name, providerScope, quotaUsdMicros, status, createdAt, CASE WHEN encryptedKey IS NOT NULL AND encryptedKey != '' THEN 1 ELSE 0 END as canCopyFull FROM \"ApiKey\" WHERE userId = ? ORDER BY createdAt DESC",
      user.id,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const enriched = await Promise.all(keys.map(async (key) => ({
      ...key,
      key: maskApiKey(key.key),
      providerScope: normalizeApiKeyScope(key.providerScope),
      quotaUsdMicros: normalizeQuotaUsdMicros(key.quotaUsdMicros),
      status: normalizeApiKeyStatus(key.status),
      canCopyFull: Boolean(key.canCopyFull),
      usageTodayUsdMicros: await getApiKeyUsageUsdMicros({ keyId: key.id, since: today }),
      usage30dUsdMicros: await getApiKeyUsageUsdMicros({ keyId: key.id, since: thirtyDaysAgo }),
    })));

    return NextResponse.json({ keys: enriched });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    if (user.subscription?.status !== "active" || user.subscription?.plan === "free" || user.subscription?.apiAccessEnabled !== true) {
      return NextResponse.json(
        { error: "API access is available for active plans with API access." },
        { status: 403 }
      );
    }

    const currentKeysCount = await prisma.apiKey.count({
      where: { userId: user.id },
    });

    const body = await req.json().catch(() => ({}));
    await ensureApiKeyMetadataColumns();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : `Kunci VS Code ${currentKeysCount + 1}`;
    const providerScope = normalizeApiKeyScope(body.providerScope || "codex");
    if (isDeprecatedApiKeyScope(providerScope)) {
      return NextResponse.json({ error: "Grok model group is no longer available." }, { status: 400 });
    }
    const quotaUsdMicros = normalizeQuotaUsdMicros(body.quotaUsdMicros ?? Math.floor((Number(body.quotaUsd) || 0) * 1_000_000));

    // Generate secure platform key: sk-cai- + 24 random bytes (48 hex chars)
    const secureKey = `sk-cai-${crypto.randomBytes(24).toString("hex")}`;

    const newKey = await prisma.apiKey.create({
      data: {
        key: hashApiKey(secureKey),
        name,
        userId: user.id,
      },
    });
    await prisma.$executeRawUnsafe('UPDATE "ApiKey" SET encryptedKey = ? WHERE id = ?', encryptApiKey(secureKey), newKey.id);
    await prisma.$executeRawUnsafe('UPDATE "ApiKey" SET providerScope = ?, quotaUsdMicros = ?, status = ? WHERE id = ?', providerScope, quotaUsdMicros, "active", newKey.id);

    return NextResponse.json({
      message: "API Key berhasil dibuat.",
      key: {
        id: newKey.id,
        key: secureKey,
        maskedKey: maskApiKey(secureKey),
        name: newKey.name,
        providerScope,
        quotaUsdMicros,
        status: "active",
        createdAt: newKey.createdAt,
      },
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    if (user.subscription?.status !== "active" || user.subscription?.plan === "free" || user.subscription?.apiAccessEnabled !== true) {
      return NextResponse.json(
        { error: "API access is available for active plans with API access." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { keyId, action } = body;
    if (!keyId) {
      return NextResponse.json({ error: "Parameter keyId wajib dilampirkan." }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe('SELECT id, userId, encryptedKey FROM "ApiKey" WHERE id = ?', keyId);
    const keyRecord = rows?.[0];
    if (!keyRecord || keyRecord.userId !== user.id) {
      return NextResponse.json({ error: "API Key tidak ditemukan atau Anda tidak memiliki akses." }, { status: 404 });
    }

    if (action === "update") {
      await ensureApiKeyMetadataColumns();
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : undefined;
      const providerScope = normalizeApiKeyScope(body.providerScope || "codex");
      if (isDeprecatedApiKeyScope(providerScope)) {
        return NextResponse.json({ error: "Grok model group is no longer available." }, { status: 400 });
      }
      const quotaUsdMicros = normalizeQuotaUsdMicros(body.quotaUsdMicros ?? Math.floor((Number(body.quotaUsd) || 0) * 1_000_000));
      const status = normalizeApiKeyStatus(body.status);
      await prisma.$executeRawUnsafe(
        'UPDATE "ApiKey" SET name = COALESCE(?, name), providerScope = ?, quotaUsdMicros = ?, status = ? WHERE id = ?',
        name || null,
        providerScope,
        quotaUsdMicros,
        status,
        keyId,
      );
      return NextResponse.json({ message: "API key updated." });
    }

    if (action === "toggle") {
      await ensureApiKeyMetadataColumns();
      const status = normalizeApiKeyStatus(body.status);
      await prisma.$executeRawUnsafe('UPDATE "ApiKey" SET status = ? WHERE id = ?', status, keyId);
      return NextResponse.json({ message: `API key ${status}.` });
    }

    if (!keyRecord.encryptedKey) {
      return NextResponse.json({ error: "Full key is not available for this older API key. Create a new key to copy it again." }, { status: 409 });
    }

    return NextResponse.json({ key: decryptApiKey(keyRecord.encryptedKey) });
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
