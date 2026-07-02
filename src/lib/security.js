import crypto from "crypto";
import { NextResponse } from "next/server";

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

export function modelMultiplier(model) {
  if (model?.includes("5.4") && !model.includes("mini")) return 4;
  if (model?.includes("5.5")) return 7;
  if (model?.includes("claude")) return 12;
  return 1;
}

export function reasoningMultiplier(reasoningEffort) {
  if (reasoningEffort === "xhigh") return 3;
  if (reasoningEffort === "high") return 2;
  if (reasoningEffort === "medium") return 1.4;
  return 1;
}

export function estimateTokens(text) {
  return Math.ceil((text || "").length / 3.8);
}
