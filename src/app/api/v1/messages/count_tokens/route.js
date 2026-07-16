import { NextResponse } from "next/server";
import { estimateMessagesTokens, contentToText } from "@/lib/context";
import { authenticateApiKey } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

function normalizeMessages(system, messages) {
  const out = [];
  if (system) {
    const systemText = Array.isArray(system) ? system.map((part) => part?.text || "").join("\n") : String(system || "");
    if (systemText.trim()) out.push({ role: "system", content: systemText.trim() });
  }
  for (const message of messages || []) {
    out.push({ role: message.role || "user", content: Array.isArray(message.content) ? message.content.map((part) => part?.text || "").join("\n") : contentToText(message.content) });
  }
  return out;
}

export async function POST(req) {
  const auth = await authenticateApiKey(req);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const inputTokens = estimateMessagesTokens(normalizeMessages(body.system, body.messages));
  return NextResponse.json({ input_tokens: inputTokens });
}
