import crypto from "crypto";
import { NextResponse } from "next/server";

function getApiKeyEncryptionSecret() {
  return process.env.API_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || "";
}

export function rejectCrossOriginMutation(req) {
  const method = req.method || "GET";
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;

  const origin = req.headers.get("origin");
  if (!origin) return null;

  const expectedOrigin = req.nextUrl?.origin || new URL(req.url).origin;
  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }

  return null;
}

export function hashApiKey(key) {
  return `sha256:${crypto.createHash("sha256").update(key).digest("hex")}`;
}

export function maskApiKey(value) {
  if (!value) return "";
  if (value.startsWith("sha256:")) return "sk-cai-...";
  if (value.length <= 16) return "sk-cai-...";
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

export function encryptApiKey(value) {
  const secret = getApiKeyEncryptionSecret();
  if (!secret) throw new Error("API key encryption secret is not configured.");
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptApiKey(payload) {
  const secret = getApiKeyEncryptionSecret();
  if (!secret) throw new Error("API key encryption secret is not configured.");
  const [ivText, tagText, encryptedText] = String(payload || "").split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Encrypted API key is invalid.");
  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function modelMultiplier(model, plan = null) {
  const name = String(model || "");
  const planId = String(plan || "");

  if (name === "gpt-5.4-mini") return ["gpt_code", "codex_pro"].includes(planId) ? 6 : 3;
  if (name.includes("5.4") && !name.includes("mini")) return 12;
  if (name.includes("5.5")) return 22;
  if (name === "gpt-5.6-terra") return 18;
  if (name === "gpt-5.6-sol") return 24;

  if (name === "claude-opus") return 30;
  if (name === "claude-sonnet") return 12;
  if (name === "claude-haiku") return 6;
  if (name.includes("claude")) return 12;

  if (name === "grok-build-0.1") return 3;
  if (name === "grok-4.3") return 4;
  if (name === "grok-4.5") return 8;

  return 1;
}

export function outputWeight(model) {
  const name = String(model || "");
  if (name === "gpt-5.6-terra" || name === "gpt-5.6-sol") return 4;
  if (name.startsWith("gpt-") || name.includes("5.4") || name.includes("5.5")) return 5;
  if (name.startsWith("claude-")) return 2;
  if (name.startsWith("grok-") || name === "grok-build-0.1") return 4;
  return 1;
}

export function calculateUsageUnits({ promptTokens = 0, completionTokens = 0, model, plan = null, reasoningEffort = null }) {
  const multiplier = modelMultiplier(model, plan);
  const weightedTokens = Math.max(0, promptTokens) + Math.max(0, completionTokens) * outputWeight(model);
  return Math.ceil(weightedTokens * multiplier * reasoningMultiplier(reasoningEffort));
}

export function reasoningMultiplier(reasoningEffort) {
  if (reasoningEffort === "xhigh") return 2;
  if (reasoningEffort === "high") return 1.4;
  if (reasoningEffort === "medium") return 1.4;
  return 1;
}

export function estimateTokens(text) {
  return Math.ceil((text || "").length / 3.8);
}
