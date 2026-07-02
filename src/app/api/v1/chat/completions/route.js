import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getActivePlan, getEffectiveLimits } from "@/app/api/auth/me/route";
import { cancelUsageReservation, estimateUsageUnits, finalizeUsageReservation, reserveUsage } from "@/lib/quota";
import { estimateTokens, hashApiKey } from "@/lib/security";
import { ALLOWED_MODELS, getMaxContextTokens, getMaxOutputTokens, getResellerConfig, isModelAllowedForPlan, normalizeReasoningEffort, toUpstreamReasoningEffort } from "@/lib/models";
import { contentToText, estimateMessagesTokens, sanitizeAssistantContent } from "@/lib/context";

export const dynamic = "force-dynamic";

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
    const plan = getActivePlan(user.subscription);
    const status = user.subscription?.status || "inactive";
    const expiryDate = user.subscription?.expiryDate;

    // Check expiry
    if (status !== "active" || plan === "inactive" || (expiryDate && new Date(expiryDate) < new Date())) {
      return openAiError("Subscription is expired or inactive. Upgrade plan to resume.", "insufficient_quota", "subscription_expired", 403);
    }

    if (!user.subscription?.apiAccessEnabled || plan !== "developer") {
      return openAiError("API access is not enabled for this account.", "insufficient_quota", "api_access_disabled", 403);
    }

    const limits = getEffectiveLimits(user.subscription);

    // 3. Parse input body
    const body = await req.json().catch(() => ({}));
    const { model, messages, stream = false, reasoning_effort } = body;
    const requestedReasoningEffort = normalizeReasoningEffort(reasoning_effort);
    const upstreamReasoningEffort = toUpstreamReasoningEffort(requestedReasoningEffort);

    if (!model || !messages || !Array.isArray(messages)) {
      return openAiError("Missing 'model' or 'messages' array in request body.", "invalid_request_error", null, 400);
    }
    if (messages.length > 100) {
      return openAiError("Too many messages in request body.", "invalid_request_error", null, 400);
    }
    if (JSON.stringify(messages).length > 200_000) {
      return openAiError("Request messages are too large.", "invalid_request_error", null, 400);
    }

    // Determine model mapping to select correct pricing credit weight
    const selectedModel = model;
    if (!ALLOWED_MODELS.has(selectedModel)) {
      return openAiError("Selected model is not available on this platform.", "invalid_request_error", "model_not_found", 400);
    }

    if (!isModelAllowedForPlan(selectedModel, plan)) {
      return openAiError("This model requires a higher plan. Upgrade to access.", "insufficient_quota", "model_not_allowed", 403);
    }
    const maxTokens = getMaxOutputTokens(selectedModel, plan, body.max_tokens);
    const maxContextTokens = getMaxContextTokens(selectedModel, plan);
    if (maxTokens <= 0) {
      return openAiError("This model is not available for your plan.", "insufficient_quota", "model_not_allowed", 403);
    }

    // Reseller credentials
    const reseller = getResellerConfig(selectedModel);
    const resellerBaseUrl = reseller.baseUrl;

    let resellerApiKey = user.assignedApiKey;
    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      resellerApiKey = reseller.apiKey;
    }

    // 4. Construct payload for reseller
    const promptText = messages.map((message) => `${message.role || "user"}: ${contentToText(message.content)}`).join("\n");
    const fallbackPromptTokens = estimateMessagesTokens(messages);
    if (fallbackPromptTokens + maxTokens > maxContextTokens) {
      return openAiError("Request exceeds your plan context limit. Upgrade for a larger context window.", "invalid_request_error", "context_length_exceeded", 400);
    }

    const reservationResult = await reserveUsage({
      userId,
      model: selectedModel,
      source: "api",
      apiKeyId: keyRecord.id,
      estimatedPromptTokens: fallbackPromptTokens,
      estimatedTotalTokens: estimateUsageUnits({ promptText, model: selectedModel, maxTokens, reasoningEffort: requestedReasoningEffort }),
      limits,
      plan,
    });
    if (reservationResult.error) {
      return openAiError(reservationResult.error, "insufficient_quota", "rate_limit_exceeded", reservationResult.status);
    }
    const reservationId = reservationResult.reservation.id;

    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      await cancelUsageReservation(reservationId);
      return openAiError("Server gateway API credentials not configured by administrator.", "server_error", "config_error", 500);
    }

    if (reseller.type === "anthropic") {
      const systemPrompt = messages
        .filter((message) => message.role === "system")
        .map((message) => contentToText(message.content))
        .join("\n\n");
      const anthropicMessages = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: contentToText(message.content),
        }));

      const anthropicController = new AbortController();
      const anthropicTimeout = setTimeout(() => anthropicController.abort(), 90_000);
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
          }),
        });
      } catch (err) {
        clearTimeout(anthropicTimeout);
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "Claude gateway timed out." : "Failed to reach Claude gateway.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
      } finally {
        clearTimeout(anthropicTimeout);
      }

      if (!anthropicResponse.ok) {
        const errText = await anthropicResponse.text();
        console.error("Claude completions error response:", errText);
        await cancelUsageReservation(reservationId);
        return openAiError("Error forwarding Claude request to upstream provider.", "server_error", "gateway_error", 502);
      }

      const anthropicContentType = anthropicResponse.headers.get("content-type") || "";
      if (!anthropicContentType.includes("application/json")) {
        const errText = await anthropicResponse.text();
        console.error("Claude completions returned non-JSON response:", errText.slice(0, 500));
        await cancelUsageReservation(reservationId);
        return openAiError("Claude gateway returned an invalid response.", "server_error", "gateway_error", 502);
      }

      const anthropicData = await anthropicResponse.json();
      const completionText = sanitizeAssistantContent((anthropicData.content || [])
        .map((part) => part?.text || "")
        .join("")
        .trim());
      if (!completionText) {
        await cancelUsageReservation(reservationId);
        return openAiError("Claude gateway returned an empty response.", "server_error", "empty_response", 502);
      }

      const actualPrompt = anthropicData.usage?.input_tokens || fallbackPromptTokens;
      const actualCompletion = anthropicData.usage?.output_tokens || estimateTokens(completionText);

      try {
        await finalizeUsageReservation({ reservationId, promptTokens: actualPrompt, completionTokens: actualCompletion, model: selectedModel, reasoningEffort: requestedReasoningEffort });
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
          message: { role: "assistant", content: completionText },
          finish_reason: anthropicData.stop_reason || "stop",
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
              choices: [{ index: 0, delta: { role: "assistant", content: completionText }, finish_reason: null }],
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
      messages,
      stream,
      max_tokens: maxTokens,
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
      const attemptTimeout = setTimeout(() => attemptController.abort(), 90_000);
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

    let apiResponse;
    try {
      apiResponse = await fetchOpenAiWithKey(resellerApiKey);
    } catch (err) {
      if (err.name === "AbortError" && reseller.fallbackApiKey) {
        try {
          apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
        } catch (fallbackErr) {
          await cancelUsageReservation(reservationId);
          return openAiError(fallbackErr.name === "AbortError" ? "AI server timed out on both primary and fallback." : "Failed to reach AI fallback server.", "server_error", "gateway_error", fallbackErr.name === "AbortError" ? 504 : 502);
        }
      } else {
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "AI server timed out before responding." : "Failed to reach AI server.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
      }
    }

    if (!apiResponse.ok && reseller.fallbackApiKey && apiResponse.status >= 500) {
      const errText = await apiResponse.text();
      console.error("Primary completions gateway failed; retrying fallback:", errText);
      try {
        apiResponse = await fetchOpenAiWithKey(reseller.fallbackApiKey);
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return openAiError(err.name === "AbortError" ? "AI fallback server timed out." : "Failed to reach AI fallback server.", "server_error", "gateway_error", err.name === "AbortError" ? 504 : 502);
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
              controller.enqueue(value); // Forward directly to developer client

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
              await finalizeUsageReservation({ reservationId, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, model: selectedModel, reasoningEffort: requestedReasoningEffort });
            } catch (dbErr) {
              console.error("Failed to log completions token usage:", dbErr);
            }
            controller.close();
          }
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
    const data = await apiResponse.json();
    
    // Log token usage directly
    const actualPrompt = data.usage?.prompt_tokens || fallbackPromptTokens;
    const actualCompletion = data.usage?.completion_tokens || estimateTokens(data.choices?.[0]?.message?.content || "");
    try {
      await finalizeUsageReservation({ reservationId, promptTokens: actualPrompt, completionTokens: actualCompletion, model: selectedModel, reasoningEffort: requestedReasoningEffort });
    } catch (dbErr) {
      console.error("Failed to save tokens for blocking completion:", dbErr);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Critical gateway failure:", err);
    return openAiError(err.message, "server_error", null, 500);
  }
}
