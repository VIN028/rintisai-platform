import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getActivePlan, getEffectiveLimits } from "@/app/api/auth/me/route";
import { cancelUsageReservation, estimateUsageUnits, finalizeUsageReservation, reserveUsage } from "@/lib/quota";
import { estimateTokens, hashApiKey } from "@/lib/security";
import { buildChatSystemPrompt, estimateMessagesTokens, contentToText } from "@/lib/context";
import { toAnthropicContent } from "@/lib/multimodal";
import { getMaxContextTokens, getMaxOutputTokens, getResellerConfig, isModelAllowedForPlan, normalizeModelId } from "@/lib/models";
import { calculateClaudePaygCostUsdMicros, chargeClaudeApiCredit, getManagedUsdIdrRate, idrToUsdMicros, isClaudeApiPlan, isClaudePaygModel } from "@/lib/claude-payg";
import { validateApiKeyPolicy } from "@/lib/api-key-policy";
import { resolveEntitlementForModel } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
const UPSTREAM_TIMEOUT_MS = 45_000;
const BODY_READ_TIMEOUT_MS = 50_000;
const STREAM_HEARTBEAT_MS = 10_000;
const MIN_COMPLETION_TOKENS = 512;

function withTimeout(promise, ms, message = "Operation timed out") {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(new Error(message), { name: "TimeoutError" })), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function streamHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function startHeartbeat(controller, encoder) {
  const heartbeat = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
    } catch {
      clearInterval(heartbeat);
    }
  }, STREAM_HEARTBEAT_MS);
  return () => clearInterval(heartbeat);
}

function enqueueAnthropicStreamError(controller, encoder, message) {
  controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "api_error", message } })}\n\n`));
}

function fitCompletionTokensToContext({ promptTokens, maxTokens, maxContextTokens }) {
  const available = Math.max(0, Number(maxContextTokens || 0) - Number(promptTokens || 0));
  if (available < MIN_COMPLETION_TOKENS) return { error: true, available };
  return { maxTokens: Math.min(maxTokens, available), available };
}

function anthropicError(message, type = "invalid_request_error", status = 400) {
  return NextResponse.json({ type: "error", error: { type, message } }, { status });
}

function getAuthToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) return authHeader.slice(7).trim();
  return (req.headers.get("x-api-key") || "").trim();
}

async function authenticateApiKey(req) {
  const clientKey = getAuthToken(req);
  if (!clientKey || !clientKey.startsWith("sk-cai-")) {
    throw Object.assign(new Error("Invalid or missing API key."), { status: 401, type: "authentication_error" });
  }

  const keyHash = hashApiKey(clientKey);
  let keyRecord = await prisma.apiKey.findUnique({
    where: { key: keyHash },
    include: { user: { include: { subscription: true } } },
  });
  if (!keyRecord) {
    keyRecord = await prisma.apiKey.findUnique({ where: { key: clientKey }, include: { user: { include: { subscription: true } } } });
    if (keyRecord) await prisma.apiKey.update({ where: { id: keyRecord.id }, data: { key: keyHash } }).catch(() => {});
  }
  if (!keyRecord?.user) {
    throw Object.assign(new Error("Incorrect API key provided or key has been revoked."), { status: 401, type: "authentication_error" });
  }
  return keyRecord;
}

function normalizeAnthropicMessages(system, messages) {
  const normalized = [];
  if (system) {
    const systemText = Array.isArray(system) ? system.map((part) => part?.text || "").join("\n") : String(system || "");
    if (systemText.trim()) normalized.push({ role: "system", content: systemText.trim() });
  }
  for (const message of messages || []) {
    normalized.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }
  return normalized;
}

export async function POST(req) {
  try {
    const keyRecord = await authenticateApiKey(req);
    const user = keyRecord.user;
    const accountPlan = getActivePlan(user.subscription);
    const status = user.subscription?.status || "inactive";
    const expiryDate = user.subscription?.expiryDate;
    if (status !== "active" || accountPlan === "inactive" || (expiryDate && new Date(expiryDate) < new Date())) {
      return anthropicError("Subscription is expired or inactive. Upgrade plan to resume.", "permission_error", 403);
    }
    if (accountPlan === "free") {
      return anthropicError("API access is not enabled for this account.", "permission_error", 403);
    }
    if (user.subscription?.apiAccessEnabled !== true) {
      return anthropicError("API access is disabled for this account.", "permission_error", 403);
    }

    const body = await req.json().catch(() => ({}));
    const selectedModel = normalizeModelId(body.model);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const entitlementAccess = isClaudeApiPlan(accountPlan)
      ? { plan: accountPlan, limits: getEffectiveLimits(user.subscription) }
      : await resolveEntitlementForModel({ userId: user.id, subscription: user.subscription, model: selectedModel, fallbackPlan: accountPlan });
    const plan = entitlementAccess.plan;
    const limits = entitlementAccess.limits || getEffectiveLimits(user.subscription);
    let maxTokens = getMaxOutputTokens(selectedModel, plan, body.max_tokens);
    const stream = body.stream === true;
    if (!selectedModel || messages.length === 0) return anthropicError("Missing model or messages.");
    const scopePolicy = await validateApiKeyPolicy({ keyId: keyRecord.id, model: selectedModel });
    if (scopePolicy.error) return anthropicError(scopePolicy.error, "permission_error", scopePolicy.status);
    if (!isModelAllowedForPlan(selectedModel, plan)) return anthropicError("This model requires a higher plan. Upgrade to access.", "permission_error", 403);
    if (isClaudeApiPlan(plan) && !isClaudePaygModel(selectedModel)) return anthropicError("API PAYG accounts can only use supported PAYG models.", "permission_error", 403);
    if (maxTokens <= 0) return anthropicError("This model is not available for your plan.", "permission_error", 403);

    const reseller = getResellerConfig(selectedModel);
    if (reseller.type !== "anthropic") {
      return anthropicError("This Anthropic-compatible endpoint supports Claude models. Use /api/v1/chat/completions for GPT models.", "invalid_request_error", 400);
    }
    const providerPool = reseller.providerPool || "kiro";

    const normalizedMessages = normalizeAnthropicMessages(body.system, messages);
    const promptTokens = estimateMessagesTokens(normalizedMessages);
    const promptText = normalizedMessages.map((message) => `${message.role || "user"}: ${contentToText(message.content)}`).join("\n");
    const fittedCompletion = fitCompletionTokensToContext({ promptTokens, maxTokens, maxContextTokens: getMaxContextTokens(selectedModel, plan) });
    if (fittedCompletion.error) {
      return anthropicError("Request exceeds your plan context limit. Start a new session, reduce workspace context, or upgrade for a larger context window.", "invalid_request_error", 400);
    }
    maxTokens = fittedCompletion.maxTokens;
    let reservationId = null;
    if (isClaudeApiPlan(plan)) {
      const estimatedCostUsdMicros = calculateClaudePaygCostUsdMicros({ model: selectedModel, promptTokens, completionTokens: maxTokens });
      const quotaPolicy = await validateApiKeyPolicy({ keyId: keyRecord.id, model: selectedModel, estimatedUsdMicros: estimatedCostUsdMicros });
      if (quotaPolicy.error) return anthropicError(quotaPolicy.error, quotaPolicy.code === "api_key_quota_exceeded" ? "rate_limit_error" : "permission_error", quotaPolicy.status);
      const balanceUsdMicros = (user.subscription?.apiCreditBalanceUsdMicros || 0) + idrToUsdMicros(user.subscription?.apiCreditBalanceRp || 0, await getManagedUsdIdrRate());
      if (balanceUsdMicros < estimatedCostUsdMicros) return anthropicError("Insufficient API credit balance. Top up to continue.", "permission_error", 402);
    } else {
      const reservationResult = await reserveUsage({
        userId: user.id,
        model: selectedModel,
        source: "api",
        apiKeyId: keyRecord.id,
        estimatedPromptTokens: promptTokens,
        estimatedTotalTokens: estimateUsageUnits({ promptText, model: selectedModel, maxTokens, reasoningEffort: null, plan }),
        limits,
        plan,
        packageId: limits.packageId || null,
      });
      if (reservationResult.error) return anthropicError(reservationResult.error, "rate_limit_error", reservationResult.status || 429);
      reservationId = reservationResult.reservation.id;
    }

    const resellerApiKey = user.assignedApiKey && !user.assignedApiKey.startsWith("sk-placeholder") ? user.assignedApiKey : reseller.apiKey;
    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      await cancelUsageReservation(reservationId);
      return anthropicError("Server gateway API credentials not configured.", "api_error", 500);
    }

    const userSystemPrompt = normalizedMessages.filter((message) => message.role === "system").map((message) => contentToText(message.content)).join("\n\n");
    const systemPrompt = [buildChatSystemPrompt(selectedModel, promptText), userSystemPrompt].filter(Boolean).join("\n\n");
    const anthropicMessages = normalizedMessages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(message.content) }));
    const upstreamPayload = {
      model: reseller.upstreamModel || selectedModel,
      system: systemPrompt || undefined,
      messages: anthropicMessages,
      max_tokens: maxTokens,
      stream,
      tools: Array.isArray(body.tools) ? body.tools : undefined,
      tool_choice: body.tool_choice || undefined,
      stop_sequences: body.stop_sequences || undefined,
      temperature: body.temperature,
      top_p: body.top_p,
      metadata: body.metadata || undefined,
      thinking: body.thinking || undefined,
    };

    const saveUsage = async ({ inputTokens, outputTokens }) => {
      if (isClaudeApiPlan(plan)) {
        await chargeClaudeApiCredit({ userId: user.id, model: selectedModel, promptTokens: inputTokens, completionTokens: outputTokens, apiKeyId: keyRecord.id, providerPool, fallbackUsed: false });
      } else {
        await finalizeUsageReservation({ reservationId, promptTokens: inputTokens, completionTokens: outputTokens, model: selectedModel, reasoningEffort: null, providerPool, fallbackUsed: false, plan });
      }
    };

    if (stream) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const outputStream = new ReadableStream({
        async start(outController) {
          let controllerClosed = false;
          const safeClose = () => {
            if (controllerClosed) return;
            controllerClosed = true;
            try { outController.close(); } catch {}
          };
          const safeEnqueue = (value) => {
            if (controllerClosed) return false;
            try {
              outController.enqueue(typeof value === "string" ? encoder.encode(value) : value);
              return true;
            } catch {
              controllerClosed = true;
              return false;
            }
          };
          safeEnqueue(`: rintisai-start ${Date.now()}\n\n`);
          const stopHeartbeat = startHeartbeat(outController, encoder);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
          let inputTokens = promptTokens;
          let outputTokens = 0;
          let sseBuffer = "";

          const processEvent = (eventText) => {
            const dataLines = eventText
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.replace(/^data:\s*/, ""));
            for (const dataLine of dataLines) {
              if (dataLine === "[DONE]") return true;
              try {
                const parsed = JSON.parse(dataLine);
                if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) inputTokens = parsed.message.usage.input_tokens;
                if (parsed.type === "message_delta" && parsed.usage?.output_tokens) outputTokens = parsed.usage.output_tokens;
              } catch {}
            }
            return false;
          };

          try {
            const upstream = await fetch(`${reseller.baseUrl}/messages`, {
              method: "POST",
              headers: { Authorization: `Bearer ${resellerApiKey}`, "Content-Type": "application/json", "anthropic-version": req.headers.get("anthropic-version") || "2023-06-01" },
              signal: controller.signal,
              body: JSON.stringify({ ...upstreamPayload, stream: true }),
            });

            if (!upstream.ok) {
              const errText = await withTimeout(upstream.text(), 5_000, "Upstream error read timed out").catch(() => "");
              console.error("Anthropic-compatible streaming upstream error:", String(errText).slice(0, 500));
              await cancelUsageReservation(reservationId);
              enqueueAnthropicStreamError(outController, encoder, "Current model is temporarily unavailable. Try again later or choose another model.");
              return;
            }

            const reader = upstream.body.getReader();
            let streamDone = false;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              safeEnqueue(value);
              sseBuffer += chunk;
              const events = sseBuffer.split("\n\n");
              sseBuffer = events.pop() || "";
              for (const eventText of events) {
                streamDone = processEvent(eventText);
                if (streamDone) break;
              }
              if (streamDone) break;
            }
            if (!streamDone && sseBuffer.trim()) processEvent(sseBuffer);

            try {
              await saveUsage({ inputTokens, outputTokens: outputTokens || 1 });
            } catch (dbErr) {
              console.error("Failed to save Anthropic-compatible streaming usage:", dbErr);
            }
          } catch (err) {
            await cancelUsageReservation(reservationId);
            const timedOut = err?.name === "AbortError" || err?.name === "TimeoutError";
            enqueueAnthropicStreamError(outController, encoder, timedOut ? "AI server timed out before sending content. Retry the request." : "Failed to reach AI server. Retry the request.");
          } finally {
            clearTimeout(timeout);
            stopHeartbeat();
            safeClose();
          }
        },
      });
      return new Response(outputStream, { headers: streamHeaders() });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let upstream;
    try {
      upstream = await fetch(`${reseller.baseUrl}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resellerApiKey}`, "Content-Type": "application/json", "anthropic-version": req.headers.get("anthropic-version") || "2023-06-01" },
        signal: controller.signal,
        body: JSON.stringify(upstreamPayload),
      });
    } catch (err) {
      await cancelUsageReservation(reservationId);
      return anthropicError("Current model is temporarily unavailable. Try again later or choose another model.", "api_error", err.name === "AbortError" ? 504 : 503);
    } finally {
      clearTimeout(timeout);
    }
    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Anthropic-compatible upstream error:", errText.slice(0, 500));
      await cancelUsageReservation(reservationId);
      return anthropicError("Current model is temporarily unavailable. Try again later or choose another model.", "api_error", upstream.status >= 500 ? 503 : 502);
    }

    if (stream) {
      const decoder = new TextDecoder();
      const reader = upstream.body.getReader();
      let inputTokens = promptTokens;
      let outputTokens = 0;
      let sseBuffer = "";

      const processEvent = (eventText) => {
        const dataLines = eventText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""));
        for (const dataLine of dataLines) {
          try {
            const parsed = JSON.parse(dataLine);
            if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) inputTokens = parsed.message.usage.input_tokens;
            if (parsed.type === "message_delta" && parsed.usage?.output_tokens) outputTokens = parsed.usage.output_tokens;
          } catch {}
        }
      };

      const outputStream = new ReadableStream({
        async start(outController) {
          let controllerClosed = false;
          const safeClose = () => {
            if (controllerClosed) return;
            controllerClosed = true;
            try { outController.close(); } catch {}
          };
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              try {
                outController.enqueue(value);
              } catch {
                controllerClosed = true;
                break;
              }
              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split("\n\n");
              sseBuffer = events.pop() || "";
              for (const eventText of events) processEvent(eventText);
            }
            if (sseBuffer.trim()) processEvent(sseBuffer);
          } catch (err) {
            console.error("Anthropic-compatible stream error:", err);
          } finally {
            try {
              await saveUsage({ inputTokens, outputTokens: outputTokens || 1 });
            } catch (dbErr) {
              console.error("Failed to save Anthropic-compatible usage:", dbErr);
            }
            safeClose();
          }
        },
        cancel() {
          reader.cancel().catch(() => {});
        },
      });
      return new Response(outputStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
    }

    const upstreamData = await withTimeout(upstream.json(), BODY_READ_TIMEOUT_MS, "Anthropic response body timed out");
    const actualPrompt = upstreamData.usage?.input_tokens || promptTokens;
    const actualCompletion = upstreamData.usage?.output_tokens || estimateTokens((upstreamData.content || []).map((part) => part?.text || "").join(""));
    await saveUsage({ inputTokens: actualPrompt, outputTokens: actualCompletion });

    const id = upstreamData.id || `msg_${Date.now()}`;
    const usage = { input_tokens: actualPrompt, output_tokens: actualCompletion };
    const stopReason = upstreamData.stop_reason || "end_turn";
    return NextResponse.json({ ...upstreamData, id, type: "message", role: "assistant", model: body.model || selectedModel, stop_reason: stopReason, usage });
  } catch (err) {
    return anthropicError(err.message || "Server error.", err.type || "api_error", err.status || 500);
  }
}
