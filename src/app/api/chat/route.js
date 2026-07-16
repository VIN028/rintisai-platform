import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { getActivePlan, getEffectiveLimits } from "../auth/me/route";
import { cancelUsageReservation, estimateUsageUnits, finalizeUsageReservation, getBillableReasoningEffort, reserveUsage } from "@/lib/quota";
import { estimateTokens } from "@/lib/security";
import { ALLOWED_MODELS, getMaxContextTokens, getMaxOutputTokens, getResellerConfig, isModelAllowedForPlan, normalizeReasoningEffort, supportsVisionInput, toUpstreamReasoningEffort } from "@/lib/models";
import { buildChatSystemPrompt, compactMessagesForContext, contentToText, sanitizeAssistantContent } from "@/lib/context";
import { appendTextToContent, fetchUrlContextsFromText, formatFetchedUrlContext } from "@/lib/url-fetch";
import { toAnthropicContent } from "@/lib/multimodal";
import { isApiPlan } from "@/lib/plans";
import { resolveEntitlementForModel } from "@/lib/entitlements";
import { expireSubscriptionIfNeeded } from "@/lib/subscription-expiry";

const UPSTREAM_ATTEMPT_TIMEOUT_MS = 25_000;
const MIN_COMPLETION_TOKENS = 512;
const CHAT_TOOL_DEFINITIONS = {
  file_search: { label: "File Search", description: "Search and use attached or project file context when available." },
  web_search: { label: "Web Search", description: "Search the web for current information when the provider supports it." },
  skills: { label: "Skills", description: "Use structured skills and task-specific procedures when helpful." },
  run_code: { label: "Run Code", description: "Run or reason through code execution when a code interpreter is available." },
  artifacts: { label: "Artifacts", description: "Create file/artifact style outputs when the user asks for deliverables." },
};

function normalizeEnabledTools(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((key) => Object.prototype.hasOwnProperty.call(CHAT_TOOL_DEFINITIONS, key));
}

function buildToolInstructions(enabledTools, attachmentMode) {
  const lines = enabledTools.map((key) => `- ${CHAT_TOOL_DEFINITIONS[key].label}: ${CHAT_TOOL_DEFINITIONS[key].description}`);
  if (attachmentMode === "provider") lines.push("- Attachment upload mode: prefer native provider/file-search handling when available; otherwise use extracted text context already included in the prompt.");
  if (lines.length === 0) return "";
  return `Enabled tool preferences for this request:\n${lines.join("\n")}\nIf a native tool is not available in this environment, continue with the available context and say what could not be executed.`;
}

function toOpenAiToolDefinitions(enabledTools) {
  return enabledTools.map((key) => ({
    type: "function",
    function: {
      name: key,
      description: CHAT_TOOL_DEFINITIONS[key].description,
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
  }));
}

function toAnthropicToolDefinitions(enabledTools) {
  return enabledTools.map((key) => ({
    name: key,
    description: CHAT_TOOL_DEFINITIONS[key].description,
    input_schema: { type: "object", properties: { query: { type: "string" } } },
  }));
}

function fitCompletionTokensToContext({ promptTokens, maxTokens, maxContextTokens }) {
  const available = Math.max(0, Number(maxContextTokens || 0) - Number(promptTokens || 0));
  if (available < MIN_COMPLETION_TOKENS) return { error: true, available };
  return { maxTokens: Math.min(maxTokens, available), available };
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);
    const userId = user.id;

    // Parse request
    const { messages, model, conversationId, reasoning_effort, userContent, enabledTools: enabledToolsRaw, attachmentMode } = await req.json();
    const enabledTools = normalizeEnabledTools(enabledToolsRaw);
    const toolInstructions = buildToolInstructions(enabledTools, attachmentMode);
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Chat messages are required." }, { status: 400 });
    }
    if (JSON.stringify(messages[messages.length - 1] || {}).length > 60_000) {
      return NextResponse.json({ error: "Chat request is too large." }, { status: 400 });
    }

    const selectedModel = model || "gpt-5.4-mini";
    if (!ALLOWED_MODELS.has(selectedModel)) {
      return NextResponse.json({ error: "Selected model is not available." }, { status: 400 });
    }
    if (Array.isArray(userContent) && userContent.some((part) => part?.type === "image_url") && !supportsVisionInput(selectedModel)) {
      return NextResponse.json({ error: "Image understanding is not available for this model yet. Use text prompts for now." }, { status: 400 });
    }
    const requestedReasoningEffort = normalizeReasoningEffort(reasoning_effort);
    const upstreamReasoningEffort = toUpstreamReasoningEffort(requestedReasoningEffort);

    let subscription = user.subscription;
    subscription = await expireSubscriptionIfNeeded(subscription);

    const plan = getActivePlan(subscription);

    if (plan === "inactive") {
      return NextResponse.json({ error: "Akses AI belum aktif. Silakan upgrade paket atau hubungi admin." }, { status: 403 });
    }

    const entitlementAccess = await resolveEntitlementForModel({ userId, subscription, model: selectedModel, fallbackPlan: plan });
    const webPlan = isApiPlan(plan) ? "free" : entitlementAccess.plan;

    if (!isModelAllowedForPlan(selectedModel, webPlan)) {
      return NextResponse.json({ error: "This model requires a higher plan. Please upgrade." }, { status: 403 });
    }

    let maxOutputTokens = getMaxOutputTokens(selectedModel, webPlan);
    const maxContextTokens = getMaxContextTokens(selectedModel, webPlan);
    if (maxOutputTokens <= 0) {
      return NextResponse.json({ error: "This model is not available for your plan." }, { status: 403 });
    }

    const limits = entitlementAccess.limits || (isApiPlan(plan)
      ? getEffectiveLimits({ plan: "free", status: "active", billingInterval: "monthly" })
      : getEffectiveLimits(subscription));
    const billableReasoningEffort = getBillableReasoningEffort({
      model: selectedModel,
      plan: webPlan,
      source: "web",
      requestedReasoningEffort,
    });

    // Retrieve or Create Conversation
    let activeConversationId = conversationId;
    const lastMessage = messages[messages.length - 1];
    const isMultimodal = Array.isArray(userContent);
    const userPrompt = isMultimodal
      ? userContent.filter((part) => part.type === "text").map((part) => part.text).join(" ") || "Attached image"
      : (typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content));
    const maxPromptChars = Math.max(60_000, Math.min(2_000_000, maxContextTokens * 4));
    if (userPrompt.length > maxPromptChars || (isMultimodal && JSON.stringify(userContent).length > Math.max(1_000_000, maxPromptChars * 1.2))) {
      return NextResponse.json({ error: "Chat request is too large." }, { status: 400 });
    }
    const fetchedUrlContexts = await fetchUrlContextsFromText(userPrompt);
    const fetchedUrlText = formatFetchedUrlContext(fetchedUrlContexts);
    const fetchedUrlPrompt = fetchedUrlText
      ? `The user asked about external URL content. Use this fetched web context when answering. If a fetch error is shown, be transparent and continue with available information.\n\n${fetchedUrlText}`
      : "";

    if (activeConversationId) {
      const existingConversation = await prisma.conversation.findFirst({
        where: { id: activeConversationId, userId },
        select: { id: true },
      });

      if (!existingConversation) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
    } else {
      const truncatedTitle = userPrompt.length > 25 ? userPrompt.substring(0, 25) + "..." : userPrompt;
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: truncatedTitle,
        },
      });
      activeConversationId = conversation.id;
    }

    const userPromptTokens = estimateTokens(userPrompt);
    const fittedUserCompletion = fitCompletionTokensToContext({ promptTokens: userPromptTokens, maxTokens: maxOutputTokens, maxContextTokens });
    if (fittedUserCompletion.error) {
      return NextResponse.json({ error: "Request exceeds the model context limit. Start a new chat or send less context." }, { status: 400 });
    }
    maxOutputTokens = fittedUserCompletion.maxTokens;

    const persistedMessages = await prisma.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    const incomingUserMessage = {
      role: "user",
      content: appendTextToContent(isMultimodal ? userContent : lastMessage.content, fetchedUrlPrompt),
    };
    const lastPersistedMessage = persistedMessages[persistedMessages.length - 1];
    const isInterruptedRetry = lastPersistedMessage?.role === "user" && lastPersistedMessage?.content === userPrompt;
    const conversationMessages = isInterruptedRetry
      ? [...persistedMessages.slice(0, -1), incomingUserMessage]
      : [...persistedMessages, incomingUserMessage];
    const contextPlan = compactMessagesForContext({
      messages: conversationMessages,
      maxContextTokens,
      maxOutputTokens,
      systemPrompt: [buildChatSystemPrompt(selectedModel, userPrompt), toolInstructions].filter(Boolean).join("\n\n"),
    });
    const fittedContextCompletion = fitCompletionTokensToContext({ promptTokens: contextPlan.promptTokens, maxTokens: maxOutputTokens, maxContextTokens });
    if (fittedContextCompletion.error) {
      return NextResponse.json({ error: "Request is too large even after auto-compaction. Start a new chat or send less context." }, { status: 400 });
    }
    maxOutputTokens = fittedContextCompletion.maxTokens;

    const reservationResult = await reserveUsage({
      userId,
      model: selectedModel,
      source: "web",
      estimatedPromptTokens: contextPlan.promptTokens,
      estimatedTotalTokens: estimateUsageUnits({ promptText: conversationMessages.map((message) => contentToText(message.content)).join("\n"), model: selectedModel, maxTokens: maxOutputTokens, reasoningEffort: billableReasoningEffort, plan: webPlan }),
      limits,
      plan: webPlan,
      packageId: limits.packageId || null,
    });
    if (reservationResult.error) {
      return NextResponse.json({ error: reservationResult.error }, { status: reservationResult.status });
    }
    const reservationId = reservationResult.reservation.id;

    if (!isInterruptedRetry) {
      await prisma.message.create({
        data: {
          conversationId: activeConversationId,
          role: "user",
          content: userPrompt,
        },
      });
    }

    // Call Reseller proxy
    const reseller = getResellerConfig(selectedModel);
    const resellerBaseUrl = reseller.baseUrl;
    const usageProviderPool = reseller.providerPool || (reseller.type === "anthropic" ? "kiro" : "plus");
    let resellerApiKey = user.assignedApiKey;
    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      resellerApiKey = reseller.apiKey;
    }

    if (!resellerApiKey || resellerApiKey.startsWith("sk-placeholder")) {
      await cancelUsageReservation(reservationId);
      return NextResponse.json(
        { error: "API Key belum dikonfigurasi. Silakan masukkan API Key asli di file .env atau hubungi Admin." },
        { status: 403 }
      );
    }

    if (reseller.type === "anthropic") {
      const systemPrompt = contextPlan.messages
        .filter((message) => message.role === "system")
        .map((message) => contentToText(message.content))
        .join("\n\n");
      const anthropicMessages = contextPlan.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: toAnthropicContent(message.content),
        }));

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`event: metadata\ndata: ${JSON.stringify({
            conversationId: activeConversationId,
            contextUsage: {
              used: contextPlan.contextUsed,
              displayUsed: contextPlan.displayTokens,
              limit: maxContextTokens,
              percent: maxContextTokens && contextPlan.displayTokens > 0 ? Math.max(1, Math.min(100, Math.round((contextPlan.displayTokens / maxContextTokens) * 100))) : 0,
              compacted: contextPlan.compacted,
              omittedMessages: contextPlan.omittedMessages,
            },
          })}\n\n`));

          try {
            const fetchAnthropic = async ({ stream }) => {
              const anthropicController = new AbortController();
              const anthropicTimeout = setTimeout(() => anthropicController.abort(), UPSTREAM_ATTEMPT_TIMEOUT_MS);
              try {
                return await fetch(`${resellerBaseUrl}/messages`, {
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
                    max_tokens: maxOutputTokens,
                    tools: enabledTools.length > 0 ? toAnthropicToolDefinitions(enabledTools) : undefined,
                    tool_choice: enabledTools.length > 0 ? { type: "auto" } : undefined,
                    ...(stream ? { stream: true } : {}),
                  }),
                });
              } finally {
                clearTimeout(anthropicTimeout);
              }
            };

            let anthropicResponse;
            try {
              anthropicResponse = await fetchAnthropic({ stream: true });
            } catch (err) {
              console.log("Anthropic-compatible streaming request retrying once:", err?.message || err);
              anthropicResponse = await fetchAnthropic({ stream: true });
            }

            if (!anthropicResponse.ok) {
              const errText = await anthropicResponse.text();
              console.log("Anthropic-compatible streaming gateway retrying without stream:", errText.slice(0, 500));
              anthropicResponse = await fetchAnthropic({ stream: false });
            }

            if (!anthropicResponse.ok) {
              const errText = await anthropicResponse.text();
              console.error("Anthropic-compatible gateway error:", errText);
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Current model is temporarily unavailable. Please try again later or choose another model." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const anthropicContentType = anthropicResponse.headers.get("content-type") || "";
            let completionText = "";
            let promptTokens = contextPlan.promptTokens;
            let completionTokens = null;

            if (anthropicContentType.includes("text/event-stream")) {
              const anthropicReader = anthropicResponse.body.getReader();
              const decoder = new TextDecoder();
              let sseBuffer = "";

              const processAnthropicEvent = (eventText) => {
                const dataLines = eventText
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line.startsWith("data: "))
                  .map((line) => line.substring(6));

                for (const dataContent of dataLines) {
                  if (dataContent === "[DONE]") return true;
                  try {
                    const parsed = JSON.parse(dataContent);
                    if (parsed.message?.usage?.input_tokens) promptTokens = parsed.message.usage.input_tokens;
                    if (parsed.usage?.input_tokens) promptTokens = parsed.usage.input_tokens;
                    if (parsed.usage?.output_tokens) completionTokens = parsed.usage.output_tokens;

                    const textDelta = parsed.delta?.text || parsed.content_block?.text || "";
                    if (textDelta) {
                      completionText += textDelta;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: sanitizeAssistantContent(textDelta) })}\n\n`));
                    }
                  } catch {
                    // Ignore malformed upstream events without killing the stream.
                  }
                }

                return false;
              };

              let streamDone = false;
              while (true) {
                const { done, value } = await anthropicReader.read();
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
            } else if (anthropicContentType.includes("application/json")) {
              const data = await anthropicResponse.json();
              promptTokens = data.usage?.input_tokens || promptTokens;
              completionTokens = data.usage?.output_tokens || completionTokens;
              completionText = sanitizeAssistantContent((data.content || [])
                .map((part) => part?.text || "")
                .join("")
                .trim());
              if (completionText) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: completionText })}\n\n`));
            } else {
              const errText = await anthropicResponse.text();
              console.error("Claude Gateway returned unsupported response:", errText.slice(0, 500));
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Current model is temporarily unavailable. Please try again later or choose another model." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            if (!completionText) {
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Current model is temporarily unavailable. Please try again later or choose another model." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            completionTokens = completionTokens || estimateTokens(completionText);
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));

            try {
              await prisma.$transaction([
                finalizeUsageReservation({ reservationId, promptTokens, completionTokens, model: selectedModel, reasoningEffort: billableReasoningEffort, providerPool: usageProviderPool, fallbackUsed: false, plan: webPlan }),
                prisma.message.create({
                  data: {
                    conversationId: activeConversationId,
                    role: "assistant",
                    content: completionText,
                  },
                }),
                prisma.conversation.update({
                  where: { id: activeConversationId },
                  data: { updatedAt: new Date() },
                }),
              ]);
            } catch (dbErr) {
              console.error("Failed to save Claude response:", dbErr);
            }
          } catch (err) {
            if (err?.code === "ERR_INVALID_STATE") return;
            console.error("Claude request failed:", err);
            await cancelUsageReservation(reservationId);
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Current model is temporarily unavailable. Please try again later or choose another model." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {}
          }

          try { controller.close(); } catch {}
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const openAiPayload = {
      model: selectedModel,
      messages: contextPlan.messages,
      max_tokens: maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
      tools: enabledTools.length > 0 ? toOpenAiToolDefinitions(enabledTools) : undefined,
      tool_choice: enabledTools.length > 0 ? "auto" : undefined,
      ...(["pro", "developer", "gpt_code", "codex_pro"].includes(webPlan) && upstreamReasoningEffort ? { reasoning_effort: upstreamReasoningEffort } : {}),
    };

    const fetchWithKey = async (key) => {
      const attemptController = new AbortController();
      const attemptTimeout = setTimeout(() => attemptController.abort(), UPSTREAM_ATTEMPT_TIMEOUT_MS);
      try {
        return await fetch(`${resellerBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: attemptController.signal,
          body: JSON.stringify(openAiPayload),
        });
      } finally {
        clearTimeout(attemptTimeout);
      }
    };

    let apiResponse;
    let providerPool = usageProviderPool;
    let fallbackUsed = false;
    let usageModel = selectedModel;
    try {
      apiResponse = await fetchWithKey(resellerApiKey);
    } catch (err) {
      if (err.name === "AbortError" && reseller.fallbackApiKey) {
        try {
          apiResponse = await fetchWithKey(reseller.fallbackApiKey);
          providerPool = "pro";
          fallbackUsed = true;
        } catch (fallbackErr) {
          await cancelUsageReservation(reservationId);
          return NextResponse.json(
            { error: fallbackErr.name === "AbortError" ? "AI server timed out on both primary and fallback." : "Failed to reach AI fallback server." },
            { status: fallbackErr.name === "AbortError" ? 504 : 502 }
          );
        }
      } else {
        await cancelUsageReservation(reservationId);
        return NextResponse.json({ error: err.name === "AbortError" ? "AI server timed out before responding." : "Failed to reach AI server." }, { status: err.name === "AbortError" ? 504 : 502 });
      }
    }

    if (!apiResponse.ok && reseller.fallbackApiKey && apiResponse.status >= 500) {
      const errText = await apiResponse.text();
      console.error("Primary reseller gateway failed; retrying fallback:", errText);
      try {
        apiResponse = await fetchWithKey(reseller.fallbackApiKey);
        providerPool = "pro";
        fallbackUsed = true;
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return NextResponse.json({ error: err.name === "AbortError" ? "AI fallback server timed out." : "Failed to reach AI fallback server." }, { status: err.name === "AbortError" ? 504 : 502 });
      }
    }

    if (!apiResponse.ok && reseller.fallbackModel) {
      const errText = await apiResponse.text();
      console.error(`${selectedModel} upstream failed; retrying with ${reseller.fallbackModel} fallback:`, errText);
      openAiPayload.model = reseller.fallbackModel;
      usageModel = reseller.fallbackModel;
      fallbackUsed = true;
      try {
        apiResponse = await fetchWithKey(resellerApiKey);
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return NextResponse.json({ error: err.name === "AbortError" ? "AI fallback model timed out." : "Failed to reach AI fallback model." }, { status: err.name === "AbortError" ? 504 : 502 });
      }
    }

    if (!apiResponse.ok && ["gpt-5.4", "gpt-5.5"].includes(selectedModel)) {
      const errText = await apiResponse.text();
      console.error(`${selectedModel} upstream failed; retrying with gpt-5.4-mini fallback:`, errText);
      openAiPayload.model = "gpt-5.4-mini";
      usageModel = "gpt-5.4-mini";
      fallbackUsed = true;
      try {
        apiResponse = await fetchWithKey(resellerApiKey);
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return NextResponse.json({ error: err.name === "AbortError" ? "AI fallback model timed out." : "Failed to reach AI fallback model." }, { status: err.name === "AbortError" ? 504 : 502 });
      }
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Reseller Gateway Error:", errText);
      await cancelUsageReservation(reservationId);
      return NextResponse.json({ error: "Failed to process request to AI server." }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = apiResponse.body.getReader();

    let completionText = "";
    let actualPromptTokens = null;
    let actualCompletionTokens = null;
    let reasoningText = "";
    let shouldPersistCompletion = true;

    const stream = new ReadableStream({
      async start(controller) {
        // Enqueue metadata chunk
        controller.enqueue(
          encoder.encode(`event: metadata\ndata: ${JSON.stringify({
            conversationId: activeConversationId,
            contextUsage: {
              used: contextPlan.contextUsed,
              displayUsed: contextPlan.displayTokens,
              limit: maxContextTokens,
              percent: maxContextTokens && contextPlan.displayTokens > 0 ? Math.max(1, Math.min(100, Math.round((contextPlan.displayTokens / maxContextTokens) * 100))) : 0,
              compacted: contextPlan.compacted,
              omittedMessages: contextPlan.omittedMessages,
            },
          })}\n\n`)
        );

        try {
          let sseBuffer = "";
          const processSseEvent = (eventText) => {
            const dataLines = eventText
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.startsWith("data: "))
              .map((line) => line.substring(6));

            for (const dataContent of dataLines) {
              if (dataContent === "[DONE]") {
                if (!completionText.trim()) {
                  shouldPersistCompletion = false;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Current model returned an empty response. Please try again or choose another model." })}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                return true;
              }

              try {
                const parsed = JSON.parse(dataContent);

                if (parsed.usage) {
                  actualPromptTokens = parsed.usage.prompt_tokens;
                  actualCompletionTokens = parsed.usage.completion_tokens;
                }

                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) completionText += content;

                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // Ignore malformed upstream events without killing the stream.
              }
            }

            return false;
          };

          let streamDone = false;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
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
          if (err?.code !== "ERR_INVALID_STATE") console.error("Error reading stream:", err);
        } finally {
          const finalPromptTokens = actualPromptTokens !== null ? actualPromptTokens : contextPlan.promptTokens;
          const finalCompletionTokens = actualCompletionTokens !== null ? actualCompletionTokens : estimateTokens(completionText);
          try {
            if (shouldPersistCompletion && completionText.trim()) {
              await prisma.$transaction([
                finalizeUsageReservation({ reservationId, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, model: usageModel, reasoningEffort: billableReasoningEffort, providerPool, fallbackUsed, plan: webPlan }),
                prisma.message.create({
                  data: {
                    conversationId: activeConversationId,
                    role: "assistant",
                    content: completionText,
                  },
                }),
                prisma.conversation.update({
                  where: { id: activeConversationId },
                  data: { updatedAt: new Date() },
                }),
              ]);
            } else {
              await cancelUsageReservation(reservationId);
            }
          } catch (dbErr) {
            console.error("Failed to save tokens to SQLite database:", dbErr);
          }

          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = String(error?.message || "");
    const isAuthFailure = errorMessage.includes("authenticated") || errorMessage.includes("Session expired") || errorMessage.includes("User not found") || errorMessage.includes("Email verification required");
    if (error instanceof AuthError || Number.isInteger(error?.status) || isAuthFailure) {
      return NextResponse.json({ error: error.message }, { status: error.status || 401 });
    }
    console.error("Chat proxy error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal server." }, { status: 500 });
  }
}
