import { getEffectiveLimits } from "@/app/api/auth/me/route";
import { cancelUsageReservation, finalizeUsageReservation, reserveUsage } from "@/lib/quota";
import { estimateTokens } from "@/lib/security";

export function getImageGatewayConfig() {
  return {
    baseUrl: process.env.IMAGE_RESELLER_BASE_URL || process.env.RESELLER_BASE_URL,
    apiKey: process.env.IMAGE_RESELLER_API_KEY || process.env.RESELLER_API_KEY,
    model: process.env.IMAGE_GENERATION_MODEL || "gpt-image-1",
  };
}

export async function reserveImageUsage({ user, plan, apiKeyId, prompt, source, units }) {
  return reserveUsage({
    userId: user.id,
    model: source,
    source: "api",
    apiKeyId,
    estimatedPromptTokens: estimateTokens(prompt || source),
    estimatedTotalTokens: units,
    limits: getEffectiveLimits(user.subscription),
    plan,
  });
}

export async function finalizeImageUsage({ reservationId, prompt, model, units }) {
  await finalizeUsageReservation({
    reservationId,
    promptTokens: estimateTokens(prompt || model),
    completionTokens: Math.max(1, units - estimateTokens(prompt || model)),
    model,
    reasoningEffort: null,
  });
}

export async function cancelImageUsage(reservationId) {
  if (reservationId) await cancelUsageReservation(reservationId);
}

export function imageGatewayError(message, status = 502) {
  return Response.json({ error: { message, type: "server_error", code: "image_gateway_error" } }, { status });
}
