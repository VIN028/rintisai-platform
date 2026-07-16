import prisma from "@/lib/db";

export const API_KEY_SCOPES = new Set(["all", "codex", "gpt", "claude", "grok"]);
export const API_KEY_STATUSES = new Set(["active", "disabled"]);

export const API_KEY_SCOPE_LABELS = {
  all: "All model groups",
  codex: "Codex",
  gpt: "Codex",
  claude: "Claude",
  grok: "discontinued",
};

let columnsReady = false;

export function providerForModel(model) {
  const name = String(model || "");
  if (name.startsWith("gpt-") || name.startsWith("gpt-image")) return "codex";
  if (name.startsWith("claude-")) return "claude";
  if (name.startsWith("grok-")) return "grok";
  return "all";
}

export function normalizeApiKeyScope(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  if (normalized === "gpt") return "codex";
  return API_KEY_SCOPES.has(normalized) ? normalized : "all";
}

export function isDeprecatedApiKeyScope(value) {
  return normalizeApiKeyScope(value) === "grok";
}

export function getApiKeyScopeLabel(value) {
  return API_KEY_SCOPE_LABELS[normalizeApiKeyScope(value)] || "Codex";
}

export function normalizeApiKeyStatus(value) {
  const normalized = String(value || "active").trim().toLowerCase();
  return API_KEY_STATUSES.has(normalized) ? normalized : "active";
}

export function normalizeQuotaUsdMicros(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export async function ensureApiKeyMetadataColumns() {
  if (columnsReady) return;
  await prisma.$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN providerScope TEXT NOT NULL DEFAULT \'all\'').catch(() => null);
  await prisma.$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN quotaUsdMicros INTEGER NOT NULL DEFAULT 0').catch(() => null);
  await prisma.$executeRawUnsafe('ALTER TABLE "ApiKey" ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'').catch(() => null);
  columnsReady = true;
}

export async function getApiKeyMetadata(keyId) {
  await ensureApiKeyMetadataColumns();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, providerScope, quotaUsdMicros, status FROM "ApiKey" WHERE id = ?',
    keyId,
  ).catch(() => []);
  const row = rows?.[0] || {};
  return {
    providerScope: normalizeApiKeyScope(row.providerScope),
    quotaUsdMicros: normalizeQuotaUsdMicros(row.quotaUsdMicros),
    status: normalizeApiKeyStatus(row.status),
  };
}

export async function getApiKeyUsageUsdMicros({ keyId, since = null } = {}) {
  if (!keyId) return 0;
  const rows = await prisma.apiCreditLedger.findMany({
    where: {
      apiKeyId: keyId,
      type: "usage",
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: { amountUsdMicros: true },
  }).catch(() => []);
  return rows.reduce((sum, row) => sum + Math.abs(row.amountUsdMicros || 0), 0);
}

export async function validateApiKeyPolicy({ keyId, model = null, estimatedUsdMicros = 0 } = {}) {
  const meta = await getApiKeyMetadata(keyId);
  if (meta.status !== "active") {
    return { error: "This API key is disabled.", code: "api_key_disabled", status: 403, meta };
  }

  if (model) {
    const provider = providerForModel(model);
    if (meta.providerScope !== "all" && provider !== meta.providerScope) {
      return { error: `This API key is scoped to ${getApiKeyScopeLabel(meta.providerScope)} models. Use a matching key or edit the key group.`, code: "api_key_scope_mismatch", status: 403, meta };
    }
  }

  if (meta.quotaUsdMicros > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usedUsdMicros = await getApiKeyUsageUsdMicros({ keyId, since: thirtyDaysAgo });
    if (usedUsdMicros + normalizeQuotaUsdMicros(estimatedUsdMicros) > meta.quotaUsdMicros) {
      return { error: "This API key monthly quota has been reached.", code: "api_key_quota_exceeded", status: 402, meta, usedUsdMicros };
    }
  }

  return { ok: true, meta };
}
