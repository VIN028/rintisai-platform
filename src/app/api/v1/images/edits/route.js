import { authenticateApiKey, openAiError } from "@/lib/api-key-auth";
import { cancelImageUsage, finalizeImageUsage, getImageGatewayConfig, imageGatewayError, reserveImageUsage } from "@/lib/image-gateway";
import { validateApiKeyPolicy } from "@/lib/api-key-policy";

export const dynamic = "force-dynamic";

const IMAGE_EDIT_UNITS = 40_000;
const MAX_EDIT_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req) {
  const auth = await authenticateApiKey(req);
  if (auth.error) return auth.error;

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return openAiError("Image edits require multipart/form-data.", "invalid_request_error", null, 400);
  }

  const formData = await req.formData().catch(() => null);
  const prompt = formData?.get("prompt");
  if (!formData || typeof prompt !== "string" || !prompt.trim()) {
    return openAiError("Missing required 'prompt' field.", "invalid_request_error", null, 400);
  }
  if (prompt.length > 8_000) {
    return openAiError("Image edit prompt is too large.", "invalid_request_error", null, 400);
  }
  const image = formData.get("image");
  if (!image) {
    return openAiError("Missing required 'image' file.", "invalid_request_error", null, 400);
  }
  if (typeof image.size !== "number" || image.size <= 0 || image.size > MAX_EDIT_IMAGE_BYTES) {
    return openAiError("Image file is too large. Max 8MB.", "invalid_request_error", null, 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type || "")) {
    return openAiError("Unsupported image type. Use PNG, JPEG, or WebP.", "invalid_request_error", null, 400);
  }

  const gateway = getImageGatewayConfig();
  if (!gateway.baseUrl || !gateway.apiKey || gateway.apiKey.startsWith("sk-placeholder")) {
    return imageGatewayError("Image editing is not configured yet.", 501);
  }
  if (!formData.get("model")) formData.set("model", gateway.model);
  const imageModel = String(formData.get("model") || gateway.model);
  const keyPolicy = await validateApiKeyPolicy({ keyId: auth.keyRecord.id, model: imageModel });
  if (keyPolicy.error) return openAiError(keyPolicy.error, "insufficient_quota", keyPolicy.code, keyPolicy.status);
  if (keyPolicy.meta?.quotaUsdMicros > 0) {
    return openAiError("Image endpoints are not available for API keys with per-key USD quota yet. Use an uncapped Codex key or text models.", "invalid_request_error", "api_key_quota_not_supported", 403);
  }

  const reservation = await reserveImageUsage({
    user: auth.user,
    plan: auth.plan,
    apiKeyId: auth.keyRecord.id,
    prompt,
    source: "image-edit",
    units: IMAGE_EDIT_UNITS,
  });
  if (reservation.error) return openAiError(reservation.error, "insufficient_quota", "rate_limit_exceeded", reservation.status);

  let upstream;
  try {
    upstream = await fetch(`${gateway.baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gateway.apiKey}` },
      body: formData,
    });
  } catch (err) {
    await cancelImageUsage(reservation.reservation.id);
    return imageGatewayError(err.name === "AbortError" ? "Image edit gateway timed out." : "Failed to reach image edit gateway.");
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    await cancelImageUsage(reservation.reservation.id);
    return new Response(text || JSON.stringify({ error: { message: "Image edit failed upstream." } }), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  }

  await finalizeImageUsage({ reservationId: reservation.reservation.id, prompt, model: "image-edit", units: IMAGE_EDIT_UNITS }).catch((err) => console.error("Failed to log image edit usage:", err));
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
