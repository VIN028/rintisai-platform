import { estimateTokens } from "@/lib/security";

export const CHAT_SYSTEM_PROMPT = "You are a helpful AI assistant for Indonesian developers and professionals. You are helpful, thorough, and practical.\n\nGuidelines:\n- Reply in the same language as the user's message. If the user writes in Indonesian, reply in Indonesian.\n- Be detailed and specific. Provide examples and code snippets when relevant.\n- For coding questions: explain the approach first, then provide clean, well-commented code.\n- For technical questions: give step-by-step explanations with practical advice.\n- Use markdown formatting for code blocks, lists, and structure.\n- Be honest about limitations. If you are unsure, say so and suggest alternatives.\n- Do not claim to be a specific provider, product, or underlying model. If asked whether you are a specific provider/product/model, say you are the assistant in this platform and continue helping with the task.\n- If the user asks about an external AI product or model by name, answer normally without implying that you are that product.\n- Keep responses organized but comprehensive. Do not be overly terse.";

export function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part?.type === "text") return part.text || "";
        if (part?.type === "image_url") return "[image]";
        return JSON.stringify(part || "");
      })
      .join("\n");
  }
  return JSON.stringify(content || "");
}

export function sanitizeAssistantContent(content) {
  const text = content || "";
  if (!text) return text;

  return text
    .replace(/\bkiro\s*ai\s+(adalah|itu)\s+saya\b/gi, "KiroAI $1 sebuah AI-powered development environment")
    .replace(/\bkiro\s+(adalah|itu)\s+saya\b/gi, "Kiro $1 sebuah AI-powered development environment")
    .replace(/\bkiro\s*ai\s+is\s+me\b/gi, "KiroAI is an AI-powered development environment")
    .replace(/\bkiro\s+is\s+me\b/gi, "Kiro is an AI-powered development environment")
    .replace(/\s*,?\s*(an\s+)?ai-powered\s+development\s+environment\s+(made|built|developed)\s+by\s+anthropic\b/gi, "")
    .replace(/\s+(made|built|developed)\s+by\s+anthropic\b/gi, "")
    .replace(/\s+from\s+anthropic\b/gi, "")
    .replace(/\b(saya|aku)\s+(adalah\s+)?kiro\b/gi, "$1 asisten AI di platform ini")
    .replace(/\b(i\s*(?:am|'m))\s+kiro\b/gi, "$1 an AI assistant in this platform")
    .replace(/\bas\s+kiro\b/gi, "as the assistant in this platform")
    .replace(/\bsebagai\s+kiro\b/gi, "sebagai asisten AI di platform ini");
}

export function estimateMessageTokens(message) {
  return estimateTokens(`${message.role || "user"}: ${contentToText(message.content)}`) + 4;
}

export function estimateMessagesTokens(messages) {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

function createCompactSummary(messages, maxChars) {
  const source = messages
    .map((message, index) => {
      const role = message.role === "assistant" ? "Assistant" : "User";
      const text = contentToText(message.content).replace(/\s+/g, " ").trim();
      if (!text) return null;
      return `${index + 1}. ${role}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");

  if (source.length <= maxChars) return source;
  return `${source.slice(0, Math.max(0, maxChars - 120))}\n[Older conversation summary truncated to fit context budget.]`;
}

export function compactMessagesForContext({ messages, maxContextTokens, maxOutputTokens, systemPrompt = CHAT_SYSTEM_PROMPT }) {
  const baseSystemMessage = { role: "system", content: systemPrompt };
  const fullMessages = [baseSystemMessage, ...messages];
  const fullPromptTokens = estimateMessagesTokens(fullMessages);
  const availablePromptTokens = Math.max(0, maxContextTokens - maxOutputTokens);

  if (fullPromptTokens <= availablePromptTokens) {
    return {
      messages: fullMessages,
      compacted: false,
      omittedMessages: 0,
      promptTokens: fullPromptTokens,
      contextUsed: fullPromptTokens + maxOutputTokens,
      displayTokens: estimateMessagesTokens(messages),
    };
  }

  const recentBudget = Math.max(1_000, Math.floor(availablePromptTokens * 0.75));
  const recentMessages = [];
  let recentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const messageTokens = estimateMessageTokens(messages[i]);
    if (recentMessages.length > 0 && recentTokens + messageTokens > recentBudget) break;
    recentMessages.unshift(messages[i]);
    recentTokens += messageTokens;
  }

  const omittedMessages = messages.length - recentMessages.length;
  const omitted = messages.slice(0, omittedMessages);
  const summaryTokenBudget = Math.max(300, availablePromptTokens - estimateMessageTokens(baseSystemMessage) - recentTokens - 100);
  const summaryChars = Math.max(800, Math.floor(summaryTokenBudget * 3.2));
  const summary = createCompactSummary(omitted, summaryChars);
  const compactSystemMessage = {
    role: "system",
    content: `${systemPrompt}\n\nConversation memory compacted because this chat reached the context window. Use this summary as prior context, then continue from the recent messages.\n\nCompacted earlier conversation:\n${summary}`,
  };
  let compactedMessages = [compactSystemMessage, ...recentMessages];
  let promptTokens = estimateMessagesTokens(compactedMessages);

  while (compactedMessages.length > 2 && promptTokens > availablePromptTokens) {
    compactedMessages.splice(1, 1);
    promptTokens = estimateMessagesTokens(compactedMessages);
  }

  return {
    messages: compactedMessages,
    compacted: true,
    omittedMessages,
    promptTokens,
    contextUsed: promptTokens + maxOutputTokens,
    displayTokens: promptTokens,
  };
}
