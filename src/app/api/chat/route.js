import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";
import { getActivePlan, getEffectiveLimits } from "../auth/me/route";
import { cancelUsageReservation, estimateUsageUnits, finalizeUsageReservation, reserveUsage } from "@/lib/quota";
import { estimateTokens } from "@/lib/security";
import { ALLOWED_MODELS, getMaxContextTokens, getMaxOutputTokens, getResellerConfig, isModelAllowedForPlan, normalizeReasoningEffort, toUpstreamReasoningEffort } from "@/lib/models";
import { compactMessagesForContext, contentToText, sanitizeAssistantContent } from "@/lib/context";

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);
    const userId = user.id;

    // Parse request
    const { messages, model, conversationId, reasoning_effort, userContent } = await req.json();
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
    const requestedReasoningEffort = normalizeReasoningEffort(reasoning_effort);
    const upstreamReasoningEffort = toUpstreamReasoningEffort(requestedReasoningEffort);

    // Check if subscription has expired
    let subscription = user.subscription;
    if (subscription && new Date() > new Date(subscription.expiryDate) && subscription.status === "active") {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "expired" },
      });
    }

    const plan = getActivePlan(subscription);

    if (plan === "inactive") {
      return NextResponse.json({ error: "Akses AI belum aktif. Silakan upgrade paket atau hubungi admin." }, { status: 403 });
    }

    if (!isModelAllowedForPlan(selectedModel, plan)) {
      return NextResponse.json({ error: "This model requires a higher plan. Please upgrade." }, { status: 403 });
    }

    const maxOutputTokens = getMaxOutputTokens(selectedModel, plan);
    const maxContextTokens = getMaxContextTokens(selectedModel, plan);
    if (maxOutputTokens <= 0) {
      return NextResponse.json({ error: "This model is not available for your plan." }, { status: 403 });
    }

    const limits = getEffectiveLimits(subscription);

    // Retrieve or Create Conversation
    let activeConversationId = conversationId;
    const lastMessage = messages[messages.length - 1];
    const isMultimodal = Array.isArray(userContent);
    const userPrompt = isMultimodal
      ? userContent.filter((part) => part.type === "text").map((part) => part.text).join(" ") || "Attached image"
      : (typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content));
    if (userPrompt.length > 50_000 || (isMultimodal && JSON.stringify(userContent).length > 1_000_000)) {
      return NextResponse.json({ error: "Chat request is too large." }, { status: 400 });
    }

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
    if (userPromptTokens + maxOutputTokens > maxContextTokens) {
      return NextResponse.json({ error: "Request exceeds your plan context limit. Upgrade for a larger context window." }, { status: 400 });
    }

    const persistedMessages = await prisma.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    const incomingUserMessage = {
      role: "user",
      content: isMultimodal ? userContent : lastMessage.content,
    };
    const conversationMessages = [...persistedMessages, incomingUserMessage];
    const contextPlan = compactMessagesForContext({
      messages: conversationMessages,
      maxContextTokens,
      maxOutputTokens,
    });
    if (contextPlan.promptTokens + maxOutputTokens > maxContextTokens) {
      return NextResponse.json({ error: "Request is too large even after auto-compaction. Send a shorter message or upgrade for a larger context window." }, { status: 400 });
    }

    const reservationResult = await reserveUsage({
      userId,
      model: selectedModel,
      source: "web",
      estimatedPromptTokens: contextPlan.promptTokens,
      estimatedTotalTokens: estimateUsageUnits({ promptText: conversationMessages.map((message) => contentToText(message.content)).join("\n"), model: selectedModel, maxTokens: maxOutputTokens, reasoningEffort: requestedReasoningEffort }),
      limits,
      plan,
    });
    if (reservationResult.error) {
      return NextResponse.json({ error: reservationResult.error }, { status: reservationResult.status });
    }
    const reservationId = reservationResult.reservation.id;

    // Save user's message to DB
    await prisma.message.create({
      data: {
        conversationId: activeConversationId,
        role: "user",
        content: userPrompt,
      },
    });

    // Call Reseller proxy
    const reseller = getResellerConfig(selectedModel);
    const resellerBaseUrl = reseller.baseUrl;
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
          content: contentToText(message.content),
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

          const anthropicController = new AbortController();
          const anthropicTimeout = setTimeout(() => anthropicController.abort(), 90_000);
          try {
            const anthropicResponse = await fetch(`${resellerBaseUrl}/messages`, {
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
              }),
            });

            clearTimeout(anthropicTimeout);

            if (!anthropicResponse.ok) {
              const errText = await anthropicResponse.text();
              console.error("Claude Gateway Error:", errText);
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Model Claude sedang tidak tersedia. Coba lagi beberapa saat lagi atau gunakan model lain." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const anthropicContentType = anthropicResponse.headers.get("content-type") || "";
            if (!anthropicContentType.includes("application/json")) {
              const errText = await anthropicResponse.text();
              console.error("Claude Gateway returned non-JSON response:", errText.slice(0, 500));
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Gateway Claude mengembalikan respons tidak valid. Coba lagi beberapa saat lagi atau gunakan model lain." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const data = await anthropicResponse.json();
            const completionText = sanitizeAssistantContent((data.content || [])
              .map((part) => part?.text || "")
              .join("")
              .trim());
            if (!completionText) {
              await cancelUsageReservation(reservationId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Model Claude tidak mengembalikan jawaban. Coba lagi beberapa saat lagi atau gunakan model lain." })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const promptTokens = data.usage?.input_tokens || contextPlan.promptTokens;
            const completionTokens = data.usage?.output_tokens || estimateTokens(completionText);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: completionText })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));

            try {
              await prisma.$transaction([
                finalizeUsageReservation({ reservationId, promptTokens, completionTokens, model: selectedModel, reasoningEffort: requestedReasoningEffort }),
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
            clearTimeout(anthropicTimeout);
            console.error("Claude request failed:", err);
            await cancelUsageReservation(reservationId);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Model Claude timeout atau sedang tidak tersedia. Coba lagi beberapa saat lagi atau gunakan model lain." })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }

          controller.close();
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
      ...(["pro", "developer"].includes(plan) && upstreamReasoningEffort ? { reasoning_effort: upstreamReasoningEffort } : {}),
    };

    const fetchWithKey = async (key) => {
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
          body: JSON.stringify(openAiPayload),
        });
      } finally {
        clearTimeout(attemptTimeout);
      }
    };

    let apiResponse;
    try {
      apiResponse = await fetchWithKey(resellerApiKey);
    } catch (err) {
      if (err.name === "AbortError" && reseller.fallbackApiKey) {
        try {
          apiResponse = await fetchWithKey(reseller.fallbackApiKey);
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
      } catch (err) {
        await cancelUsageReservation(reservationId);
        return NextResponse.json({ error: err.name === "AbortError" ? "AI fallback server timed out." : "Failed to reach AI fallback server." }, { status: err.name === "AbortError" ? 504 : 502 });
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

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
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
          console.error("Error reading stream:", err);
        } finally {
          const finalPromptTokens = actualPromptTokens !== null ? actualPromptTokens : contextPlan.promptTokens;
          const finalCompletionTokens = actualCompletionTokens !== null ? actualCompletionTokens : estimateTokens(completionText);
          try {
            await prisma.$transaction([
              finalizeUsageReservation({ reservationId, promptTokens: finalPromptTokens, completionTokens: finalCompletionTokens, model: selectedModel, reasoningEffort: requestedReasoningEffort }),
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
            console.error("Failed to save tokens to SQLite database:", dbErr);
          }

          controller.close();
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
