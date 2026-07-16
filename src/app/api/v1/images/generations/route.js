import { authenticateApiKey, openAiError } from "@/lib/api-key-auth";
import { cancelImageUsage, finalizeImageUsage, getImageGatewayConfig, imageGatewayError, reserveImageUsage } from "@/lib/image-gateway";
import { validateApiKeyPolicy } from "@/lib/api-key-policy";

export const dynamic = "force-dynamic";

const IMAGE_GENERATION_UNITS = 30_000;

export async function POST(req) {
  const auth = await authenticateApiKey(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  if (!body.prompt || typeof body.prompt !== "string") {
    return openAiError("Missing required 'prompt' string.", "invalid_request_error", null, 400);
  }
  if (body.prompt.length > 8_000) {
    return openAiError("Image prompt is too large.", "invalid_request_error", null, 400);
  }

  const gateway = getImageGatewayConfig();
  if (!gateway.baseUrl || !gateway.apiKey || gateway.apiKey.startsWith("sk-placeholder")) {
    return imageGatewayError("Image generation is not configured yet.", 501);
  }

  const imageModel = body.model || gateway.model;
  const keyPolicy = await validateApiKeyPolicy({ keyId: auth.keyRecord.id, model: imageModel });
  if (keyPolicy.error) return openAiError(keyPolicy.error, "insufficient_quota", keyPolicy.code, keyPolicy.status);
  if (keyPolicy.meta?.quotaUsdMicros > 0) {
    return openAiError("Image endpoints are not available for API keys with per-key USD quota yet. Use an uncapped Codex key or text models.", "invalid_request_error", "api_key_quota_not_supported", 403);
  }

  const reservation = await reserveImageUsage({
    user: auth.user,
    plan: auth.plan,
    apiKeyId: auth.keyRecord.id,
    prompt: body.prompt,
    source: "image-generation",
    units: IMAGE_GENERATION_UNITS,
  });
  if (reservation.error) return openAiError(reservation.error, "insufficient_quota", "rate_limit_exceeded", reservation.status);

  const payload = {
    ...body,
    model: imageModel,
  };

  let upstream;
  try {
    upstream = await fetch(`${gateway.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gateway.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    await cancelImageUsage(reservation.reservation.id);
    return imageGatewayError(err.name === "AbortError" ? "Image gateway timed out." : "Failed to reach image gateway.");
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    await cancelImageUsage(reservation.reservation.id);
    return new Response(text || JSON.stringify({ error: { message: "Image generation failed upstream." } }), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  }

  await finalizeImageUsage({ reservationId: reservation.reservation.id, prompt: body.prompt, model: "image-generation", units: IMAGE_GENERATION_UNITS }).catch((err) => console.error("Failed to log image generation usage:", err));
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
