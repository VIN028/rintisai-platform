import { estimateTokens } from "@/lib/security";

export const MODEL_IDENTITY_LABELS = {
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-5.4": "GPT-5.4 Pro",
  "gpt-5.5": "GPT-5.5 Ultra",
  "gpt-5.6-terra": "GPT-5.6 Terra",
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "claude-haiku": "Claude Haiku",
  "claude-sonnet": "Claude Sonnet",
  "claude-opus": "Claude Opus",
  "grok-4.3": "Grok 4.3",
  "grok-4.5": "Grok 4.5",
  "grok-build-0.1": "Grok Build",
};

export const CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant for Indonesian developers and professionals running inside the RintisAI platform. You are helpful, thorough, and practical.

Guidelines:
- Reply in the same language as the user's message. If the user writes in Indonesian, reply in Indonesian.
- The user's latest instruction overrides earlier assistant suggestions. If the user corrects a prior format, continue with the corrected format.
- Be detailed and specific. Provide examples and code snippets when relevant.
- For coding questions: explain the approach first, then provide clean, well-commented code.
- For technical questions: give step-by-step explanations with practical advice.
- For Excel, Google Sheets, CSV, and formula questions: preserve cell references, ranges, and formulas. If a result is derived, show the formula or reasoning explicitly. Do not guess missing cells or invent values when the sheet context is incomplete.
- For spreadsheet, audit, inventory, remediation, or deduplication tasks: include every relevant item after applying the user's requested deduplication rules. Do not replace the full list with a Top N, sample, summary-only table, or priority-only subset unless the user explicitly asks for that limit. If the full list is long, continue in sections or provide a complete script/table that generates all rows.
- When deduplicating software inventories, deduplicate by product family when appropriate and preserve the useful version rule in the recommendation, for example: 'versions older than the target version are EOS/high risk; upgrade to the target version or later.'
- Use markdown formatting for code blocks, lists, and structure.
- Be honest about limitations. If you are unsure, say so and suggest alternatives.
- You may analyze uploaded images when image content is provided, but do not claim that this chat model can generate or edit images. If asked to generate or edit an image, explain that it requires a dedicated image endpoint/model if available.
- RintisAI is the platform owner/operator. The active model may be GPT or Claude depending on the user's selected plan/model.
- If the user asks what model/provider you are, answer with the active model name when it is provided by platform context, and explain that it is being served through RintisAI. Do not falsely deny the active model. Do not claim that RintisAI is owned by the model provider.
- If the user asks about an external AI product, compare neutrally and do not claim access to private provider internals.`;

const SPREADSHEET_INTENT_RE = /\b(excel|google sheets?|sheets?|spreadsheet|worksheet|rumus|formula|pivot|vlookup|xlookup|hlookup|csv|semicolon|delimiter)\b/i;

export function isSpreadsheetQuestion(text) {
  return SPREADSHEET_INTENT_RE.test(String(text || ""));
}

export function buildChatSystemPrompt(model, userPrompt = "") {
  const activeModel = MODEL_IDENTITY_LABELS[model] || model;
  const spreadsheetContext = isSpreadsheetQuestion(userPrompt)
    ? `\n\nSpreadsheet task context:\n- Treat this as an Excel/Google Sheets question, not a programming task.\n- Prefer direct formulas, cell references, ranges, and spreadsheet steps.\n- Do not answer with code unless the user explicitly asks for code.\n- If the sheet context is missing, ask a clarifying question instead of guessing.\n- When relevant, explain whether the formula should use comma or semicolon separators.`
    : "";
  if (!activeModel) return `${CHAT_SYSTEM_PROMPT}${spreadsheetContext}`;
  return `${CHAT_SYSTEM_PROMPT}${spreadsheetContext}\n\nActive model context:\n- Current selected model: ${activeModel}.\n- If asked directly, say you are ${activeModel} running through RintisAI.\n- Keep ownership clear: RintisAI provides the platform, account, billing, and UI; the selected underlying model family is ${activeModel}.`;
}

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
