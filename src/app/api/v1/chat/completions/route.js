import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getActivePlan, getEffectiveLimits } from "@/app/api/auth/me/route";
import { cancelUsageReservation, estimateUsageUnits, finalizeUsageReservation, getBillableReasoningEffort, reserveUsage } from "@/lib/quota";
import { estimateTokens, hashApiKey } from "@/lib/security";
import { ALLOWED_MODELS, getMaxContextTokens, getMaxOutputTokens, getResellerConfig, isModelAllowedForPlan, normalizeModelId, normalizeReasoningEffort, supportsVisionInput, toUpstreamReasoningEffort } from "@/lib/models";
import { buildChatSystemPrompt, contentToText, estimateMessagesTokens, sanitizeAssistantContent } from "@/lib/context";
import { appendTextToContent, fetchUrlContextsFromText, formatFetchedUrlContext } from "@/lib/url-fetch";
import { toAnthropicContent } from "@/lib/multimodal";
import { calculateClaudePaygCostUsdMicros, chargeClaudeApiCredit, getManagedUsdIdrRate, idrToUsdMicros, isClaudeApiPlan, isClaudePaygModel } from "@/lib/claude-payg";
import { validateApiKeyPolicy } from "@/lib/api-key-policy";
import { resolveEntitlementForModel } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
const UPSTREAM_TIMEOUT_MS = 45_000;
const BODY_READ_TIMEOUT_MS = 50_000;
const STREAM_HEARTBEAT_MS = 10_000;
const MIN_COMPLETION_TOKENS = 512;

// Standard OpenAI format error helper
function openAiError(message, type = "invalid_request_error", code = null, status = 400) {
  return NextResponse.json(
    {
      error: {
        message,
        type,
        param: null,
        code,
      },
    },
    { status }
  );
}

function isRetryableUpstreamStatus(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

function withTimeout(promise, ms, message = "Operation timed out") {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(new Error(message), { name: "TimeoutError" })), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function sseHeaders() {
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

function enqueueSseError(controller, encoder, message, code = "gateway_error") {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message, type: "server_error", param: null, code } })}\n\n`));
  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
}

function toOpenAiFinishReason(reason) {
  if (reason === "max_tokens") return "length";
  if (reason === "tool_use" || reason === "function_call") return "tool_calls";
  return "stop";
}

function getUsageProviderPool(reseller) {
  if (reseller.providerPool) return reseller.providerPool;
  return reseller.type === "anthropic" ? "kiro" : "plus";
}

function fitCompletionTokensToContext({ promptTokens, maxTokens, maxContextTokens }) {
  const available = Math.max(0, Number(maxContextTokens || 0) - Number(promptTokens || 0));
  if (available < MIN_COMPLETION_TOKENS) return { error: true, available };
  return { maxTokens: Math.min(maxTokens, available), available };
}

function getOpenAiTools(body) {
  return Array.isArray(body?.tools) ? body.tools.filter((tool) => tool?.type === "function" && tool.function?.name) : [];
}

function toAnthropicTools(openAiTools) {
  return openAiTools.map((tool) => ({
    name: String(tool.function.name),
    description: tool.function.description ? String(tool.function.description) : undefined,
    input_schema: tool.function.parameters && typeof tool.function.parameters === "object"
      ? tool.function.parameters
      : { type: "object", properties: {} },
  }));
}

function toAnthropicToolChoice(choice) {
  if (!choice || choice === "auto") return undefined;
  if (choice === "required") return { type: "any" };
  if (choice === "none") return undefined;
  const name = choice?.function?.name;
  if (choice?.type === "function" && name) return { type: "tool", name: String(name) };
  return undefined;
}

function fromAnthropicToolUses(contentParts) {
  return (contentParts || [])
    .filter((part) => part?.type === "tool_use" && part.id && part.name)
    .map((part) => ({
      id: String(part.id),
      type: "function",
      function: {
        name: String(part.name),
        arguments: JSON.stringify(part.input || {}),
      },
    }));
}

function fromAnthropicText(contentParts) {
  return sanitizeAssistantContent((contentParts || [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text || "")
    .join("")
    .trim());
}

function parseToolArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function openAiMessageToAnthropic(message) {
  if (message.role === "tool") {
    return {
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: String(message.tool_call_id || message.id || "tool_call"),
        content: typeof message.content === "string" ? message.content : JSON.stringify(message.content || ""),
      }],
    };
  }

  if (message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const content = [];
    if (typeof message.content === "string" && message.content.trim()) content.push({ type: "text", text: message.content });
    for (const call of message.tool_calls) {
      if (call?.type !== "function" || !call.function?.name) continue;
      content.push({
        type: "tool_use",
        id: String(call.id || `tool_${content.length}`),
        name: String(call.function.name),
        input: parseToolArguments(call.function.arguments),
      });
    }
    return { role: "assistant", content };
  }

  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: toAnthropicContent(message.content),
  };
}

export async function POST(req) {
  try {
    // 1. Authenticate API Key from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return openAiError("Incorrect API key provided. Include 'Authorization: Bearer <KEY>' header.", "invalid_request_error", "invalid_api_key", 401);
    }

    const clientKey = authHeader.substring(7).trim();
    if (!clientKey.startsWith("sk-cai-")) {
      return openAiError("Invalid platform key format. Key must start with 'sk-cai-'.", "invalid_request_error", "invalid_api_key", 401);
    }

    const keyHash = hashApiKey(clientKey);
    let keyRecord = await prisma.apiKey.findUnique({
      where: { key: keyHash },
      include: {
        user: {
          include: { subscription: true },
        },
      },
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

    if (!keyRecord || !keyRecord.user) {
      return openAiError("Incorrect API key provided or key has been revoked.", "invalid_request_error", "invalid_api_key", 401);
    }

    const user = keyRecord.user;
    const userId = user.id;
    const accountPlan = getActivePlan(user.subscription);
    const status = user.subscription?.status || "inactive";
    const expiryDate = user.subscription?.expiryDate;

    // Check expiry
    if (status !== "active" || accountPlan === "inactive" || (expiryDate && new Date(expiryDate) < new Date())) {
      return openAiError("Subscription is expired or inactive. Upgrade plan to resume.", "insufficient_quota", "subscription_expired", 403);
    }

    if (accountPlan === "free") {
      return openAiError("API access is not enabled for this account.", "insufficient_quota", "api_access_disabled", 403);
    }
    if (user.subscription?.apiAccessEnabled !== true) {
      return openAiError("API access is disabled for this account.", "insufficient_quota", "api_access_disabled", 403);
    }

    // 3. Parse input body
    const body = await req.json().catch(() => ({}));
    const { model, messages, stream = false, reasoning_effort } = body;
    const openAiTools = getOpenAiTools(body);
    const requestedReasoningEffort = normalizeReasoningEffort(reasoning_effort);
    const upstreamReasoningEffort = toUpstreamReasoningEffort(requestedReasoningEffort);

    if (!model || !messages || !Array.isArray(messages)) {
      return openAiError("Missing 'model' or 'messages' array in request body.", "invalid_request_error", null, 400);
    }
    if (messages.length > 300) {
      return openAiError("Too many messages in request body.", "invalid_request_error", null, 400);
    }
    if (JSON.stringify(messages).length > 2_500_000) {
      return openAiError("Request messages are too large.", "invalid_request_error", null, 400);
    }

    // Determine model mapping to select correct pricing credit weight
    const selectedModel = normalizeModelId(model);
    if (!ALLOWED_MODELS.has(selectedModel)) {
      return openAiError("Selected model is not available on this platform.", "invalid_request_error", "model_not_found", 400);
    }

    const scopePolicy = await validateApiKeyPolicy({ keyId: keyRecord.id, model: selectedModel });
    if (scopePolicy.error) {
      return openAiError(scopePolicy.error, "insufficient_quota", scopePolicy.code, scopePolicy.status);
    }

    const entitlementAccess = isClaudeApiPlan(accountPlan)
      ? { plan: accountPlan, limits: getEffectiveLimits(user.subscription) }
      : await resolveEntitlementForModel({ userId, subscription: user.subscription, model: selectedModel, fallbackPlan: accountPlan });
    const plan = entitlementAccess.plan;
    const limits = entitlementAccess.limits || getEffectiveLimits(user.subscription);

    if (!isModelAllowedForPlan(selectedModel, plan)) {
      return openAiError("This model requires a higher plan. Upgrade to access.", "insufficient_quota", "model_not_allowed", 403);
    }
    if (isClaudeApiPlan(plan) && !isClaudePaygModel(selectedModel)) {
      return openAiError("API PAYG accounts can only use supported PAYG models.", "invalid_request_error", "model_not_allowed", 403);
    }
    const hasImageInput = messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part?.type === "image_url"));
    if (hasImageInput && !supportsVisionInput(selectedModel)) {
      return openAiError("Image understanding is not available for this model yet. Use text prompts for now.", "invalid_request_error", "vision_not_available", 400);
    }
    const billableReasoningEffort = getBillableReasoningEffort({
      model: selectedModel,
      plan,
      source: "api",
      requestedReasoningEffort,
    });
    let maxTokens = getMaxOutputTokens(selectedModel, plan, body.max_tokens);
    const maxContextTokens = getMaxContextTokens(selectedModel, plan);
    if (maxTokens <= 0) {
      return openAiError("This model is not available for your plan.", "insufficient_quota", "model_not_allowed", 403);
    }

    // Reseller credentials
    const reseller = getResellerConfig(selectedModel);
    const resellerBaseUrl = reseller.baseUrl;
    const usageProviderPool = getUsageProviderPool(reseller);

    let resellerApiKey = user.assignedApiKey;
    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      resellerApiKey = reseller.apiKey;
    }

    // 4. Construct payload for reseller
    const originalPromptText = messages.map((message) => `${message.role || "user"}: ${contentToText(message.content)}`).join("\n");
    const fetchedUrlContexts = await fetchUrlContextsFromText(originalPromptText);
    const fetchedUrlText = formatFetchedUrlContext(fetchedUrlContexts);
    const fetchedUrlPrompt = fetchedUrlText
      ? `The user asked about external URL content. Use this fetched web context when answering. If a fetch error is shown, be transparent and continue with available information.\n\n${fetchedUrlText}`
      : "";
    const upstreamMessages = fetchedUrlPrompt
      ? messages.map((message, index) => index === messages.length - 1 ? { ...message, content: appendTextToContent(message.content, fetchedUrlPrompt) } : message)
      : messages;
    const promptText = upstreamMessages.map((message) => `${message.role || "user"}: ${contentToText(message.content)}`).join("\n");
    const fallbackPromptTokens = estimateMessagesTokens(upstreamMessages);
    const fittedCompletion = fitCompletionTokensToContext({ promptTokens: fallbackPromptTokens, maxTokens, maxContextTokens });
    if (fittedCompletion.error) {
      return openAiError("Request exceeds your plan context limit. Start a new session, reduce workspace context, or upgrade for a larger context window.", "invalid_request_error", "context_length_exceeded", 400);
    }
    maxTokens = fittedCompletion.maxTokens;

    let reservationId = null;
    if (isClaudeApiPlan(plan)) {
      const estimatedCostUsdMicros = calculateClaudePaygCostUsdMicros({ model: selectedModel, promptTokens: fallbackPromptTokens, completionTokens: maxTokens });
      const quotaPolicy = await validateApiKeyPolicy({ keyId: keyRecord.id, model: selectedModel, estimatedUsdMicros: estimatedCostUsdMicros });
      if (quotaPolicy.error) {
        return openAiError(quotaPolicy.error, "insufficient_quota", quotaPolicy.code, quotaPolicy.status);
      }
      const balanceUsdMicros = (user.subscription?.apiCreditBalanceUsdMicros || 0) + idrToUsdMicros(user.subscription?.apiCreditBalanceRp || 0, await getManagedUsdIdrRate());
      if (balanceUsdMicros < estimatedCostUsdMicros) {
        return openAiError("Insufficient API credit balance. Top up to continue.", "insufficient_quota", "insufficient_api_credit", 402);
      }
    } else {
      const reservationResult = await reserveUsage({
        userId,
        model: selectedModel,
        source: "api",
        apiKeyId: keyRecord.id,
        estimatedPromptTokens: fallbackPromptTokens,
        estimatedTotalTokens: estimateUsageUnits({ promptText, model: selectedModel, maxTokens, reasoningEffort: billableReasoningEffort, plan }),
        limits,
        plan,
        packageId: limits.packageId || null,
      });
      if (reservationResult.error) {
        return openAiError(reservationResult.error, "insufficient_quota", "rate_limit_exceeded", reservationResult.status);
      }
      reservationId = reservationResult.reservation.id;
    }

    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      if (reservationId) await cancelUsageReservation(reservationId);
      return openAiError("Server gateway API credentials not configured by administrator.", "server_error", "config_error", 500);
    }

    if (reseller.type === "anthropic") {
      const userSystemPrompt = upstreamMessages
        .filter((message) => message.role === "system")
        .map((message) => contentToText(message.content))
        .join("\n\n");
       const systemPrompt = [buildChatSystemPrompt(selectedModel, promptText), userSystemPrompt].filter(Boolean).join("\n\n");
      const anthropicMessages = upstreamMessages
        .filter((message) => message.role !== "system")
        .map(openAiMessageToAnthropic);
      const anthropicTools = body.tool_choice === "none" ? [] : toAnthropicTools(openAiTools);
      const anthropicToolChoice = body.tool_choice === "none" ? undefined : toAnthropicToolChoice(body.tool_choice);

      if (stream) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const responseId = `chatcmpl_${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        const outputStream = new ReadableStream({
          async start(controller) {
            let controllerClosed = false;
            const safeClose = () => {
              if (controllerClosed) return;
              controllerClosed = true;
              try { controller.close(); } catch {}
            };
            const safeEnqueue = (value) => {
              if (controllerClosed) return false;
              try {
                controller.enqueue(encoder.encode(value));
                return true;
              } catch {
                controllerClosed = true;
                return false;
              }
            };
            const enqueueChunk = (delta, finishReason = null, usage = undefined) => safeEnqueue(`data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model: selectedModel,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
              ...(usage ? { usage } : {}),
            })}\n\n`);
            enqueueChunk({ role: "assistant" });
            const stopHeartbeat = startHeartbeat(controller, encoder);
            const anthropicController = new AbortController();
            const anthropicTimeout = setTimeout(() => anthropicController.abort(), UPSTREAM_TIMEOUT_MS);
            let upstream;
            let promptTokens = fallbackPromptTokens;
            let completionTokens = 0;
            let completionText = "";
            let stopReason = "stop";
            const toolBlocks = new Map();

            const processAnthropicEvent = (eventText) => {
              const dataLines = eventText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.replace(/^data:\s*/, ""));

              for (const dataLine of dataLines) {
                if (dataLine === "[DONE]") return true;
                let parsed;
                try { parsed = JSON.parse(dataLine); } catch { continue; }
                if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) promptTokens = parsed.message.usage.input_tokens;
                if (parsed.type === "message_delta") {
                  if (parsed.usage?.output_tokens) completionTokens = parsed.usage.output_tokens;
                  if (parsed.delta?.stop_reason) stopReason = toOpenAiFinishReason(parsed.delta.stop_reason);
                }
                if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
                  const toolIndex = toolBlocks.size;
                  const toolCall = {
                    index: toolIndex,
                    id: String(parsed.content_block.id || `tool_${toolIndex}`),
                    type: "function",
                    function: { name: String(parsed.content_block.name || "tool"), arguments: "" },
                  };
                  toolBlocks.set(parsed.index, toolCall);
                  enqueueChunk({ tool_calls: [toolCall] });
                }
                if (parsed.type === "content_block_delta") {
                  const text = parsed.delta?.text || "";
                  if (text) {
                    completionText += text;
                    enqueueChunk({ content: sanitizeAssistantContent(text) });
                  }
                  const partialJson = parsed.delta?.partial_json || "";
                  if (partialJson && toolBlocks.has(parsed.index)) {
                    const toolCall = toolBlocks.get(parsed.index);
                    toolCall.function.arguments += partialJson;
                    enqueueChunk({ tool_calls: [{ index: toolCall.index, function: { arguments: partialJson } }] });
                  }
                }
                if (parsed.type === "message_stop") return true;
              }
              return false;
            };

            try {
              upstream = await fetch(`${resellerBaseUrl}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resellerApiKey}`,
                  "Content-Type": "application/json",
                  "anthropic-version": "2023-06-01",
                },
                signal: anthropicController.signal,
                body: JSON.stringify({
                  model: reseller.upstreamModel || selectedModel,
                  system: systemPrompt || undefined,
                  messages: anthropicMessages,
                  max_tokens: maxTokens,
                  tools: anthropicTools.length > 0 ? anthropicTools : undefined,
                  tool_choice: anthropicToolChoice,
                  stream: true,
                }),
              });

              if (!upstream.ok) {
                const errText = await withTimeout(upstream.text(), 5_000, "Upstream error read timed out").catch(() => "");
                console.error("Claude streaming completions error response:", String(errText).slice(0, 500));
                await cancelUsageReservation(reservationId);
                enqueueSseError(controller, encoder, "Current model is temporarily unavailable. Try again later or choose another model.", "model_unavailable");
                return;
              }

              const reader = upstream.body.getReader();
              let sseBuffer = "";
              let streamDone = false;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const events = sseBuffer.split("\n\n");
                sseBuffer = events.pop() || "";
                for (const eventText of events) {
                  streamDone = processAnthropicEvent(eventText);
                  if (streamDone) break;
                }
                if (streamDone) break;
              }
              if (!streamDone && sseBuffer.trim()) processAnthropicEvent(sseBuffer);

              completionText = sanitizeAssistantContent(completionText.trim());
              completionTokens = completionTokens || estimateTokens(completionText) || (toolBlocks.size > 0 ? 1 : 0);
              try {
                if (isClaudeApiPlan(plan)) {
                  await chargeClaudeApiCredit({ userId, model: selectedModel, promptTokens, completionTokens, apiKeyId: keyRecord.id, providerPool: usageProviderPool, fallbackUsed: false });
                } else {
                  await finalizeUsageReservation({ reservationId, promptTokens, completionTokens, model: selectedModel, reasoningEffort: billableReasoningEffort, providerPool: usageProviderPool, fallbackUsed: false, plan });
                }
              } catch (dbErr) {
                console.error("Failed to save Claude streaming usage:", dbErr);
              }
              enqueueChunk({}, stopReason, { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens });
              safeEnqueue("data: [DONE]\n\n");
            } catch (err) {
              await cancelUsageReservation(reservationId);
              const timedOut = err?.name === "AbortError" || err?.name === "TimeoutError";
              enqueueSseError(controller, encoder, timedOut ? "AI server timed out before sending content. Retry the request." : "Failed to reach AI server. Retry the request.", timedOut ? "upstream_timeout" : "gateway_error");
            } finally {
              clearTimeout(anthropicTimeout);
              stopHeartbeat();
              safeClose();
            }
          },
        });
        return new Response(outputStream, { headers: sseHeaders() });
      }

      const anthropicController = new AbortController();
      const anthropicTimeout = setTimeout(() => anthropicController.abort(), UPSTREAM_TIMEOUT_MS);
      let anthropicResponse;
      try {
        anthropicResponse = await fetch(`${resellerBaseUrl}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resellerApiKey}`,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          },
          signal: anthropicController.signal,
          body: JSON.stringify({
            model: reseller.upstreamModel || selectedModel,
            system: systemPrompt || undefined,
            messages: anthropicMessages,
            max_tokens: maxTokens,
            tools: anthropicTools.length > 0 ? anthropicTools : undefined,
            tool_choice: anthropicToolChoice,
          }),
        });
      } catch (err) {
        clearTimeout(anthropicTimeout);
        await cancelUsageReservation(reservationId);
        return openAiError("Current model is temporarily unavailable. Try again later or choose another model.", "server_error", "model_unavailable", err.name === "AbortError" ? 504 : 503);
      } finally {
        clearTimeout(anthropicTimeout);
      }

      if (!anthropicResponse.ok) {
        const errText = await anthropicResponse.text();
        console.error("Claude completions error response:", errText);
        await cancelUsageReservation(reservationId);
        if (isRetryableUpstreamStatus(anthropicResponse.status)) {
          return openAiError("Current model is temporarily unavailable. Try again later or choose another model.", "server_error", "model_unavailable", 503);
        }
        return openAiError("Claude request was rejected by upstream provider.", "server_error", "gateway_error", 502);
      }

      const anthropicContentType = anthropicResponse.headers.get("content-type") || "";
      if (!anthropicContentType.includes("application/json")) {
        const errText = await anthropicResponse.text();
        console.error("Claude completions returned non-JSON response:", errText.slice(0, 500));
        await cancelUsageReservation(reservationId);
        return openAiError("Current model is temporarily unavailable. Try again later or choose another model.", "server_error", "model_unavailable", 503);
      }

      const anthropicData = await withTimeout(anthropicResponse.json(), BODY_READ_TIMEOUT_MS, "Claude response body timed out");
      const completionText = fromAnthropicText(anthropicData.content || []);
      const toolCalls = fromAnthropicToolUses(anthropicData.content || []);
      if (!completionText && toolCalls.length === 0) {
        await cancelUsageReservation(reservationId);
        return openAiError("Current model is temporarily unavailable. Try again later or choose another model.", "server_error", "model_unavailable", 503);
      }

      const actualPrompt = anthropicData.usage?.input_tokens || fallbackPromptTokens;
      const actualCompletion = anthropicData.usage?.output_tokens || estimateTokens(completionText);

      try {
        if (isClaudeApiPlan(plan)) {
          await chargeClaudeApiCredit({ userId, model: selectedModel, promptTokens: actualPrompt, completionTokens: actualCompletion, apiKeyId: keyRecord.id, providerPool: usageProviderPool, fallbackUsed: false });
        } else {
          await finalizeUsageReservation({ reservationId, promptTokens: actualPrompt, completionTokens: actualCompletion, model: selectedModel, reasoningEffort: billableReasoningEffort, providerPool: usageProviderPool, fallbackUsed: false, plan });
        }
      } catch (dbErr) {
        console.error("Failed to save Claude usage:", dbErr);
      }

      const responsePayload = {
        id: anthropicData.id || `chatcmpl_${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: selectedModel,
        choices: [{
          index: 0,
          message: { role: "assistant", content: completionText || null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) },
          finish_reason: toOpenAiFinishReason(anthropicData.stop_reason),
        }],
        usage: {
          prompt_tokens: actualPrompt,
          completion_tokens: actualCompletion,
          total_tokens: actualPrompt + actualCompletion,
        },
      };

      if (stream) {
        const encoder = new TextEncoder();
        const outputStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              id: responsePayload.id,
              object: "chat.completion.chunk",
              created: responsePayload.created,
              model: selectedModel,
              choices: [{ index: 0, delta: { role: "assistant", ...(completionText ? { content: completionText } : {}), ...(toolCalls.length > 0 ? { tool_calls: toolCalls.map((call, toolIndex) => ({ index: toolIndex, ...call })) } : {}) }, finish_reason: null }],
            })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              id: responsePayload.id,
              object: "chat.completion.chunk",
              created: responsePayload.created,
              model: selectedModel,
              choices: [{ index: 0, delta: {}, finish_reason: responsePayload.choices[0].finish_reason }],
              usage: responsePayload.usage,
            })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return new Response(outputStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      return NextResponse.json(responsePayload);
    }

    const requestPayload = {
      model: selectedModel,
      messages: upstreamMessages,
      stream,
      max_tokens: maxTokens,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
      tool_choice: body.tool_choice,
      parallel_tool_calls: typeof body.parallel_tool_calls === "boolean" ? body.parallel_tool_calls : undefined,
      response_format: body.response_format,
      temperature: body.temperature,
      top_p: body.top_p,
      stop: body.stop,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
    };

    // Forward reasoning effort if it's a Pro user and it's sent
    if (upstreamReasoningEffort) {
      requestPayload.reasoning_effort = upstreamReasoningEffort;
    }

    if (stream) {
      requestPayload.stream_options = { include_usage: true };
    }

    const fetchOpenAiWithKey = async (key) => {
      const attemptController = new AbortController();
      const attemptTimeout = setTimeout(() => attemptController.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        return await fetch(`${resellerBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: attemptController.signal,
          body: JSON.stringify(requestPayload),
        });
      } finally {
        clearTimeout(attemptTimeout);
      }
    };

    if (stream) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const outputStream = new ReadableStream({
        async start(controller) {
          let controllerClosed = false;
          const safeClose = () => {
            if (controllerClosed) return;
            controllerClosed = true;
            try { controller.close(); } catch {}
          };
          const safeEnqueue = (value) => {
            if (controllerClosed) return false;
            try {
              controller.enqueue(typeof value === "string" ? encoder.encode(value) : value);
              return true;
            } catch {
              controllerClosed = true;
              return false;
            }
          };
          const stopHeartbeat = startHeartbeat(controller, encoder);
          safeEnqueue(`: rintisai-start ${Date.now()}\n\n`);
          let apiResponse;
          let providerPool = usageProviderPool;
          let fallbackUsed = false;
          let usageModel = selectedModel;
          let completionText = "";
          let actualPromptTokens = null;
          let actualCompletionTokens = null;

          try {
            try {
              apiResponse = await fetchOpenAiWithKey(resellerApiKey);
            } catch (err) {
              if (err.name !== "AbortError") {
                try {
                  apiResponse = await fetchOpenAiWithKey(resellerApiKey);
                } catch (retryErr) {
                  err = retryErr;
                }
              }
              if (!apiResponse && err.name === "AbortError" && reseller.fallbackApiKey) {
                apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
                providerPool = "pro";
                fallbackUsed = true;
              } else if (!apiResponse) {
                throw err;
              }
            }

            if (!apiResponse.ok && reseller.fallbackApiKey && apiResponse.status >= 500) {
              const errText = await withTimeout(apiResponse.text(), 5_000, "Upstream error read timed out").catch(() => "");
              console.error("Primary completions gateway failed; retrying fallback:", String(errText).slice(0, 500));
              apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
              providerPool = "pro";
              fallbackUsed = true;
            }

            if (!apiResponse.ok && reseller.fallbackModel) {
              const errText = await withTimeout(apiResponse.text(), 5_000, "Upstream error read timed out").catch(() => "");
              console.error(`${selectedModel} completions upstream failed; retrying with ${reseller.fallbackModel} fallback:`, String(errText).slice(0, 500));
              requestPayload.model = reseller.fallbackModel;
              usageModel = reseller.fallbackModel;
              fallbackUsed = true;
              apiResponse = await fetchOpenAiWithKey(resellerApiKey);
            }

            if (!apiResponse.ok) {
              const errText = await withTimeout(apiResponse.text(), 5_000, "Upstream error read timed out").catch(() => "");
              console.error("Reseller streaming completions error response:", String(errText).slice(0, 500));
              await cancelUsageReservation(reservationId);
              enqueueSseError(controller, encoder, "Error forwarding completions request to upstream provider.", "gateway_error");
              return;
            }

            const reader = apiResponse.body.getReader();
            let sseBuffer = "";
            const processSseEvent = (eventText) => {
              const dataLines = eventText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data: "))
                .map((line) => line.substring(6));

              for (const dataContent of dataLines) {
                if (dataContent === "[DONE]") return true;
                try {
                  const parsed = JSON.parse(dataContent);
                  if (parsed.usage) {
                    actualPromptTokens = parsed.usage.prompt_tokens;
                    actualCompletionTokens = parsed.usage.completion_tokens;
                  }
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  completionText += content;
                } catch {}
              }
              return false;
            };

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
                streamDone = processSseEvent(eventText);
                if (streamDone) break;
              }
              if (streamDone) break;
            }
            if (!streamDone && sseBuffer.trim()) processSseEvent(sseBuffer);

            const finalPromptTokens = actualPromptTokens !== null ? actualPromptTokens : fallbackPromptTokens;
            const finalCompletionTokens = actualCompletionTokens !== null ? actualCompletionTokens : estimateTokens(completionText);
            try {
              if (isClaudeApiPlan(plan)) {
                await chargeClaudeApiCredit({ userId, model: usageModel, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, apiKeyId: keyRecord.id, providerPool, fallbackUsed });
              } else {
                await finalizeUsageReservation({ reservationId, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, model: usageModel, reasoningEffort: billableReasoningEffort, providerPool, fallbackUsed, plan });
              }
            } catch (dbErr) {
              console.error("Failed to log streaming completions token usage:", dbErr);
            }
          } catch (err) {
            await cancelUsageReservation(reservationId);
            const timedOut = err?.name === "AbortError" || err?.name === "TimeoutError";
            enqueueSseError(controller, encoder, timedOut ? "AI server timed out before sending content. Retry the request." : "Failed to reach AI server. Retry the request.", timedOut ? "upstream_timeout" : "gateway_error");
          } finally {
            stopHeartbeat();
            safeClose();
          }
        },
      });

      return new Response(outputStream, { headers: sseHeaders() });
    }

    let apiResponse;
    let providerPool = usageProviderPool;
    let fallbackUsed = false;
    let usageModel = selectedModel;
    try {
      apiResponse = await fetchOpenAiWithKey(resellerApiKey);
    } catch (err) {
      if (err.name !== "AbortError") {
        try {
          apiResponse = await fetchOpenAiWithKey(resellerApiKey);
        } catch (retryErr) {
          err = retryErr;
        }
      }
      if (!apiResponse && err.name === "AbortError" && reseller.fallbackApiKey) {
        try {
          apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
          providerPool = "pro";
          fallbackUsed = true;
        } catch (fallbackErr) {
          await cancelUsageReservation(reservationId);
          return openAiError(fallbackErr.name === "AbortError" ? "AI server timed out on both primary and fallback." : "Failed to reach AI fallback server.", "server_error", "gateway_error", fallbackErr.name === "AbortError" ? 504 : 502);
        }
      } else if (!apiResponse) {
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "AI server timed out before responding." : "Failed to reach AI server.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
      }
    }

    if (!apiResponse.ok && reseller.fallbackApiKey && apiResponse.status >= 500) {
      const errText = await apiResponse.text();
      console.error("Primary completions gateway failed; retrying fallback:", errText);
      try {
        apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
        providerPool = "pro";
        fallbackUsed = true;
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "AI fallback server timed out." : "Failed to reach AI fallback server.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
      }
    }

    if (!apiResponse.ok && reseller.fallbackModel) {
      const errText = await apiResponse.text();
      console.error(`${selectedModel} completions upstream failed; retrying with ${reseller.fallbackModel} fallback:`, errText);
      requestPayload.model = reseller.fallbackModel;
      usageModel = reseller.fallbackModel;
      fallbackUsed = true;
      try {
        apiResponse = await fetchOpenAiWithKey(resellerApiKey);
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "AI fallback model timed out." : "Failed to reach AI fallback model.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
      }
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Reseller completions error response:", errText);
      await cancelUsageReservation(reservationId);
      return openAiError("Error forwarding completions request to upstream provider.", "server_error", "gateway_error", 502);
    }

    // Handle Streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = apiResponse.body.getReader();

      let completionText = "";
      let actualPromptTokens = null;
      let actualCompletionTokens = null;

      const outputStream = new ReadableStream({
        async start(controller) {
          let controllerClosed = false;
          const safeClose = () => {
            if (controllerClosed) return;
            controllerClosed = true;
            try { controller.close(); } catch {}
          };
          try {
            let sseBuffer = "";
            const processSseEvent = (eventText) => {
              const dataLines = eventText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data: "))
                .map((line) => line.substring(6));

              for (const dataContent of dataLines) {
                if (dataContent === "[DONE]") return true;

                try {
                  const parsed = JSON.parse(dataContent);
                  if (parsed.usage) {
                    actualPromptTokens = parsed.usage.prompt_tokens;
                    actualCompletionTokens = parsed.usage.completion_tokens;
                  }
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  completionText += content;
                } catch {
                  // Ignore malformed upstream events without breaking client streaming.
                }
              }

              return false;
            };

            let streamDone = false;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              try {
                controller.enqueue(value); // Forward directly to developer client
              } catch {
                controllerClosed = true;
                break;
              }

              sseBuffer += chunk;
              const events = sseBuffer.split("\n\n");
              sseBuffer = events.pop() || "";

              for (const eventText of events) {
                streamDone = processSseEvent(eventText);
                if (streamDone) break;
              }

              if (streamDone) break;
            }

            if (!streamDone && sseBuffer.trim()) processSseEvent(sseBuffer);
          } catch (err) {
            console.error("Stream reader error:", err);
          } finally {
            // Deduct usage in SQLite database
            const finalPromptTokens = actualPromptTokens !== null ? actualPromptTokens : fallbackPromptTokens;
            const finalCompletionTokens = actualCompletionTokens !== null ? actualCompletionTokens : estimateTokens(completionText);
            try {
              if (isClaudeApiPlan(plan)) {
                await chargeClaudeApiCredit({ userId, model: usageModel, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, apiKeyId: keyRecord.id, providerPool, fallbackUsed });
              } else {
                await finalizeUsageReservation({ reservationId, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, model: usageModel, reasoningEffort: billableReasoningEffort, providerPool, fallbackUsed, plan });
              }
            } catch (dbErr) {
              console.error("Failed to log completions token usage:", dbErr);
            }
            safeClose();
          }
        },
        cancel() {
          reader.cancel().catch(() => {});
        },
      });

      return new Response(outputStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Handle Blocking JSON response
    const data = await withTimeout(apiResponse.json(), BODY_READ_TIMEOUT_MS, "OpenAI-compatible response body timed out");
    
    // Log token usage directly
    const actualPrompt = data.usage?.prompt_tokens || fallbackPromptTokens;
    const actualCompletion = data.usage?.completion_tokens || estimateTokens(data.choices?.[0]?.message?.content || "");
    try {
      if (isClaudeApiPlan(plan)) {
        await chargeClaudeApiCredit({ userId, model: usageModel, promptTokens: actualPrompt, completionTokens: actualCompletion, apiKeyId: keyRecord.id, providerPool, fallbackUsed });
      } else {
        await finalizeUsageReservation({ reservationId, promptTokens: actualPrompt, completionTokens: actualCompletion, model: usageModel, reasoningEffort: billableReasoningEffort, providerPool, fallbackUsed, plan });
      }
    } catch (dbErr) {
      console.error("Failed to save tokens for blocking completion:", dbErr);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Critical gateway failure:", err);
    return openAiError(err.message, "server_error", null, 500);
  }
}
