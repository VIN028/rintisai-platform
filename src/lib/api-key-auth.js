import prisma from "@/lib/db";
import { hashApiKey } from "@/lib/security";
import { getActivePlan } from "@/app/api/auth/me/route";
import { validateApiKeyPolicy } from "@/lib/api-key-policy";

export function openAiError(message, type = "invalid_request_error", code = null, status = 400) {
  return Response.json(
    {
      error: {
        message,
        type,
        param: null,
        code,
      },
    },
    { status },
  );
}

export async function authenticateApiKey(req) {
  const authHeader = req.headers.get("Authorization") || "";
  const clientKey = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.substring(7).trim()
    : (req.headers.get("x-api-key") || "").trim();
  if (!clientKey) {
    return { error: openAiError("Incorrect API key provided. Include 'Authorization: Bearer <KEY>' header.", "invalid_request_error", "invalid_api_key", 401) };
  }
  if (!clientKey.startsWith("sk-cai-")) {
    return { error: openAiError("Invalid platform key format. Key must start with 'sk-cai-'.", "invalid_request_error", "invalid_api_key", 401) };
  }

  const keyHash = hashApiKey(clientKey);
  let keyRecord = await prisma.apiKey.findUnique({
    where: { key: keyHash },
    include: { user: { include: { subscription: true } } },
  });

  if (!keyRecord) {
    keyRecord = await prisma.apiKey.findUnique({
      where: { key: clientKey },
      include: { user: { include: { subscription: true } } },
    });
    if (keyRecord) {
      await prisma.apiKey.update({ where: { id: keyRecord.id }, data: { key: keyHash } }).catch(() => {});
    }
  }

  if (!keyRecord?.user) {
    return { error: openAiError("Incorrect API key provided or key has been revoked.", "invalid_request_error", "invalid_api_key", 401) };
  }

  const user = keyRecord.user;
  const plan = getActivePlan(user.subscription);
  const status = user.subscription?.status || "inactive";
  const expiryDate = user.subscription?.expiryDate;

  if (status !== "active" || plan === "inactive" || (expiryDate && new Date(expiryDate) < new Date())) {
    return { error: openAiError("Subscription is expired or inactive. Upgrade plan to resume.", "insufficient_quota", "subscription_expired", 403) };
  }

  if (plan === "free") {
    return { error: openAiError("API access is not enabled for this account.", "insufficient_quota", "api_access_disabled", 403) };
  }
  if (user.subscription?.apiAccessEnabled !== true) {
    return { error: openAiError("API access is disabled for this account.", "insufficient_quota", "api_access_disabled", 403) };
  }
  const policy = await validateApiKeyPolicy({ keyId: keyRecord.id });
  if (policy.error) {
    return { error: openAiError(policy.error, "insufficient_quota", policy.code, policy.status) };
  }

  return { keyRecord, user, plan };
}
