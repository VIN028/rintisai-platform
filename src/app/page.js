"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMaxContextTokens, getMaxOutputTokens, getModelConfig, isModelAllowedForPlan, PLAN_MODEL_ALLOWANCE } from "@/lib/models";
import { PLAN_CATALOG, getPlanDefinition, isApiPlan } from "@/lib/plans";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";
import { API_MODEL_GROUPS, API_PAYG_PRICING, API_TOPUP_AMOUNTS, calculateApiCostRp, calculateApiCostUsd, recommendTopupAmount } from "@/lib/api-products";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  Bot,
  Send,
  LogOut,
  Plus,
  User,
  KeyRound,
  Shield,
  Lock,
  MessageSquare,
  Trash2,
  Edit3,
  Sliders,
  Paperclip,
  Pin,
  Search,
  Globe,
  Code2,
  Package,
  Hammer,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Menu,
  ImagePlus,
  FileText,
  XCircle,
  ArrowDownToLine,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Wallet,
  CreditCard,
  Activity
} from "lucide-react";

const highlightCode = (code, lang) => {
  if (!code) return "";
  const c = (l) => lang && lang.toLowerCase().startsWith(l);
  let h = code;
  h = h.replace(/(\/\/.*$|#.*$)/gm, '<span style="color:#6b7280;font-style:italic">$1</span>');
  h = h.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#34d399">$1</span>');
  h = h.replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#34d399">$1</span>');
  h = h.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span style="color:#34d399">$1</span>');
  const kw = c("py") ? "False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield"
    : c("js") || c("ts") ? "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|typeof|class|extends|import|export|async|await|try|catch|throw"
    : c("sh") || c("bash") ? "echo|cd|ls|rm|mkdir|cp|mv|grep|cat|chmod|sudo|apt|npm|git|docker|curl|wget"
    : "";
  if (kw) h = h.replace(new RegExp("\\b(" + kw + ")\\b", "g"), '<span style="color:#c084fc;font-weight:600">$1</span>');
  if (c("py")) h = h.replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|input|open|type|enumerate|zip|map|filter|sorted)\b/g, '<span style="color:#60a5fa">$1</span>');
  h = h.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#fbbf24">$1</span>');
  h = h.replace(/\b(null|undefined|true|false|NaN|Infinity)\b/g, '<span style="color:#fbbf24">$1</span>');
  return h;
};

const formatMessageContent = (text) => {
  if (!text) return "";

  const escapeAttribute = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const encodeCodeAttribute = (value) => {
    if (typeof window === "undefined") return "";
    return window.btoa(unescape(encodeURIComponent(value)));
  };

  const safeHref = (value) => {
    const raw = String(value || "").trim();
    try {
      const parsed = new URL(raw, window.location.origin);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return "#";
      return escapeAttribute(parsed.href);
    } catch {
      return "#";
    }
  };

  let escaped = text
    .replace(/\\n/g, "\n")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Replace code blocks: ```javascript ... ```
  // Replace code blocks
  escaped = escaped.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const lines = code.split("\n");
    let minIndent = Infinity;
    for (const l of lines) { if (l.trim()) minIndent = Math.min(minIndent, l.length - l.trimStart().length); }
    if (!isFinite(minIndent)) minIndent = 0;
    const dedented = lines.map((l) => l.trim() ? l.slice(minIndent) : "").join("\n").trim();
    const colored = highlightCode(dedented, lang);
    return `<div class="code-block my-3 rounded-lg overflow-hidden">
      <div class="code-block-header">
        <span class="code-lang">${lang || "text"}</span>
        <button type="button" class="code-copy" data-code="${encodeCodeAttribute(dedented)}">Copy</button>
      </div>
      <pre class="code-block-pre">${colored}</pre>
    </div>`;
  });

  // Replace inline code `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-indigo-300 font-semibold">$1</code>');

  // Headers: ### text
  escaped = escaped.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  escaped = escaped.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  escaped = escaped.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

  // Italic: *text*
  escaped = escaped.replace(/\*(.+?)\*/g, '<em class="italic text-gray-300">$1</em>');

  // Links: [text](url)
  escaped = escaped.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, href) => `<a href="${safeHref(href)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline hover:text-indigo-300">${label}</a>`);

  // Collapse 2+ consecutive blank lines into 1
  escaped = escaped.replace(/\n{3,}/g, "\n\n");

  // Markdown pipe tables.
  escaped = escaped.replace(/(^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+\n(?:\|.*\|(?:\n|$))+)/gm, (match) => {
    const rows = match.trim().split("\n").filter(Boolean);
    const headers = rows[0].split("|").slice(1, -1).map((cell) => cell.trim());
    const alignments = rows[1].split("|").slice(1, -1).map((cell) => {
      const value = cell.trim();
      if (value.startsWith(":" ) && value.endsWith(":")) return "text-center";
      if (value.endsWith(":")) return "text-right";
      return "text-left";
    });
    const bodyRows = rows.slice(2).map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));

    return `<div class="my-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
      <table class="min-w-full text-sm border-collapse">
        <thead class="bg-white/[0.05] text-gray-200">
          <tr>${headers.map((header, index) => `<th class="px-4 py-3 font-semibold ${alignments[index] || "text-left"}">${header}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-gray-300">
          ${bodyRows.map((row) => `<tr>${row.map((cell, index) => `<td class="px-4 py-3 ${alignments[index] || "text-left"}">${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  });

  // Models often emit markdown lists with blank lines between items. Keep them
  // in one list so ordered lists increment instead of restarting at 1.
  let normalizedLists;
  do {
    normalizedLists = escaped;
    escaped = escaped
      .replace(/^(\d+\.\s+.+)\n\s*\n(?=\d+\.\s+)/gm, "$1\n")
      .replace(/^(-\s+.+)\n\s*\n(?=-\s+)/gm, "$1\n")
      .replace(/^(\*\s+.+)\n\s*\n(?=\*\s+)/gm, "$1\n");
  } while (escaped !== normalizedLists);

  // Wrap bullet list items in <ul>
  escaped = escaped.replace(/^(\*\s+.*(?:\n\*\s+.*)*)/gm, (match) => {
    const items = match.split("\n").filter(Boolean).map((l) => l.replace(/^\*\s+/, ""));
    return "<ul class=\"list-disc pl-5 my-1\">" + items.map((li) => "<li class=\"text-gray-200 mb-0.5\">" + li + "</li>").join("") + "</ul>";
  });

  // Wrap dash list items in <ul>
  escaped = escaped.replace(/^(-\s+.*(?:\n-\s+.*)*)/gm, (match) => {
    const items = match.split("\n").filter(Boolean).map((l) => l.replace(/^-\s+/, ""));
    return "<ul class=\"list-disc pl-5 my-1\">" + items.map((li) => "<li class=\"text-gray-200 mb-0.5\">" + li + "</li>").join("") + "</ul>";
  });

  // Wrap numbered list items in <ol>
  escaped = escaped.replace(/^(\d+\.\s+.*(?:\n\d+\.\s+.*)*)/gm, (match) => {
    const lines = match.split("\n").filter(Boolean);
    const firstNumber = Number(lines[0]?.match(/^(\d+)\.\s+/)?.[1] || 1);
    const items = lines.map((l) => l.replace(/^\d+\.\s+/, ""));
    const startAttr = firstNumber > 1 ? ` start=\"${firstNumber}\"` : "";
    return `<ol${startAttr} class="list-decimal pl-5 my-1">` + items.map((li) => "<li class=\"text-gray-200 mb-0.5\">" + li + "</li>").join("") + "</ol>";
  });

  // Horizontal rule

  const html = escaped.split("\n").map((line, i, arr) => {
    if (line.includes("<div") || line.includes("</div") || line.includes("<pre") || line.includes("<li") || line.includes("<ul") || line.includes("<ol") || line.includes("<h1") || line.includes("<h2") || line.includes("<h3") || line.includes("<strong") || line.includes("<em") || line.includes("<a ") || line.includes("<hr") || line.includes("<code")) {
      return line;
    }
    if (line.trim() === "") {
      if (arr[i - 1] && arr[i - 1].trim() === "") return "";
      return "<br/>";
    }
    return `<p class="mb-2 leading-relaxed">${line}</p>`;
  }).filter(Boolean).join("");

  return html
    .replace(/<\/ol><br\/?><ol class="list-decimal pl-5 my-1">/g, "")
    .replace(/<\/ol>\s*<ol class="list-decimal pl-5 my-1">/g, "")
    .replace(/<\/ul><br\/?><ul class="list-disc pl-5 my-1">/g, "")
    .replace(/<\/ul>\s*<ul class="list-disc pl-5 my-1">/g, "");
};

const getStoredPreference = (key, fallback, allowedValues) => {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return allowedValues.includes(value) ? value : fallback;
};

const getLastConversationKey = (userId) => `rintis:lastConversation:${userId || "anonymous"}`;
const getModelPreferenceKey = (userId) => `rintis:selectedModel:${userId || "anonymous"}`;
const getReasoningPreferenceKey = (userId) => `rintis:reasoningEffort:${userId || "anonymous"}`;
const getDashboardModePreferenceKey = (userId) => `rintis:dashboardMode:${userId || "anonymous"}`;
const getDashboardSectionPreferenceKey = (userId) => `rintis:dashboardSection:${userId || "anonymous"}`;
const estimateClientTokens = (text) => Math.ceil((text || "").length / 3.8);
const PENDING_STREAM_ID = "__pending_stream__";
const currentTimestamp = () => new Date().getTime();

const imageFileToDataUrl = (file, { maxSide = 1280, quality = 0.75, maxLength = 700_000 } = {}) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith("image/")) {
    reject(new Error("Please upload an image file."));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Failed to read ${file.name || "image"}.`));
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = () => reject(new Error(`Failed to read ${file.name || "image"}.`));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", quality);
      if (base64.length > maxLength) {
        reject(new Error(`${file.name || "Image"} is too large after compression.`));
        return;
      }
      resolve(base64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

const imageDataUrlToFile = async (dataUrl, name = "image.jpg") => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
};

const formatTokenLimit = (tokens) => {
  if (!tokens) return "0";
  if (tokens >= 1_000_000) return `${Math.round(tokens / 10_000) / 100}M`;
  return `${Math.round(tokens / 1000)}k`;
};

const formatTokenUsage = (tokens) => {
  if (!tokens) return "0";
  if (tokens < 1000) return String(Math.round(tokens));
  return formatTokenLimit(tokens);
};

const PLAN_UPGRADE_DETAILS = {
  gpt_chat: { tag: "Codex web chat", models: "GPT-5.4 Mini", context: "400k context", output: "Output-weighted units", api: "Web chat only" },
  gpt_code: { tag: "Codex coding + API", models: "GPT-5.4, GPT-5.5, GPT-5.6 Terra", context: "1.05M context", output: "Output-weighted units", api: "API key included" },
  codex_pro: { tag: "Codex power users", models: "GPT-5.6 Terra, GPT-5.6 Sol", context: "1.05M context", output: "Highest Codex limit", api: "API key included" },
  claude_lite: { tag: "Claude web chat", models: "Claude Haiku, Sonnet", context: "200k context", output: "Sonnet-friendly units", api: "Web chat only" },
  claude_code: { tag: "Claude Code/OpenCode", models: "Claude Haiku, Sonnet, Opus", context: "200k context", output: "Opus premium units", api: "Anthropic-compatible API" },
  claude_pro: { tag: "Claude power users", models: "Claude Haiku, Sonnet, Opus", context: "200k context", output: "Highest Claude limit", api: "Anthropic-compatible API" },
};

const MODEL_PICKER_DETAILS = {
  "gpt-5.4-mini": { label: "GPT-5.4 Mini", sub: "Fast & efficient" },
  "gpt-5.4": { label: "GPT-5.4 Pro", sub: "Balanced & capable" },
  "gpt-5.5": { label: "GPT-5.5 Ultra", sub: "Deep reasoning" },
  "gpt-5.6-terra": { label: "GPT-5.6 Terra", sub: "Efficient 5.6 coding" },
  "gpt-5.6-sol": { label: "GPT-5.6 Sol", sub: "Premium 5.6 reasoning" },
  "claude-sonnet": { label: "Claude Sonnet", sub: "Coding & analysis" },
  "claude-haiku": { label: "Claude Haiku", sub: "Fast Claude model" },
  "claude-opus": { label: "Claude Opus", sub: "High-end Claude model" },
};

const getModelPickerDetail = (model) => MODEL_PICKER_DETAILS[model] || { label: model || "Model", sub: "Available model" };

const getClientModelFamily = (model) => {
  if ((model || "").startsWith("gpt-")) return "gpt";
  if ((model || "").startsWith("claude-")) return "claude";
  if ((model || "").startsWith("grok-")) return "grok";
  return null;
};

const getActivePlanPackages = (packages = []) => packages.filter((item) => item?.status !== "Queued" && item?.status !== "expired" && item?.status !== "cancelled");

const getPackageForModel = (model, packages = []) => {
  const family = getClientModelFamily(model);
  if (!family) return null;
  return getActivePlanPackages(packages)
    .filter((item) => item.family === family)
    .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime())[0] || null;
};

const getPlanForModelAccess = (model, packages = [], fallbackPlan = "free") => {
  const activePackage = getPackageForModel(model, packages);
  if (activePackage?.plan) return activePackage.plan;
  return fallbackPlan;
};

const getAvailableModelsForAccess = (packages = [], fallbackPlan = "free") => {
  const models = new Set(PLAN_MODEL_ALLOWANCE[fallbackPlan] || []);
  for (const item of getActivePlanPackages(packages)) {
    for (const model of PLAN_MODEL_ALLOWANCE[item.plan] || []) models.add(model);
  }
  return Array.from(models).length ? Array.from(models) : Array.from(PLAN_MODEL_ALLOWANCE.free || []);
};

const CHAT_TOOL_OPTIONS = [
  { key: "file_search", label: "File Search", icon: Search, description: "Let the model use attached/project file context when supported." },
  { key: "web_search", label: "Web Search", icon: Globe, description: "Allow live web lookup when the provider supports it." },
  { key: "skills", label: "Skills", icon: Hammer, description: "Enable structured task skills and tool-aware planning." },
  { key: "run_code", label: "Run Code", icon: Code2, description: "Allow code execution/code-interpreter style tool calls when available." },
  { key: "artifacts", label: "Artifacts", icon: Package, description: "Ask for generated files or artifact-style outputs when useful." },
];

const CHAT_TOOL_KEYS = CHAT_TOOL_OPTIONS.map((tool) => tool.key);

const getPinnedToolsPreferenceKey = (userId) => `rintisai:pinned-tools:${userId || "anon"}`;
const getAttachmentModePreferenceKey = (userId) => `rintisai:attachment-mode:${userId || "anon"}`;

const UPGRADE_PLANS = ["gpt_chat", "gpt_code", "codex_pro", "claude_lite", "claude_code", "claude_pro"];
const API_TOPUP_PLANS = ["api_gpt", "api_claude"];
const API_KEY_GROUPS = [
  { key: "codex", label: "Codex", models: "gpt-5.4-mini, gpt-5.4, gpt-5.5, gpt-5.6-terra, gpt-5.6-sol", sampleModel: "gpt-5.6-terra", endpoint: "openai", description: "GPT/Codex models for scripts, editors, and automation." },
  { key: "claude", label: "Claude", models: "claude-haiku, claude-sonnet, claude-opus", sampleModel: "claude-sonnet", endpoint: "anthropic", description: "Claude models for Claude Code, OpenCode, and Anthropic-style agents." },
];

const USE_KEY_TOOLS = [
  { key: "cursor", label: "Cursor", endpoint: "openai", description: "Use RintisAI as an OpenAI-compatible provider in Cursor or editor settings." },
  { key: "cline", label: "Cline", endpoint: "openai", description: "Use OpenAI-compatible mode for Cline and select your RintisAI model ID." },
  { key: "opencode", label: "OpenCode", endpoint: "openai", description: "OpenAI-compatible config for OpenCode and similar coding agents." },
  { key: "kilo", label: "Kilo Code", endpoint: "openai", description: "OpenAI-compatible config for Kilo Code in VS Code." },
  { key: "claude-code", label: "Claude Code", endpoint: "anthropic", description: "Anthropic-compatible environment variables for Claude Code style clients." },
  { key: "continue", label: "Continue", endpoint: "openai", description: "OpenAI-compatible JSON config for Continue." },
  { key: "openai", label: "Custom OpenAI API", endpoint: "openai", description: "Generic cURL request for scripts, bots, and API clients." },
  { key: "anthropic", label: "Custom Anthropic API", endpoint: "anthropic", description: "Generic Messages API request for Anthropic-compatible clients." },
];

const normalizeApiKeyGroup = (scope) => (scope === "gpt" ? "codex" : scope || "codex");
const getApiKeyGroup = (scope) => API_KEY_GROUPS.find((group) => group.key === normalizeApiKeyGroup(scope)) || { key: "all", label: "All", models: "Codex and Claude", sampleModel: "gpt-5.4-mini", endpoint: "openai", description: "Legacy key with access to all available model groups." };
const getToolByKey = (key) => USE_KEY_TOOLS.find((tool) => tool.key === key) || USE_KEY_TOOLS[0];
const getCompatibleUseKeyTools = (group) => USE_KEY_TOOLS.filter((tool) => group.endpoint !== "openai" || tool.endpoint === "openai");
const toAnthropicSampleModel = (model) => ({ "claude-sonnet": "claude-sonnet-5", "claude-haiku": "claude-haiku-4-5", "claude-opus": "claude-opus-4-8" }[model] || model);

const buildUseKeySnippet = ({ toolKey, apiKey, group, apiBaseUrl, apiRootUrl, apiChatCompletionsUrl }) => {
  const tool = getToolByKey(toolKey);
  const model = tool.endpoint === "anthropic" ? toAnthropicSampleModel(group.sampleModel) : group.sampleModel;
  const key = apiKey || "sk-cai-your-key";
  if (tool.key === "continue") {
    return JSON.stringify({
      models: [{
        title: `RintisAI ${group.label}`,
        provider: "openai",
        model,
        apiBase: apiBaseUrl,
        apiKey: key,
      }],
    }, null, 2);
  }
  if (tool.key === "claude-code") {
    return [`export ANTHROPIC_BASE_URL="${apiRootUrl}"`, `export ANTHROPIC_AUTH_TOKEN="${key}"`, "export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1", "export CLAUDE_CODE_ATTRIBUTION_HEADER=0", "", "claude"].join("\n");
  }
  if (tool.endpoint === "anthropic") {
    return [`curl ${apiRootUrl}/messages \\`, `  -H "Authorization: Bearer ${key}" \\`, `  -H "anthropic-version: 2023-06-01" \\`, `  -H "Content-Type: application/json" \\`, `  -d '{"model":"${model}","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'`].join("\n");
  }
  if (["cursor", "cline", "opencode"].includes(tool.key)) {
    return [`Provider: OpenAI-compatible`, `Base URL: ${apiBaseUrl}`, `API Key: ${key}`, `Model: ${model}`, `Chat Completions URL: ${apiChatCompletionsUrl}`].join("\n");
  }
  return [`curl ${apiChatCompletionsUrl} \\`, `  -H "Authorization: Bearer ${key}" \\`, `  -H "Content-Type: application/json" \\`, `  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`].join("\n");
};

const formatPlanPrice = (plan, interval) => (PLAN_CATALOG[plan]?.prices?.[interval] || 0).toLocaleString("id-ID");
const formatPlanUnits = (plan, interval) => {
  const limits = PLAN_CATALOG[plan]?.limits || {};
  if (interval === "3day") return `${formatTokenLimit(limits.threeDay)} units for 3 days`;
  if (interval === "weekly") return `${formatTokenLimit(limits.weekly)} weekly units`;
  return `${formatTokenLimit(limits.monthly)} monthly units`;
};

export default function HomePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState("loading");
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesConvId, setMessagesConvId] = useState(null);
  const [activeContextUsage, setActiveContextUsage] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-5.4-mini");
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [reasonDropOpen, setReasonDropOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 768));
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const [editingConvId, setEditingConvId] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountTab, setAccountTab] = useState("profile");
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("codex");
  const [newKeyQuotaUsd, setNewKeyQuotaUsd] = useState("");
  const [editingApiKey, setEditingApiKey] = useState(null);
  const [usingApiKey, setUsingApiKey] = useState(null);
  const [useKeyTool, setUseKeyTool] = useState("cursor");
  const [latestCreatedApiKey, setLatestCreatedApiKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [attachedImages, setAttachedImages] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [attachmentProgress, setAttachmentProgress] = useState([]);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [enabledChatTools, setEnabledChatTools] = useState([]);
  const [pinnedChatTools, setPinnedChatTools] = useState([]);
  const [attachmentMode, setAttachmentMode] = useState("text");
  const [isCompactViewport, setIsCompactViewport] = useState(() => (typeof window === "undefined" ? false : window.innerWidth < 768));
  const fileInputRef = useRef(null);
  const inputTextareaRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const dashboardPreferenceReadyRef = useRef(false);
  const conversationLoadSeqRef = useRef(0);
  const backgroundStreamsRef = useRef(new Map());
  const activeChatRequestRef = useRef(null);
  const [streamingConversationIds, setStreamingConversationIds] = useState([]);
  const [streamStatusById, setStreamStatusById] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [processTick, setProcessTick] = useState(0);
  const [upgradeStep, setUpgradeStep] = useState("select");
  const [upgradePlan, setUpgradePlan] = useState("pro");
  const [upgradeBillingInterval, setUpgradeBillingInterval] = useState("monthly");
  const [upgradePayment, setUpgradePayment] = useState("gopay");
  const [upgradeRef, setUpgradeRef] = useState("");
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeSuccess, setUpgradeSuccess] = useState("");
  const [upgradeAmount, setUpgradeAmount] = useState(null);
  const [upgradeCode, setUpgradeCode] = useState("");
  const [selectedTopupAmount, setSelectedTopupAmount] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [proofImage, setProofImage] = useState(null);
  const [confirmState, setConfirmState] = useState({ show: false, title: "", message: "", onConfirm: null });
  const [convSearch, setConvSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [copiedResponseIndex, setCopiedResponseIndex] = useState(null);
  const [apiDashboardMode, setApiDashboardMode] = useState(false);
  const [apiDashboardSection, setApiDashboardSection] = useState("overview");
  const [apiLedgerPage, setApiLedgerPage] = useState(1);
  const [customApiTopupAmount, setCustomApiTopupAmount] = useState(18500);
  const [cashoutAmountUsd, setCashoutAmountUsd] = useState("");
  const [cashoutMethod, setCashoutMethod] = useState("gopay");
  const [cashoutRef, setCashoutRef] = useState("");
  const [cashoutReason, setCashoutReason] = useState("");
  const [cashoutError, setCashoutError] = useState("");
  const [cashoutSuccess, setCashoutSuccess] = useState("");
  const [cashoutLoading, setCashoutLoading] = useState(false);

  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);

  const setConversationStreaming = (conversationId, isStreaming) => {
    if (!conversationId) return;
    setStreamingConversationIds((prev) => {
      if (isStreaming) return prev.includes(conversationId) ? prev : [...prev, conversationId];
      return prev.filter((id) => id !== conversationId);
    });
  };

  const setConversationStreamStatus = (conversationId, patch) => {
    if (!conversationId) return;
    setStreamStatusById((prev) => ({
      ...prev,
      [conversationId]: {
        ...(prev[conversationId] || { startedAt: currentTimestamp(), phase: "preparing", hasContent: false }),
        ...patch,
      },
    }));
  };

  const moveConversationStreamStatus = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setStreamStatusById((prev) => {
      const next = { ...prev };
      next[toId] = next[fromId] || { startedAt: currentTimestamp(), phase: "reading_context", hasContent: false };
      delete next[fromId];
      return next;
    });
  };

  const clearConversationStreamStatus = (conversationId) => {
    if (!conversationId) return;
    setStreamStatusById((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const updateConversationMessages = (conversationId, updater) => {
    if (!conversationId) return;
    const current = backgroundStreamsRef.current.get(conversationId) || [];
    const next = updater(current);
    backgroundStreamsRef.current.set(conversationId, next);
    if (activeConvIdRef.current === conversationId) {
      setMessagesConvId(conversationId);
      setMessages(next);
    } else if (conversationId === PENDING_STREAM_ID && !activeConvIdRef.current) {
      setMessagesConvId(null);
      setMessages(next);
    }
  };

  const getStreamStatusLabel = (status) => {
    if (!status) return "Working...";
    if (status.hasContent || status.phase === "generating") return "Generating response...";
    const elapsedMs = Math.max(0, processTick - (status.startedAt || processTick));
    if (status.phase === "reading_context" || elapsedMs < 1_500) return "Reading conversation context...";
    if (status.phase === "contacting_model" || elapsedMs < 4_000) return "Contacting AI model...";
    if (elapsedMs < 10_000) return "AI is reasoning...";
    return "Still working on this...";
  };

  const resizeInputTextarea = () => {
    const textarea = inputTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 360)}px`;
  };

  // Fetch Local API Keys when API Access is enabled for a paid plan.
  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/auth/keys");
      const data = await res.json();
      if (res.ok) {
        setApiKeys(data.keys || []);
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    }
  };

  // Create Local API Key
  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    setKeyError("");
    setLatestCreatedApiKey("");
    try {
      const res = await fetch("/api/auth/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, providerScope: newKeyScope, quotaUsd: Number(newKeyQuotaUsd) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create API key.");
      }
      setLatestCreatedApiKey(data.key?.key || "");
      if (data.key?.key) {
        setToast({ type: "success", message: "API key created. Copy it now because the full key is shown only once." });
      }
      setNewKeyName("");
      setNewKeyScope("codex");
      setNewKeyQuotaUsd("");
      fetchApiKeys();
    } catch (err) {
      setKeyError(err.message);
    }
  };

  const copyText = async (value, label = "Copied.") => {
    const fallbackCopy = (text) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    };

    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
      setToast({ type: "success", message: label });
      return true;
    } catch {
      try {
        fallbackCopy(value);
        setToast({ type: "success", message: label });
        return true;
      } catch {
      setToast({ type: "error", message: "Failed to copy to clipboard." });
      return false;
      }
    }
  };

  const handleCopyStoredApiKey = async (keyId) => {
    try {
      const res = await fetch("/api/auth/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to copy API key.");
      await copyText(data.key, "API key copied.");
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  };

  const handleEditApiKey = (key) => {
    setEditingApiKey({
      id: key.id,
      name: key.name || "",
      providerScope: normalizeApiKeyGroup(key.providerScope),
      quotaUsd: key.quotaUsdMicros ? String(key.quotaUsdMicros / 1_000_000) : "",
      status: key.status || "active",
    });
  };

  const handleUseApiKey = (key) => {
    const group = normalizeApiKeyGroup(key.providerScope);
    const keyGroup = getApiKeyGroup(group);
    const compatibleTools = getCompatibleUseKeyTools(keyGroup);
    setUsingApiKey(key);
    setUseKeyTool(compatibleTools[0]?.key || "cursor");
    if (API_KEY_GROUPS.some((item) => item.key === group)) setNewKeyScope(group);
  };

  const handleUpdateApiKey = async (e) => {
    e.preventDefault();
    if (!editingApiKey?.id) return;
    setKeyError("");
    try {
      const res = await fetch("/api/auth/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          keyId: editingApiKey.id,
          name: editingApiKey.name,
          providerScope: editingApiKey.providerScope,
          quotaUsd: Number(editingApiKey.quotaUsd) || 0,
          status: editingApiKey.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update API key.");
      setEditingApiKey(null);
      setToast({ type: "success", message: "API key updated." });
      await fetchApiKeys();
    } catch (err) {
      setKeyError(err.message);
    }
  };

  const handleToggleApiKey = async (key) => {
    const nextStatus = key.status === "disabled" ? "active" : "disabled";
    try {
      const res = await fetch("/api/auth/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", keyId: key.id, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update API key status.");
      setToast({ type: "success", message: nextStatus === "active" ? "API key enabled." : "API key disabled." });
      await fetchApiKeys();
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  };

  // Delete/Revoke API Key
  const handleDeleteApiKey = async (keyId) => {
    const ok = await showConfirm("Revoke API Key", "Are you sure you want to delete this API key? External apps using this key will stop working immediately.");
    if (!ok) return;
    try {
      const res = await fetch("/api/auth/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      if (res.ok) {
        fetchApiKeys();
        setToast({ type: "success", message: "API key revoked." });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ type: "error", message: data.error || "Failed to revoke API key." });
      }
    } catch (err) {
      console.error("Failed to delete key:", err);
      setToast({ type: "error", message: "Failed to revoke API key." });
    }
  };

  const fetchAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        throw new Error("Unauthorized");
      }
      const data = await response.json();
      if (data.user?.role === "ADMIN") {
        router.replace("/admin");
        return;
      }
      setUser(data.user);
      setProfileName(data.user?.name || "");
      setSubscription(data.subscription);
      setUsage(data.usage);
      setAuthState("authenticated");
    } catch (err) {
      setAuthState("unauthenticated");
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
    return [];
  };

  // 1. Check Authentication on Mount
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([fetchAuth(), fetchConversations()]);
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (activeConvId) {
      window.localStorage.setItem(getLastConversationKey(user.id), activeConvId);
    }
  }, [user?.id, activeConvId]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    let nextPinned = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(getPinnedToolsPreferenceKey(user.id)) || "[]");
      nextPinned = Array.isArray(parsed) ? parsed.filter((key) => CHAT_TOOL_KEYS.includes(key)) : [];
    } catch {
      nextPinned = [];
    }
    const storedAttachmentMode = getStoredPreference(getAttachmentModePreferenceKey(user.id), "text", ["text", "provider"]);
    setPinnedChatTools(nextPinned);
    setEnabledChatTools(nextPinned);
    setAttachmentMode(storedAttachmentMode);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    window.localStorage.setItem(getPinnedToolsPreferenceKey(user.id), JSON.stringify(pinnedChatTools.filter((key) => CHAT_TOOL_KEYS.includes(key))));
  }, [user?.id, pinnedChatTools]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    window.localStorage.setItem(getAttachmentModePreferenceKey(user.id), attachmentMode);
  }, [user?.id, attachmentMode]);

  useEffect(() => {
    if (!user?.id) return;
    const fallbackPlan = isApiPlan(subscription?.plan) && !apiDashboardMode ? "free" : (subscription?.plan || "free");
    const allowedModels = getAvailableModelsForAccess(usage?.packages || [], fallbackPlan);
    const storedModel = getStoredPreference(getModelPreferenceKey(user.id), "gpt-5.4-mini", allowedModels);
    const timer = window.setTimeout(() => {
      const accessPlan = getPlanForModelAccess(storedModel, usage?.packages || [], fallbackPlan);
      setSelectedModel(isModelAllowedForPlan(storedModel, accessPlan) ? storedModel : allowedModels[0]);
      setReasoningEffort(getStoredPreference(getReasoningPreferenceKey(user.id), "medium", ["low", "medium", "high", "xhigh"]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id, subscription?.plan, apiDashboardMode, usage?.packages]);

  useEffect(() => {
    if (!user?.id) return;
    const fallbackPlan = isApiPlan(subscription?.plan) && !apiDashboardMode ? "free" : (subscription?.plan || "free");
    const allowedModels = getAvailableModelsForAccess(usage?.packages || [], fallbackPlan);
    const accessPlan = getPlanForModelAccess(selectedModel, usage?.packages || [], fallbackPlan);
    if (!isModelAllowedForPlan(selectedModel, accessPlan)) {
      const timer = window.setTimeout(() => setSelectedModel(allowedModels[0]), 0);
      return () => window.clearTimeout(timer);
    }
    window.localStorage.setItem(getModelPreferenceKey(user.id), selectedModel);
  }, [user?.id, subscription?.plan, selectedModel, apiDashboardMode, usage?.packages]);

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(getReasoningPreferenceKey(user.id), reasoningEffort);
  }, [user?.id, reasoningEffort]);

  useEffect(() => {
    if (streamingConversationIds.length === 0 && Object.keys(streamStatusById).length === 0) return;
    const timer = setInterval(() => setProcessTick(currentTimestamp()), 1_000);
    return () => clearInterval(timer);
  }, [streamingConversationIds.length, streamStatusById]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(resizeInputTextarea, 0);
    return () => window.clearTimeout(timer);
  }, [inputMessage]);

  useEffect(() => {
    const updateViewportMode = () => setIsCompactViewport(window.innerWidth < 768);
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  // Keep new output visible without stealing scroll when the user is reading older messages.
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 180) {
      chatEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
    }
    setShowScrollBottom(distanceFromBottom > 300);
    setShowScrollTop(container.scrollTop > 400);
  }, [messages]);

  // Show/hide floating scroll-to-top and scroll-to-bottom buttons
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBottom(distanceFromBottom > 300);
      setShowScrollTop(container.scrollTop > 400);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Attach wheel listener natively to prevent passive listener warning
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const handler = (e) => handleChatWheel(e);
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); const el = document.querySelector("input[placeholder*='Search']"); if (el) el.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Keyboard shortcut: Cmd+N for new chat (defined after handleNewChat below)

  const handleSelectConversation = async (id) => {
    const loadSeq = conversationLoadSeqRef.current + 1;
    conversationLoadSeqRef.current = loadSeq;
    activeConvIdRef.current = id;
    setActiveConvId(id);
    setMessagesConvId(id);
    setMessages([]);
    setActiveContextUsage(null);
    if (user?.id) window.localStorage.setItem(getLastConversationKey(user.id), id);
    setLoading(true);
    setErrorBanner("");
    setToolsMenuOpen(false);
    setAttachmentMenuOpen(false);
    try {
      const response = await fetch(`/api/conversations/${id}?model=${encodeURIComponent(selectedModel)}`);
      if (response.ok) {
        const data = await response.json();
        if (conversationLoadSeqRef.current === loadSeq && activeConvIdRef.current === id) {
          const bufferedMessages = backgroundStreamsRef.current.get(id);
          setMessages(bufferedMessages || data.messages || []);
          setMessagesConvId(id);
          setActiveContextUsage(data.contextUsage || null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch conversation detail", err);
    } finally {
      if (conversationLoadSeqRef.current === loadSeq && activeConvIdRef.current === id) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user?.id || conversations.length === 0 || activeConvId) return;
    const lastConversationId = window.localStorage.getItem(getLastConversationKey(user.id));
    const targetId = lastConversationId && conversations.some((c) => c.id === lastConversationId)
      ? lastConversationId
      : conversations[0].id;
    handleSelectConversation(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversations]);

  const handleNewChat = () => {
    conversationLoadSeqRef.current += 1;
    activeConvIdRef.current = null;
    setActiveConvId(null);
    setMessagesConvId(null);
    setActiveContextUsage(null);
    if (user?.id) window.localStorage.removeItem(getLastConversationKey(user.id));
    setMessages([]);
    setErrorBanner("");
    setEnabledChatTools(pinnedChatTools);
  };

  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); handleNewChat(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!activeConvId || messagesConvId !== activeConvId) {
      return;
    }

    let cancelled = false;
    const loadContextUsage = async () => {
      try {
        const response = await fetch(`/api/conversations/${activeConvId}?model=${encodeURIComponent(selectedModel)}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && activeConvIdRef.current === activeConvId) {
          setActiveContextUsage(data.contextUsage || null);
        }
      } catch (err) {
        console.error("Failed to refresh context usage", err);
      }
    };

    loadContextUsage();
    return () => { cancelled = true; };
  }, [activeConvId, messagesConvId, selectedModel]);

  const handleRenameConversation = async (id, e) => {
    e.stopPropagation();
    if (!editTitleInput.trim()) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleInput }),
      });
      if (response.ok) {
        fetchConversations();
        setEditingConvId(null);
      }
    } catch (err) {
      console.error("Failed to rename conversation", err);
    }
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    const ok = await showConfirm("Delete Conversation", "Delete this conversation permanently?");
    if (!ok) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (activeConvId === id) {
          handleNewChat();
        } else if (user?.id && window.localStorage.getItem(getLastConversationKey(user.id)) === id) {
          window.localStorage.removeItem(getLastConversationKey(user.id));
        }
        fetchConversations();
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Failed to logout", err);
    }
  };

  const showConfirm = (title, message) => new Promise((resolve) => {
    setConfirmState({ show: true, title, message, onConfirm: () => { setConfirmState({ show: false }); resolve(true); }, onCancel: () => { setConfirmState({ show: false }); resolve(false); } });
  });

  const showConfirmDismiss = () => { confirmState.onCancel?.(); setConfirmState({ show: false }); };

  const showToast = (message, type = "info") => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };

  const toggleChatTool = (toolKey) => {
    if (!CHAT_TOOL_KEYS.includes(toolKey)) return;
    setEnabledChatTools((prev) => prev.includes(toolKey) ? prev.filter((key) => key !== toolKey) : [...prev, toolKey]);
  };

  const togglePinnedChatTool = (toolKey) => {
    if (!CHAT_TOOL_KEYS.includes(toolKey)) return;
    setPinnedChatTools((prev) => {
      const next = prev.includes(toolKey) ? prev.filter((key) => key !== toolKey) : [...prev, toolKey];
      setEnabledChatTools((enabled) => next.includes(toolKey) && !enabled.includes(toolKey) ? [...enabled, toolKey] : enabled);
      return next;
    });
  };

  const openAttachmentPicker = (mode) => {
    setAttachmentMode(mode);
    setAttachmentMenuOpen(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const isTextAttachment = (file) => {
    const name = (file?.name || "").toLowerCase();
    const type = (file?.type || "").toLowerCase();
    return type.startsWith("text/") || [".txt", ".md", ".markdown", ".csv", ".json", ".jsonl", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rs", ".php", ".rb", ".c", ".cpp", ".h", ".hpp", ".css", ".scss", ".html", ".xml", ".yaml", ".yml", ".toml", ".ini", ".env", ".sql", ".sh", ".zsh", ".log"].some((ext) => name.endsWith(ext));
  };

  const isExtractableAttachment = (file) => {
    const name = (file?.name || "").toLowerCase();
    const type = (file?.type || "").toLowerCase();
    return type.startsWith("image/") || [".pdf", ".docx", ".xlsx", ".zip"].some((ext) => name.endsWith(ext));
  };

  const extractAttachmentText = async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/files/extract", { method: "POST", body: form });
    const raw = await res.text();
    const data = (() => {
      try { return JSON.parse(raw); } catch { return {}; }
    })();
    if (!res.ok) throw new Error(data.error || `Failed to read ${file.name}.`);
    return data;
  };

  const filteredConversations = conversations.filter((c) => !convSearch || c.title.toLowerCase().includes(convSearch.toLowerCase()));

  const handleAddAttachments = async (files, mode = attachmentMode) => {
    const selectedFiles = Array.from(files || []);
    const selectedAttachmentMode = mode === "provider" ? "provider" : "text";
    if (selectedFiles.length > 0 && selectedAttachmentMode === "provider") {
      showToast("Provider upload selected. Files will use provider mode when supported, with text fallback for this model.", "info");
    }
    const progressIds = new Map(selectedFiles.map((file, index) => [file, `${Date.now()}-${index}-${file.name}-${file.size}`]));
    const updateAttachmentProgress = (file, patch) => {
      const id = progressIds.get(file);
      if (!id) return;
      setAttachmentProgress((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      if (patch.state === "done" || patch.state === "error") {
        setTimeout(() => setAttachmentProgress((prev) => prev.filter((item) => item.id !== id)), patch.state === "done" ? 1200 : 4500);
      }
    };
    if (selectedFiles.length > 0) {
      setAttachmentProgress((prev) => [
        ...prev,
        ...selectedFiles.map((file) => ({
          id: progressIds.get(file),
          name: file.name || "attachment",
          status: "Queued",
          percent: 8,
          state: "working",
        })),
      ]);
    }
    const imageFiles = selectedFiles.filter((file) => file?.type?.startsWith("image/"));
    const textFiles = selectedFiles.filter((file) => !file?.type?.startsWith("image/") && isTextAttachment(file));
    const extractionFiles = selectedFiles.filter((file) => !isTextAttachment(file) && isExtractableAttachment(file) && (!file?.type?.startsWith("image/") || !getModelConfig(selectedModel)?.vision));
    const unsupportedFiles = selectedFiles.filter((file) => !isTextAttachment(file) && !isExtractableAttachment(file));

    if (imageFiles.length > 0 && !getModelConfig(selectedModel)?.vision) {
      imageFiles.forEach((file) => updateAttachmentProgress(file, { status: "Images unavailable for this model", percent: 100, state: "error" }));
      showToast("Images are not available for this model. Text files were still attached if supported.", "error");
    }

    const availableSlots = Math.max(0, 3 - attachedImages.length);
    if (getModelConfig(selectedModel)?.vision && imageFiles.length > availableSlots) {
      imageFiles.slice(availableSlots).forEach((file) => updateAttachmentProgress(file, { status: "Image limit reached", percent: 100, state: "error" }));
      showToast(`Maximum ${availableSlots || 0} more image(s) allowed.`, "error");
    }

    for (const file of getModelConfig(selectedModel)?.vision ? imageFiles.slice(0, availableSlots) : []) {
      updateAttachmentProgress(file, { status: "Compressing image", percent: 35, state: "working" });
      if (file.size > 8 * 1024 * 1024) {
        updateAttachmentProgress(file, { status: "Too large", percent: 100, state: "error" });
        showToast(`${file.name} is too large. Max 8MB before compression.`, "error");
        continue;
      }

      try {
        const base64 = await imageFileToDataUrl(file);
        setAttachedImages((prev) => [...prev, { name: file.name, base64, uploadMode: selectedAttachmentMode }]);
        updateAttachmentProgress(file, { status: selectedAttachmentMode === "provider" ? "Provider mode" : "Attached", percent: 100, state: "done" });
      } catch (err) {
        updateAttachmentProgress(file, { status: "Too large after compression", percent: 100, state: "error" });
        showToast(err.message || `${file.name} is still too large after compression.`, "error");
      }
    }

    const availableFileSlots = Math.max(0, 5 - attachedFiles.length);
    if (textFiles.length > availableFileSlots) {
      textFiles.slice(availableFileSlots).forEach((file) => updateAttachmentProgress(file, { status: "File limit reached", percent: 100, state: "error" }));
      showToast(`Maximum ${availableFileSlots || 0} more file(s) allowed.`, "error");
    }

    const maxAttachmentChars = Math.max(45_000, Math.min(1_200_000, Math.floor((contextLimit || 32_000) * 3.1)));
    const perFileTextChars = Math.max(20_000, Math.min(300_000, Math.floor(maxAttachmentChars / 2)));
    const currentChars = attachedFiles.reduce((total, file) => total + file.text.length, 0);
    let nextChars = currentChars;
    for (const file of textFiles.slice(0, availableFileSlots)) {
      updateAttachmentProgress(file, { status: "Reading text", percent: 35, state: "working" });
      if (file.size > 1 * 1024 * 1024) {
        updateAttachmentProgress(file, { status: "Too large", percent: 100, state: "error" });
        showToast(`${file.name} is too large. Max 1MB for text files.`, "error");
        continue;
      }
      try {
        const text = await file.text();
        const normalized = text.replace(/\u0000/g, "").slice(0, perFileTextChars);
        if (!normalized.trim()) {
          updateAttachmentProgress(file, { status: "No readable text", percent: 100, state: "error" });
          showToast(`${file.name} has no readable text.`, "error");
          continue;
        }
        if (nextChars + normalized.length > maxAttachmentChars) {
          updateAttachmentProgress(file, { status: "Too much context", percent: 100, state: "error" });
          showToast("Attached files are too large for one message. Send fewer or shorter files.", "error");
          continue;
        }
        nextChars += normalized.length;
        setAttachedFiles((prev) => [...prev, { name: file.name, type: file.type || "text/plain", size: file.size, text: normalized, uploadMode: selectedAttachmentMode }]);
        updateAttachmentProgress(file, { status: selectedAttachmentMode === "provider" ? "Provider fallback" : "Attached", percent: 100, state: "done" });
      } catch {
        updateAttachmentProgress(file, { status: "Failed", percent: 100, state: "error" });
        showToast(`Failed to read ${file.name}.`, "error");
      }
    }

    const remainingFileSlots = Math.max(0, 5 - attachedFiles.length - textFiles.slice(0, availableFileSlots).length);
    if (extractionFiles.length > remainingFileSlots) {
      extractionFiles.slice(remainingFileSlots).forEach((file) => updateAttachmentProgress(file, { status: "File limit reached", percent: 100, state: "error" }));
      showToast(`Maximum ${remainingFileSlots || 0} more extracted file(s) allowed.`, "error");
    }
    for (const file of extractionFiles.slice(0, remainingFileSlots)) {
      const ext = (file.name || "").toLowerCase().split(".").pop();
      updateAttachmentProgress(file, { status: file.type?.startsWith("image/") ? "Compressing image" : ext === "xlsx" ? "Extracting Excel" : "Extracting file", percent: 35, state: "working" });
      if (!file.type?.startsWith("image/") && file.size > 8 * 1024 * 1024) {
        updateAttachmentProgress(file, { status: "Too large", percent: 100, state: "error" });
        showToast(`${file.name} is too large. Max 8MB.`, "error");
        continue;
      }
      try {
        const uploadFile = file.type?.startsWith("image/") ? await imageDataUrlToFile(await imageFileToDataUrl(file, { maxLength: 650_000 }), file.name.replace(/\.[^.]+$/, "") + ".jpg") : file;
        const extracted = await extractAttachmentText(uploadFile);
        updateAttachmentProgress(file, { status: "Preparing context", percent: 75, state: "working" });
        const normalized = String(extracted.text || "").slice(0, perFileTextChars);
        if (nextChars + normalized.length > maxAttachmentChars) {
          updateAttachmentProgress(file, { status: "Too much context", percent: 100, state: "error" });
          showToast("Attached files are too large for one message. Send fewer or shorter files.", "error");
          continue;
        }
        nextChars += normalized.length;
        setAttachedFiles((prev) => [...prev, { name: extracted.name || file.name, type: extracted.type || file.type || "text/plain", size: extracted.size || file.size, text: normalized, uploadMode: selectedAttachmentMode }]);
        updateAttachmentProgress(file, { status: selectedAttachmentMode === "provider" ? "Provider fallback" : "Attached", percent: 100, state: "done" });
        if (extracted.truncated) showToast(`${file.name} was truncated to fit the context limit.`, "info");
      } catch (err) {
        updateAttachmentProgress(file, { status: "Failed", percent: 100, state: "error" });
        showToast(err.message, "error");
      }
    }

    if (unsupportedFiles.length > 0) {
      unsupportedFiles.forEach((file) => updateAttachmentProgress(file, { status: "Unsupported", percent: 100, state: "error" }));
      showToast("Unsupported file type. Use PDF, DOCX, XLSX, ZIP, images, text, CSV, JSON, Markdown, logs, or code files.", "error");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedImage = (index) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        files.push(item.getAsFile());
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleAddAttachments(files);
    }
  };

  const handleSubmitUpgrade = async (e) => {
    e.preventDefault();
    setUpgradeError("");
    setUpgradeSuccess("");

    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: upgradePlan, billingInterval: ["topup", "api_topup"].includes(upgradePlan) || isApiPlan(upgradePlan) ? undefined : upgradeBillingInterval, paymentMethod: upgradePayment, paymentRef: upgradeRef, paymentProof: proofImage, amount: ["topup", "api_topup"].includes(upgradePlan) || isApiPlan(upgradePlan) ? selectedTopupAmount : undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit upgrade request.");
      }

      setUpgradeSuccess("Request submitted. Transfer the exact amount below.");
      setUpgradeAmount(data.transferAmount);
      setUpgradeCode(data.uniqueCode);
      setUpgradeStep("done");
    } catch (err) {
      setUpgradeError(err.message);
    }
  };

  const openUpgradeModal = async () => {
    setUpgradeStep("select");
    setUpgradePlan(subscription?.plan && UPGRADE_PLANS.includes(subscription.plan) ? subscription.plan : "gpt_chat");
    setUpgradeBillingInterval("monthly");
    setUpgradePayment("gopay");
    setUpgradeRef("");
    setUpgradeError("");
    setUpgradeSuccess("");
    setProofImage(null);
    setSelectedTopupAmount(null);
    setCustomApiTopupAmount(usage?.usdIdrRate || 18500);

    try {
      const res = await fetch("/api/payment");
      const data = await res.json();
      setPaymentDetails(data.paymentDetails || {});
    } catch {}

    setIsUpgradeModalOpen(true);
  };

  const openApiTopupModal = async () => {
    setUpgradeStep("select");
    setUpgradePlan(isApiPlan(subscription?.plan) ? subscription.plan : "api_claude");
    setUpgradeBillingInterval("monthly");
    setUpgradePayment("gopay");
    setUpgradeRef("");
    setUpgradeError("");
    setUpgradeSuccess("");
    setProofImage(null);
    setSelectedTopupAmount(null);

    try {
      const res = await fetch("/api/payment");
      const data = await res.json();
      setPaymentDetails(data.paymentDetails || {});
    } catch {}

    setIsUpgradeModalOpen(true);
  };

  const prepareApiTopup = async (amount) => {
    const topupAmount = Math.round(Number(amount) || 0);
    const apiPlan = isApiPlan(upgradePlan) ? upgradePlan : "api_claude";
    setUpgradePlan(apiPlan);
    setSelectedTopupAmount(topupAmount);
    setUpgradeError("");
    const res = await fetch("/api/upgrade/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: apiPlan, amount: topupAmount }) });
    const data = await res.json();
    if (res.ok) { setUpgradeCode(data.uniqueCode); setUpgradeAmount(data.transferAmount); setUpgradeStep("pay"); }
    else setUpgradeError(data.error || "Failed to prepare top-up.");
  };

  const prepareSubscriptionUpgrade = async (plan) => {
    setUpgradePlan(plan);
    setSelectedTopupAmount(null);
    setUpgradeError("");
    const res = await fetch("/api/upgrade/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billingInterval: upgradeBillingInterval }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUpgradeError(data.error || "Failed to prepare upgrade.");
      return;
    }
    setUpgradeCode(data.uniqueCode);
    setUpgradeAmount(data.transferAmount);
    setUpgradeStep("pay");
  };

  const prepareWebTopup = async (amount) => {
    setUpgradePlan("topup");
    setSelectedTopupAmount(amount);
    setUpgradeError("");
    const res = await fetch("/api/upgrade/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "topup", amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUpgradeError(data.error || "Failed to prepare top-up.");
      return;
    }
    setUpgradeCode(data.uniqueCode);
    setUpgradeAmount(data.transferAmount);
    setUpgradeStep("pay");
  };

  const openPresetApiTopup = async (amount) => {
    setIsAccountModalOpen(false);
    await openApiTopupModal();
    await prepareApiTopup(amount);
  };

  const handleSubmitCashout = async (e) => {
    e.preventDefault();
    setCashoutError("");
    setCashoutSuccess("");
    setCashoutLoading(true);
    try {
      const amountUsdMicros = Math.floor((Number(cashoutAmountUsd) || 0) * 1_000_000);
      const res = await fetch("/api/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdMicros, payoutMethod: cashoutMethod, payoutRef: cashoutRef, reason: cashoutReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit cash-out request.");
      setCashoutSuccess("Cash-out request submitted for admin review.");
      setCashoutAmountUsd("");
      setCashoutRef("");
      setCashoutReason("");
      await fetchAuth();
    } catch (err) {
      setCashoutError(err.message);
    } finally {
      setCashoutLoading(false);
    }
  };

  const openAccountModal = async (tab = "profile") => {
    setAccountTab(tab);
    setAccountError("");
    setAccountMessage("");
    setKeyError("");
    setProfileName(user?.name || "");
    setIsAccountModalOpen(true);

    if (tab === "api" && subscription?.plan !== "free" && subscription?.apiAccessEnabled) {
      await fetchApiKeys();
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setAccountError("");
    setAccountMessage("");
    if (!profileName.trim()) {
      setAccountError("Name is required.");
      return;
    }

    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      setUser(data.user);
      setAccountMessage("Profile updated.");
      fetchAuth();
    } catch (err) {
      setAccountError(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setAccountError("");
    setAccountMessage("");
    if (!currentPassword) {
      setAccountError("Current Password is required.");
      return;
    }
    if (!newPassword) {
      setAccountError("New Password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setAccountError("New Password must be at least 8 characters.");
      return;
    }

    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setAccountMessage("Password changed.");
    } catch (err) {
      setAccountError(err.message);
    }
  };

  const handleResendVerification = async () => {
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend verification email.");
      setAccountMessage(data.message || "Verification email sent.");
    } catch (err) {
      setAccountError(err.message);
    }
  };

  const handleMessageContentClick = async (e) => {
    const button = e.target.closest(".code-copy");
    if (!button) return;

    const encodedCode = button.getAttribute("data-code") || "";
    try {
      const code = decodeURIComponent(escape(window.atob(encodedCode)));
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 2000);
    } catch {
      button.textContent = "Failed";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 2000);
    }
  };

  const handleStopGeneration = () => {
    const activeRequest = activeChatRequestRef.current;
    if (!activeRequest?.controller) return;
    activeRequest.stopped = true;
    activeRequest.controller.abort();
  };

  const handleChatWheel = (e) => {
    const container = chatScrollRef.current;
    if (!container || Math.abs(e.deltaY) < 1 || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (e.target?.closest?.("textarea,input,select,button,[data-no-chat-wheel]")) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;
    const nextScrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + e.deltaY));
    if (nextScrollTop === container.scrollTop) return;
    e.preventDefault();
    container.scrollTop = nextScrollTop;
  };

  // 2. Chat Streaming Submission Handler
  const handleSendMessage = async (e, overrideText = null) => {
    e?.preventDefault?.();
    const messageText = overrideText ?? inputMessage;
    const hasImages = overrideText ? false : attachedImages.length > 0;
    const hasFiles = overrideText ? false : attachedFiles.length > 0;
    if ((!messageText.trim() && !hasImages && !hasFiles) || activeChatBusy || attachmentBusy || limitExceeded || limitBlocked) return;

    setErrorBanner("");
    const userMsgText = messageText;
    const imagesToSend = overrideText ? [] : [...attachedImages];
    const filesToSend = overrideText ? [] : [...attachedFiles];
    setInputMessage("");
    setAttachedImages([]);
    setAttachedFiles([]);
    setLoading(true);
    const sendSeq = conversationLoadSeqRef.current;

    let userContent;
    const fileContext = filesToSend.length > 0
      ? `Uploaded files:\n\n${filesToSend.map((file) => `--- ${file.name} (${file.type || "text/plain"}, ${file.size} bytes) ---\n${file.text}`).join("\n\n")}`
      : "";
    if (hasImages || hasFiles) {
      userContent = [
        ...imagesToSend.map((img) => ({ type: "image_url", image_url: { url: img.base64 } })),
      ];
      if (fileContext) {
        userContent.push({ type: "text", text: fileContext });
      }
      if (userMsgText.trim()) {
        userContent.push({ type: "text", text: userMsgText });
      }
    } else {
      userContent = userMsgText;
    }

    // Optimistic UI update
    const displayContent = hasImages || hasFiles
      ? `${userMsgText || (hasFiles ? "Attached file" : "Attached image")}\n${imagesToSend.map((img) => `[Image: ${img.name}]`).join("\n")}${imagesToSend.length && filesToSend.length ? "\n" : ""}${filesToSend.map((file) => `[File: ${file.name}]`).join("\n")}`
      : userMsgText;
    let streamConvId = activeConvId;
    let streamStatusId = streamConvId || PENDING_STREAM_ID;
    const updatedMessages = [...messages, { role: "user", content: displayContent, _images: hasImages ? imagesToSend : undefined, _files: hasFiles ? filesToSend.map(({ name, type, size }) => ({ name, type, size })) : undefined }];
    setMessagesConvId(streamConvId);
    setActiveContextUsage(null);
    setMessages(updatedMessages);

    // Add placeholder assistant bubble
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    backgroundStreamsRef.current.set(streamStatusId, [...updatedMessages, { role: "assistant", content: "" }]);
    setConversationStreaming(streamStatusId, true);
    setConversationStreamStatus(streamStatusId, { startedAt: currentTimestamp(), phase: "reading_context", hasContent: false });

    let receivedAssistantContent = false;
    let streamIdleTimeout;
    try {
      const requestController = new AbortController();
      activeChatRequestRef.current = { controller: requestController, stopped: false, streamId: streamStatusId };
      const initTimeout = setTimeout(() => requestController.abort(), hasImages || hasFiles ? 90_000 : 70_000);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({
          messages: [{ role: "user", content: displayContent }],
          userContent,
          model: selectedModel,
          conversationId: activeConvId,
          enabledTools: enabledChatTools,
          attachmentMode,
          ...(canUseReasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        }),
      });
      clearTimeout(initTimeout);
      const resetStreamIdleTimeout = () => {
        clearTimeout(streamIdleTimeout);
        streamIdleTimeout = setTimeout(() => requestController.abort(), 120_000);
      };
      resetStreamIdleTimeout();

      if (!response.ok) {
        const rawError = await response.text();
        let errorData = {};
        try { errorData = JSON.parse(rawError); } catch {}
        throw new Error(errorData.error || (rawError.trim().startsWith("<") ? "Server returned an HTML error page while sending the message. Try a smaller file or retry in a moment." : rawError.trim()) || "Failed to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let assistantBuffer = "";
      let flushTimer = null;
      let lastFinishReason = null;

      const flushAssistantContent = () => {
        if (!assistantBuffer) return;
        const nextContent = assistantBuffer;
        assistantBuffer = "";
        receivedAssistantContent = true;
        setConversationStreamStatus(streamStatusId, { phase: "generating", hasContent: true });
        updateConversationMessages(streamConvId || streamStatusId, (prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1] || { role: "assistant", content: "" };
          updated[updated.length - 1] = { ...last, role: "assistant", content: `${last.content || ""}${nextContent}` };
          return updated;
        });
      };

      const appendAssistantContent = (content) => {
        if (!content) return;
        assistantBuffer += content;
        if (!flushTimer) {
          flushTimer = setTimeout(() => {
            flushTimer = null;
            flushAssistantContent();
          }, 50);
        }
      };

      const processSseEvent = (eventText) => {
        const eventLines = eventText.split("\n").map((line) => line.trim()).filter(Boolean);
        const eventName = eventLines.find((line) => line.startsWith("event: "))?.substring(7);
        const dataLines = eventLines
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.substring(6));

        for (const dataContent of dataLines) {
          if (dataContent === "[DONE]") return true;

          try {
            const parsed = JSON.parse(dataContent);
            if (eventName === "metadata" && parsed.conversationId) {
              const previousStreamConvId = streamConvId;
              const previousStreamStatusId = streamStatusId;
              streamConvId = parsed.conversationId;
              streamStatusId = streamConvId;
              if (activeChatRequestRef.current) activeChatRequestRef.current.streamId = streamStatusId;
              if (previousStreamConvId !== streamConvId) {
                const buffered = backgroundStreamsRef.current.get(previousStreamConvId || previousStreamStatusId) || [...updatedMessages, { role: "assistant", content: "" }];
                backgroundStreamsRef.current.delete(previousStreamConvId);
                backgroundStreamsRef.current.delete(previousStreamStatusId);
                backgroundStreamsRef.current.set(streamConvId, buffered);
                setConversationStreaming(previousStreamConvId, false);
                setConversationStreaming(previousStreamStatusId, false);
                setConversationStreaming(streamConvId, true);
                moveConversationStreamStatus(previousStreamStatusId, streamConvId);
              }
              setConversationStreamStatus(streamConvId, { phase: "contacting_model" });
              if (conversationLoadSeqRef.current === sendSeq && activeConvIdRef.current === previousStreamConvId) {
                activeConvIdRef.current = parsed.conversationId;
                setActiveConvId(parsed.conversationId);
                setMessagesConvId(parsed.conversationId);
                if (parsed.contextUsage) setActiveContextUsage(parsed.contextUsage);
              }
              fetchConversations();
            } else if (Object.prototype.hasOwnProperty.call(parsed, "content")) {
              appendAssistantContent(parsed.content);
            } else if (parsed.finishReason) {
              lastFinishReason = parsed.finishReason;
            }
          } catch {
            // Keep malformed events from breaking the stream UI.
          }
        }

        return false;
      };

      let streamDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetStreamIdleTimeout();

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
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushAssistantContent();
      if (lastFinishReason && lastFinishReason !== "stop" && lastFinishReason !== "end_turn") {
        updateConversationMessages(streamConvId || streamStatusId, (prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { ...updated[updated.length - 1], finishReason: lastFinishReason };
          }
          return updated;
        });
      }
      if (!receivedAssistantContent) {
        setMessages(prev => prev.slice(0, prev.length - 2));
        showToast("No response received. The AI may be unavailable or the model key is not configured.", "error");
      }

      if (streamConvId && activeConvIdRef.current === streamConvId) {
        try {
          const contextResponse = await fetch(`/api/conversations/${streamConvId}?model=${encodeURIComponent(selectedModel)}`);
          if (contextResponse.ok && activeConvIdRef.current === streamConvId) {
            const contextData = await contextResponse.json();
            setActiveContextUsage(contextData.contextUsage || null);
          }
        } catch (err) {
          console.error("Failed to refresh context after stream", err);
        }
      }

      // Re-fetch package usage to update the sidebar indicator.
      fetchAuth();

    } catch (err) {
      const wasStopped = err.name === "AbortError" && activeChatRequestRef.current?.stopped;
      if (wasStopped) {
        if (!receivedAssistantContent && conversationLoadSeqRef.current === sendSeq && activeConvIdRef.current === streamConvId) {
          setMessages(prev => prev.slice(0, prev.length - 1));
        }
        showToast("Generation stopped.", "info");
        fetchAuth();
        return;
      }
      if (!streamConvId || activeConvIdRef.current === streamConvId) {
        const timeoutMessage = hasImages
          ? "Request timed out. Try a smaller image or send a shorter prompt."
          : hasFiles
            ? "Request timed out. Try a smaller file or send a shorter prompt."
            : "Request timed out. The AI server took too long to respond. Please retry or choose another model.";
        setErrorBanner(err.name === "AbortError" ? timeoutMessage : err.message);
      }
      if (conversationLoadSeqRef.current === sendSeq && activeConvIdRef.current === streamConvId) {
        setMessages(prev => prev.slice(0, prev.length - 1));
      }
      const lowerError = err.message.toLowerCase();
      const isUsageLimitError = lowerError.includes("usage limit")
        || lowerError.includes("weekly plan usage limit")
        || lowerError.includes("monthly plan usage limit")
        || lowerError.includes("3-day plan usage limit")
        || (lowerError.includes("pemakaian") && lowerError.includes("penuh"));
      if (isUsageLimitError) {
        setLimitBlocked(true);
      }
      fetchAuth();
    } finally {
      clearTimeout(streamIdleTimeout);
      setConversationStreaming(streamConvId, false);
      setConversationStreaming(streamStatusId, false);
      clearConversationStreamStatus(streamConvId);
      clearConversationStreamStatus(streamStatusId);
      if (activeChatRequestRef.current?.streamId === streamStatusId) {
        activeChatRequestRef.current = null;
      }
      if (streamConvId) {
        setTimeout(() => backgroundStreamsRef.current.delete(streamConvId), 1_500);
      }
      if (!activeConvIdRef.current || activeConvIdRef.current === streamConvId) {
        setLoading(false);
      }
    }
  };

  // Helper to color usage progress bars based on percentage.
  const getProgressBarColor = (percentage) => {
    if (percentage >= 90) return "bg-red-500 shadow-md shadow-red-500/20";
    if (percentage >= 75) return "bg-amber-500 shadow-md shadow-amber-500/20";
    return "bg-indigo-500 shadow-md shadow-indigo-500/20";
  };

  const usageItems = usage?.windows || [];
  const activePackages = usage?.packages || [];
  const selectedModelPackage = getPackageForModel(selectedModel, activePackages);
  const selectedUsageWindow = selectedModelPackage ? usageItems.find((item) => item.packageId === selectedModelPackage.id) : null;
  const activeUsageKey = subscription?.billingInterval === "3day" ? "3day" : subscription?.billingInterval === "weekly" ? "weekly" : "monthly";
  const activePackageUsage = selectedUsageWindow || usageItems[0]
    || { key: activeUsageKey, label: "Package", used: 0, limit: 0, percent: 0, status: "Normal", resetAt: null };
  const hasApiDashboardAccess = Boolean(subscription?.apiAccessEnabled || usage?.hasApiWorkspace || usage?.apiCreditBalanceUsdMicros > 0 || (usage?.apiCreditLedger || []).length > 0 || isApiPlan(subscription?.plan));
  const usageSummary = activePackageUsage;
  const usageLimitLabel = usageSummary.limit ? `${formatTokenUsage(usageSummary.used)}/${formatTokenLimit(usageSummary.limit)} units` : "No package limit";
  const limitExceeded = usageSummary.percent >= 100;
  const usageWarning = usageSummary.percent >= 75;
  const [limitBlocked, setLimitBlocked] = useState(false);
  const activePackageCount = getActivePlanPackages(activePackages).length;
  const accountPlanLabel = activePackageCount > 1 ? `${activePackageCount} active packages` : (getPlanDefinition(subscription?.plan)?.label || subscription?.plan || "free");
  const selectedAccessPlan = getPlanForModelAccess(selectedModel, activePackages, subscription?.plan || "free");
  const contextLimit = getMaxContextTokens(selectedModel, selectedAccessPlan);
  const visibleMessages = messagesConvId === activeConvId ? messages : [];
  const localContextUsed = visibleMessages.reduce((total, message) => total + estimateClientTokens(message.content), 0);
  const serverContextUsed = activeContextUsage?.limit === contextLimit ? (activeContextUsage.displayUsed ?? activeContextUsage.used) : 0;
  const contextUsed = Math.max(serverContextUsed, localContextUsed);
  const contextPercentRaw = contextLimit ? Math.min(100, (contextUsed / contextLimit) * 100) : 0;
  const contextPercent = contextPercentRaw > 0 && contextPercentRaw < 1 ? 1 : Math.round(contextPercentRaw);
  const contextPercentLabel = contextPercentRaw > 0 && contextPercentRaw < 1 ? "<1%" : `${contextPercent}%`;
  const contextStatusColor = contextPercent >= 90 ? "text-red-300" : contextPercent >= 75 ? "text-amber-300" : "text-gray-400";
  const activeStreamStatus = streamStatusById[activeConvId] || (!activeConvId ? streamStatusById[PENDING_STREAM_ID] : null);
  const activeChatBusy = (loading && (!activeConvId || messagesConvId === activeConvId)) || streamingConversationIds.includes(activeConvId) || (!activeConvId && streamingConversationIds.includes(PENDING_STREAM_ID));
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const interruptedUserMessage = !activeChatBusy && lastVisibleMessage?.role === "user" && typeof lastVisibleMessage.content === "string" ? lastVisibleMessage.content : "";
  const attachmentBusy = attachmentProgress.some((item) => item.state === "working");
  const currentPlan = isApiPlan(subscription?.plan) && !apiDashboardMode ? "free" : (subscription?.plan || "free");
  const availableModels = getAvailableModelsForAccess(activePackages, currentPlan);
  const selectedModelConfig = getModelConfig(selectedModel);
  const reasoningOptions = selectedModelConfig?.reasoning || [];
  const canUseReasoningEffort = reasoningOptions.length > 0;
  const activeUsdIdrRate = usage?.usdIdrRate || 18500;
  const formatTopupUsd = (amountRp) => `$${(amountRp / activeUsdIdrRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const apiTopupPresetAmounts = Array.from(new Set([activeUsdIdrRate, 25000, 50000, 100000, 250000, 500000, 1000000]))
    .filter((amount) => amount >= activeUsdIdrRate)
    .sort((a, b) => a - b);

  useEffect(() => {
    if (reasoningOptions.length > 0 && !reasoningOptions.includes(reasoningEffort)) {
      setReasoningEffort(reasoningOptions.includes("medium") ? "medium" : reasoningOptions[0]);
    }
  }, [selectedModel, reasoningOptions, reasoningEffort]);

  useEffect(() => {
    if (limitBlocked && usageSummary.percent < 95) setLimitBlocked(false);
  }, [limitBlocked, usageSummary.percent]);

  useEffect(() => {
    if (!activeChatBusy) return;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeChatBusy]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (!user?.id) return;
    const plan = subscription?.plan || "free";
    const storedMode = getStoredPreference(getDashboardModePreferenceKey(user.id), isApiPlan(plan) ? "api" : "chat", ["api", "chat"]);
    const storedSection = getStoredPreference(getDashboardSectionPreferenceKey(user.id), "overview", ["overview", "keys", "usage", "billing", "activity"]);
    const shouldOpenApiDashboard = hasApiDashboardAccess && (isApiPlan(plan) || storedMode === "api");
    dashboardPreferenceReadyRef.current = false;
    const timer = window.setTimeout(() => {
      setApiDashboardMode(shouldOpenApiDashboard);
      setApiDashboardSection(storedSection);
      dashboardPreferenceReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authState, user?.id, subscription?.plan, hasApiDashboardAccess]);

  useEffect(() => {
    if (authState !== "authenticated" || !user?.id || !dashboardPreferenceReadyRef.current) return;
    window.localStorage.setItem(getDashboardModePreferenceKey(user.id), apiDashboardMode ? "api" : "chat");
  }, [authState, user?.id, apiDashboardMode]);

  useEffect(() => {
    if (authState !== "authenticated" || !user?.id || !dashboardPreferenceReadyRef.current) return;
    window.localStorage.setItem(getDashboardSectionPreferenceKey(user.id), apiDashboardSection);
  }, [authState, user?.id, apiDashboardSection]);

  useEffect(() => {
    if (authState === "authenticated" && hasApiDashboardAccess && subscription?.apiAccessEnabled) {
      const timer = window.setTimeout(() => fetchApiKeys(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [authState, hasApiDashboardAccess, subscription?.apiAccessEnabled]);

  const formatCountdown = (targetIsoString, type = "monthly") => {
    if (!targetIsoString) {
      if (type === "weekly" || type === "monthly" || type === "3day") return "Resets in 0 days";
      return "Resets in 0 days";
    }

    const target = new Date(targetIsoString);
    const now = new Date();
    const diffMs = target - now;

    if (diffMs <= 0) {
      if (type === "weekly" || type === "monthly" || type === "3day") return "Resets in 0 days";
      return "Resets in 0 days";
    }

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (type === "weekly" || type === "monthly" || type === "3day") {
      const days = diffDays;
      const hours = diffHours % 24;
      if (days === 0) return `Resets in ${hours} hours`;
      return `Resets in ${days} days ${hours} hours`;
    }

    return "Resets in 0 days";
  };

  const feedbackOverlays = (
    <>
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl text-sm font-semibold animate-fade-in shadow-lg ${toast.type === "error" ? "bg-red-600 text-white" : toast.type === "success" ? "bg-emerald-600 text-white" : "bg-white/10 backdrop-blur text-white border border-white/10"}`}>
          {toast.message}
        </div>
      )}

      {confirmState.show && (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-6 my-4">
            <h3 className="font-bold text-white text-lg mb-2">{confirmState.title}</h3>
            <p className="text-sm text-gray-400 mb-6">{confirmState.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={showConfirmDismiss} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-sm text-gray-300 cursor-pointer">Cancel</button>
              <button onClick={confirmState.onConfirm} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (authState === "authenticated" && hasApiDashboardAccess && apiDashboardMode) {
    const apiBalanceUsd = usage?.apiCreditBalanceUsd || ((usage?.apiCreditBalanceUsdMicros || subscription?.apiCreditBalanceUsdMicros || 0) / 1_000_000);
    const apiBalanceRp = usage?.apiCreditBalanceRp || subscription?.apiCreditBalanceRp || 0;
    const apiLedger = usage?.apiCreditLedger || [];
    const cashoutRequests = usage?.cashoutRequests || [];
    const ongoingCashout = cashoutRequests.find((request) => ["pending", "confirmed"].includes(request.status));
    const apiUsageSummary = usage?.apiUsageSummary || { range: "Last 30 Days", totalRequests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, actualUsdMicros: 0, standardUsdMicros: 0, modelDistribution: [] };
    const apiRootUrl = typeof window !== "undefined" ? window.location.origin.concat("/api") : "https://rintisai.site/api";
    const apiBaseUrl = `${apiRootUrl}/v1`;
    const apiChatCompletionsUrl = `${apiBaseUrl}/chat/completions`;
    const formatUsdMicros = (value) => `$${((value || 0) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    const ledgerPageSize = 5;
    const ledgerTotalPages = Math.max(1, Math.ceil(apiLedger.length / ledgerPageSize));
    const currentLedgerPage = Math.min(apiLedgerPage, ledgerTotalPages);
    const paginatedLedger = apiLedger.slice((currentLedgerPage - 1) * ledgerPageSize, currentLedgerPage * ledgerPageSize);
    const maxModelTokens = Math.max(1, ...apiUsageSummary.modelDistribution.map((row) => row.totalTokens || 0));
    const tokenTotal = (apiUsageSummary.inputTokens || 0) + (apiUsageSummary.outputTokens || 0);
    const inputShare = tokenTotal ? Math.round(((apiUsageSummary.inputTokens || 0) / tokenTotal) * 100) : 0;
    const minimumApiTopupAmount = activeUsdIdrRate;
    const apiBalanceUsdMicros = usage?.apiCreditBalanceUsdMicros || Math.floor(apiBalanceUsd * 1_000_000);
    const canCashout = apiBalanceUsdMicros >= 1_000_000 && !ongoingCashout;
    const cashoutFeeRp = ["gopay", "ovo"].includes(cashoutMethod) ? 2500 : cashoutMethod === "bank" ? 6500 : 0;
    const cashoutGrossRp = Math.floor((Number(cashoutAmountUsd) || 0) * activeUsdIdrRate);
    const cashoutNetRp = Math.max(0, cashoutGrossRp - cashoutFeeRp);
    const apiDashboardNav = [
      { key: "overview", label: "Overview", sub: "Balance and pricing", icon: Wallet },
      { key: "keys", label: "API Keys", sub: `${apiKeys.length} active keys`, icon: KeyRound },
      { key: "usage", label: "Usage", sub: `${apiUsageSummary.totalRequests.toLocaleString("en-US")} requests`, icon: BarChart3 },
      { key: "billing", label: "Billing", sub: canCashout ? "Cash-out available" : "Top-up and payout", icon: CreditCard },
      { key: "activity", label: "Activity", sub: `${apiLedger.length} ledger rows`, icon: Activity },
    ];
    return (
      <>
      <main className="min-h-screen bg-main text-white overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-300 border border-indigo-500/20"><KeyRound size={20} /></div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">API Dashboard</h1>
                <p className="text-sm text-gray-400">Unified pay-as-you-go API workspace for Codex and Claude with model-based pricing.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setApiDashboardMode(false)} className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-sm text-gray-300 transition cursor-pointer">Open Web Chat</button>
              {isApiPlan(subscription?.plan) && <button onClick={openApiTopupModal} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition cursor-pointer">Top Up API Credit</button>}
              <button onClick={handleLogout} className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-sm text-gray-300 transition cursor-pointer">Logout</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[240px_1fr] gap-4 items-start">
            <aside className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 lg:sticky lg:top-6">
              <div className="px-3 py-2 border-b border-white/5 mb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">Workspace</p>
                <p className="text-xs text-gray-400 mt-1">Unified API PAYG</p>
              </div>
              <div className="space-y-1">
                {apiDashboardNav.map((item) => {
                  const Icon = item.icon;
                  const active = apiDashboardSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setApiDashboardSection(item.key)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition cursor-pointer ${active ? "border-indigo-500/30 bg-indigo-500/10 text-white" : "border-transparent text-gray-400 hover:border-white/5 hover:bg-white/[0.04] hover:text-gray-200"}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold"><Icon size={15} className={active ? "text-indigo-300" : "text-gray-500"} />{item.label}</span>
                      <span className="block mt-0.5 pl-6 text-[11px] text-gray-500">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 space-y-5">
          {apiDashboardSection === "overview" && (
          <>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white"><Activity size={16} className="text-emerald-300" />API status <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">Operational</span></div>
              <Link href="/status" className="w-fit rounded-lg border border-white/5 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-gray-300 hover:bg-white/[0.08]">View Status</Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {API_MODEL_GROUPS.map((group) => (
                <div key={group.key} className="flex items-center justify-between gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs">
                  <span className="font-semibold text-gray-200">{group.label}</span>
                  <span className="text-emerald-300 capitalize">{group.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-emerald-300">API Balance</p>
              <div className="text-4xl font-black mt-2">${apiBalanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
              <p className="text-sm text-gray-400 mt-2">Equivalent ±Rp {apiBalanceRp.toLocaleString("id-ID")} at Rp {activeUsdIdrRate.toLocaleString("id-ID")}/USD. Unused balance can be cashed out after admin review, minimum $1.00, one active request at a time.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-3">PAYG Pricing</p>
              <div className="grid sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(API_PAYG_PRICING).map(([modelId, pricing]) => (
                  <div key={modelId} className="rounded-xl border border-white/5 bg-black/10 p-3">
                    <div className="font-bold text-white">{pricing.label}</div>
                    <div className="text-gray-400 mt-1">${pricing.inputUsdPerMillion} input / 1M</div>
                    <div className="text-gray-400">${pricing.outputUsdPerMillion} output / 1M</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">charged per model used</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          </>
          )}

          {apiDashboardSection === "billing" && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-emerald-300 mb-2">Cash-Out</p>
                <h2 className="text-lg font-bold text-white">Request unused API balance cash-out</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">You can request up to your remaining API PAYG balance. Minimum request is $1.00. Balance is deducted only after admin completes the payout.</p>
                {ongoingCashout && <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Active request: ${(ongoingCashout.amountUsdMicros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} · {ongoingCashout.status}</div>}
              </div>
              <form onSubmit={handleSubmitCashout} className="grid sm:grid-cols-[1fr_0.9fr] gap-2 w-full lg:max-w-xl">
                <div className="flex gap-2 sm:col-span-2">
                  <input type="number" min="1" step="0.000001" value={cashoutAmountUsd} onChange={(e) => setCashoutAmountUsd(e.target.value)} disabled={!canCashout || cashoutLoading} placeholder="Amount in USD" className="flex-1 glass-input rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
                  <button type="button" disabled={!canCashout || cashoutLoading} onClick={() => setCashoutAmountUsd((apiBalanceUsdMicros / 1_000_000).toFixed(6).replace(/\.?(0+)$/, ""))} className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs font-bold text-gray-300 disabled:opacity-40 cursor-pointer">Max</button>
                </div>
                <select value={cashoutMethod} onChange={(e) => setCashoutMethod(e.target.value)} disabled={!canCashout || cashoutLoading} className="glass-input rounded-xl px-3 py-2.5 text-sm disabled:opacity-50">
                  <option value="gopay" className="bg-slate-900">GoPay (fee Rp2.500)</option>
                  <option value="ovo" className="bg-slate-900">OVO (fee Rp2.500)</option>
                  <option value="bca" className="bg-slate-900">BCA (fee Rp0)</option>
                  <option value="bank" className="bg-slate-900">Other Bank (fee Rp6.500)</option>
                  <option value="crypto" className="bg-slate-900">Crypto (fee Rp0)</option>
                </select>
                <input type="text" value={cashoutRef} onChange={(e) => setCashoutRef(e.target.value)} disabled={!canCashout || cashoutLoading} placeholder="Payout account / wallet" className="glass-input rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
                <input type="text" value={cashoutReason} onChange={(e) => setCashoutReason(e.target.value)} disabled={!canCashout || cashoutLoading} placeholder="Reason (optional)" className="sm:col-span-2 glass-input rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
                {cashoutError && <div className="sm:col-span-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-300">{cashoutError}</div>}
                {cashoutSuccess && <div className="sm:col-span-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs text-emerald-300">{cashoutSuccess}</div>}
                <div className="sm:col-span-2 rounded-lg border border-white/5 bg-black/10 p-2 text-[11px] text-gray-400">Estimated payout: Rp {cashoutGrossRp.toLocaleString("id-ID")} - fee Rp {cashoutFeeRp.toLocaleString("id-ID")} = <span className="font-bold text-emerald-300">Rp {cashoutNetRp.toLocaleString("id-ID")}</span></div>
                <button type="submit" disabled={!canCashout || cashoutLoading} className="sm:col-span-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 disabled:opacity-40 cursor-pointer">{cashoutLoading ? "Submitting..." : "Request Cash-Out"}</button>
              </form>
            </div>
          </div>
          )}

          {apiDashboardSection === "keys" && (
          <div className="space-y-4 mb-6 min-w-0">
            <div className="min-w-0 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold">API Keys</h2>
                  <p className="text-xs text-gray-500">Create scoped keys for Codex or Claude tools.</p>
                </div>
                <button onClick={fetchApiKeys} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-gray-300 cursor-pointer">Refresh</button>
              </div>
              {keyError && <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{keyError}</div>}
              {latestCreatedApiKey && (
                <div className="mb-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs">
                  <p className="font-bold text-emerald-300">New API key</p>
                  <p className="font-mono break-all mt-1 text-white">{latestCreatedApiKey}</p>
                  <button onClick={() => copyText(latestCreatedApiKey, "API key copied.")} className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">Copy</button>
                </div>
              )}
              <div className="space-y-3">
                {apiKeys.length === 0 ? <p className="rounded-xl border border-white/5 bg-black/10 px-3 py-6 text-center text-xs text-gray-500">No API keys yet.</p> : apiKeys.map((k) => {
                  const group = getApiKeyGroup(k.providerScope);
                  return (
                    <div key={k.id} className="rounded-xl border border-white/5 bg-black/10 p-3 text-xs">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white break-words">{k.name}</span>
                            <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 font-bold text-indigo-200">{group.label}</span>
                            <span className={`rounded-lg border px-2 py-1 font-bold ${k.status === "disabled" ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{k.status === "disabled" ? "Disabled" : "Active"}</span>
                          </div>
                          <div className="mt-1 font-mono text-indigo-300 break-all">{k.key}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap lg:justify-end lg:shrink-0">
                          <button type="button" onClick={() => handleUseApiKey(k)} className="inline-flex h-8 items-center justify-center rounded-lg bg-indigo-600/15 px-3 text-[11px] font-bold text-indigo-200 hover:bg-indigo-600/25 cursor-pointer">Use</button>
                          {k.canCopyFull && <button type="button" onClick={() => handleCopyStoredApiKey(k.id)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-white/[0.04] px-3 text-[11px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer" title="Copy full key"><Copy size={13} />Copy</button>}
                          <button type="button" onClick={() => handleToggleApiKey(k)} className="inline-flex h-8 items-center justify-center rounded-lg bg-white/[0.04] px-3 text-[11px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer">{k.status === "disabled" ? "Enable" : "Disable"}</button>
                          <button type="button" onClick={() => handleEditApiKey(k)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-white/[0.04] px-3 text-[11px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer"><Edit3 size={13} />Edit</button>
                          <button type="button" onClick={() => handleDeleteApiKey(k.id)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-red-500/10 px-3 text-[11px] font-bold text-red-300 hover:bg-red-500/15 cursor-pointer"><Trash2 size={13} />Delete</button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><div className="text-[10px] uppercase tracking-wide text-gray-500">Today</div><div className="mt-1 font-mono text-gray-200">{formatUsdMicros(k.usageTodayUsdMicros)}</div></div>
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><div className="text-[10px] uppercase tracking-wide text-gray-500">30 Days</div><div className="mt-1 font-mono text-gray-200">{formatUsdMicros(k.usage30dUsdMicros)}</div></div>
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><div className="text-[10px] uppercase tracking-wide text-gray-500">Quota</div><div className="mt-1 text-gray-200">{k.quotaUsdMicros ? formatUsdMicros(k.quotaUsdMicros) : "Unlimited"}</div></div>
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><div className="text-[10px] uppercase tracking-wide text-gray-500">Created</div><div className="mt-1 text-gray-200">{new Date(k.createdAt).toLocaleDateString("en-US")}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl border border-white/5 bg-black/10 p-3">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-white">Create New Key</h3>
                  <p className="text-[11px] text-gray-500">Pick one group and optionally set a rolling 30-day USD quota.</p>
                </div>
                <form onSubmit={handleCreateApiKey} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_140px_auto] lg:items-end">
                  <label className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-gray-500">Name<input type="text" required data-label="Key Name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Example: VS Code Codex" className="mt-1 w-full glass-input px-3.5 py-2.5 rounded-xl text-xs normal-case tracking-normal" /></label>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Group<select value={newKeyScope} onChange={(e) => setNewKeyScope(e.target.value)} className="mt-1 w-full glass-input px-3 py-2.5 rounded-xl text-xs normal-case tracking-normal">
                    {API_KEY_GROUPS.map((group) => <option key={group.key} value={group.key} className="bg-slate-900">{group.label}</option>)}
                  </select></label>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Quota<input type="number" min="0" step="0.000001" value={newKeyQuotaUsd} onChange={(e) => setNewKeyQuotaUsd(e.target.value)} placeholder="USD" className="mt-1 w-full glass-input px-3.5 py-2.5 rounded-xl text-xs normal-case tracking-normal" /></label>
                  <button type="submit" className="h-10 w-full whitespace-nowrap rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-500 cursor-pointer lg:w-auto">Create</button>
                </form>
              </div>
              {editingApiKey && (
                <form onSubmit={handleUpdateApiKey} className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3 grid lg:grid-cols-[1fr_140px_120px_120px_auto_auto] gap-2 text-xs">
                  <input type="text" value={editingApiKey.name} onChange={(e) => setEditingApiKey((prev) => ({ ...prev, name: e.target.value }))} className="glass-input px-3 py-2 rounded-lg" />
                  <select value={editingApiKey.providerScope} onChange={(e) => setEditingApiKey((prev) => ({ ...prev, providerScope: e.target.value }))} className="glass-input px-3 py-2 rounded-lg">
                    {API_KEY_GROUPS.map((group) => <option key={group.key} value={group.key} className="bg-slate-900">{group.label}</option>)}
                  </select>
                  <input type="number" min="0" step="0.000001" value={editingApiKey.quotaUsd} onChange={(e) => setEditingApiKey((prev) => ({ ...prev, quotaUsd: e.target.value }))} placeholder="Quota USD" className="glass-input px-3 py-2 rounded-lg" />
                  <select value={editingApiKey.status} onChange={(e) => setEditingApiKey((prev) => ({ ...prev, status: e.target.value }))} className="glass-input px-3 py-2 rounded-lg"><option value="active" className="bg-slate-900">Active</option><option value="disabled" className="bg-slate-900">Disabled</option></select>
                  <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white cursor-pointer">Save</button>
                  <button type="button" onClick={() => setEditingApiKey(null)} className="rounded-lg border border-white/5 bg-white/[0.04] px-3 py-2 font-bold text-gray-300 cursor-pointer">Cancel</button>
                </form>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold">Quick Start</h2>
                <Link href="/docs/api" className="rounded-lg border border-white/5 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-white/[0.08]">Full Docs</Link>
              </div>
              <div className="mb-4 grid gap-2 text-xs md:grid-cols-3">
                <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Claude Code Base</div>
                    <button type="button" onClick={() => copyText(apiRootUrl, "Claude Code base copied.")} className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer" title="Copy Claude Code base">
                      <Copy size={11} />Copy
                    </button>
                  </div>
                  <button type="button" onClick={() => copyText(apiRootUrl, "Claude Code base copied.")} className="mt-1 break-all text-left font-mono text-indigo-300 cursor-pointer">{apiRootUrl}</button>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">OpenAI Base</div>
                    <button type="button" onClick={() => copyText(apiBaseUrl, "OpenAI base copied.")} className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer" title="Copy OpenAI base">
                      <Copy size={11} />Copy
                    </button>
                  </div>
                  <button type="button" onClick={() => copyText(apiBaseUrl, "OpenAI base copied.")} className="mt-1 break-all text-left font-mono text-indigo-300 cursor-pointer">{apiBaseUrl}</button>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase tracking-wide text-gray-500">{usingApiKey ? "Selected Key Group" : "Available Groups"}</div><div className="mt-1 text-gray-300">{usingApiKey ? getApiKeyGroup(usingApiKey.providerScope).label : "Codex, Claude"}</div>{usingApiKey && <div className="mt-1 break-words font-mono text-[10px] text-indigo-200">{getApiKeyGroup(usingApiKey.providerScope).models}</div>}</div>
              </div>
              {usingApiKey && (() => {
                const group = getApiKeyGroup(usingApiKey.providerScope);
                const compatibleTools = getCompatibleUseKeyTools(group);
                const selectedTool = compatibleTools.some((tool) => tool.key === useKeyTool) ? getToolByKey(useKeyTool) : compatibleTools[0];
                const snippet = buildUseKeySnippet({ toolKey: selectedTool.key, apiKey: usingApiKey.key, group, apiBaseUrl, apiRootUrl, apiChatCompletionsUrl });
                return (
                  <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-3 text-xs">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-white">Use Key: {usingApiKey.name}</div>
                        <div className="mt-1 text-gray-400">{group.label} group. Models: <span className="font-mono text-indigo-200">{group.models}</span></div>
                      </div>
                      <button type="button" onClick={() => setUsingApiKey(null)} className="w-fit p-1.5 rounded-lg hover:bg-white/[0.08] text-gray-400 cursor-pointer"><X size={14} /></button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                      {compatibleTools.map((tool) => (
                        <button
                          key={tool.key}
                          type="button"
                          onClick={() => setUseKeyTool(tool.key)}
                          className={`rounded-lg px-3 py-2 text-[11px] font-bold transition cursor-pointer ${selectedTool.key === tool.key ? "bg-indigo-600 text-white" : "bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"}`}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-bold text-white">{selectedTool.label}</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{selectedTool.description}</p>
                        </div>
                        <button type="button" onClick={() => copyText(snippet, `${selectedTool.label} config copied.`)} className="w-full rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white cursor-pointer sm:w-auto">Copy Config</button>
                      </div>
                      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-[11px] text-gray-300">{snippet}</pre>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                      <button type="button" onClick={() => copyText(apiBaseUrl, "OpenAI-compatible base copied.")} className="rounded-md bg-white/[0.04] px-2 py-1 text-indigo-200 cursor-pointer">Copy OpenAI Base</button>
                      <button type="button" onClick={() => copyText(apiRootUrl, "Anthropic-compatible base copied.")} className="rounded-md bg-white/[0.04] px-2 py-1 text-indigo-200 cursor-pointer">Copy Anthropic Base</button>
                      <button type="button" onClick={() => copyText(group.sampleModel, "Model ID copied.")} className="rounded-md bg-white/[0.04] px-2 py-1 text-indigo-200 cursor-pointer">Copy Model</button>
                    </div>
                  </div>
                );
              })()}
              {!usingApiKey && <p className="rounded-xl border border-white/5 bg-black/10 p-3 text-xs text-gray-500">Click <span className="font-bold text-gray-300">Use</span> on a key to show a ready-to-copy setup snippet for that key group.</p>}
              <div className="hidden">
                <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                  <div className="font-bold text-white mb-1">Claude Code</div>
                  <div className="text-gray-500 mb-2">Use Anthropic-compatible env vars.</div>
                  <button type="button" onClick={() => copyText(apiRootUrl, "Claude Code base copied.")} className="text-left text-indigo-300 hover:text-indigo-200 font-mono break-all cursor-pointer">{apiRootUrl}</button>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                  <div className="font-bold text-white mb-1">OpenAI-Compatible</div>
                  <div className="text-gray-500 mb-2">For Cursor, OpenCode, Continue, Cline, and scripts.</div>
                  <button type="button" onClick={() => copyText(apiChatCompletionsUrl, "Chat Completions URL copied.")} className="text-left text-indigo-300 hover:text-indigo-200 font-mono break-all cursor-pointer">{apiChatCompletionsUrl}</button>
                </div>
              </div>
              <pre className="hidden">{`curl ${apiChatCompletionsUrl} \\
  -H "Authorization: Bearer sk-cai-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-5.6-terra","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
            </div>
          </div>
          )}

          {apiDashboardSection === "usage" && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
              <div>
                <h2 className="text-lg font-bold">Usage Records</h2>
                <p className="text-xs text-gray-500">View and analyze your API usage history. Range: {apiUsageSummary.range || "Last 30 Days"}</p>
              </div>
              <div className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-gray-400 w-fit">Granularity: Summary</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-5">
              <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase text-gray-500 font-bold">Total Requests</div><div className="text-xl font-black mt-1">{apiUsageSummary.totalRequests.toLocaleString("en-US")}</div><div className="text-[10px] text-gray-500">in selected range</div></div>
              <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase text-gray-500 font-bold">Total Tokens</div><div className="text-xl font-black mt-1">{formatTokenUsage(apiUsageSummary.totalTokens)}</div><div className="text-[10px] text-gray-500">In: {formatTokenUsage(apiUsageSummary.inputTokens)} / Out: {formatTokenUsage(apiUsageSummary.outputTokens)}</div></div>
              <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase text-gray-500 font-bold">Actual Cost</div><div className="text-xl font-black mt-1 text-emerald-300">{formatUsdMicros(apiUsageSummary.actualUsdMicros)}</div><div className="text-[10px] text-gray-500">charged to balance</div></div>
              <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase text-gray-500 font-bold">Standard Cost</div><div className="text-xl font-black mt-1 text-gray-300">{formatUsdMicros(apiUsageSummary.standardUsdMicros)}</div><div className="text-[10px] text-gray-500">official estimate</div></div>
              <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="text-[10px] uppercase text-gray-500 font-bold">Savings</div><div className="text-xl font-black mt-1 text-indigo-300">{apiUsageSummary.standardUsdMicros ? `${Math.max(0, Math.round((1 - (apiUsageSummary.actualUsdMicros / apiUsageSummary.standardUsdMicros)) * 100))}%` : "-"}</div><div className="text-[10px] text-gray-500">vs official</div></div>
            </div>
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-3 mb-5">
              <div className="rounded-xl border border-white/5 bg-black/10 p-4">
                <div className="flex items-center gap-2 mb-3"><BarChart3 size={15} className="text-indigo-300" /><h3 className="text-sm font-bold text-white">Model Usage</h3></div>
                <div className="space-y-3">
                  {apiUsageSummary.modelDistribution.length === 0 ? <div className="py-6 text-center text-xs text-gray-500">No model usage yet.</div> : apiUsageSummary.modelDistribution.map((row) => (
                    <div key={row.model} className="space-y-1.5">
                      <div className="flex justify-between gap-3 text-xs"><span className="font-semibold text-white">{row.model}</span><span className="font-mono text-indigo-200">{formatTokenUsage(row.totalTokens)}</span></div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, (row.totalTokens / maxModelTokens) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/10 p-4">
                <h3 className="text-sm font-bold text-white mb-3">Token Mix</h3>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden flex"><div className="bg-indigo-500" style={{ width: `${inputShare}%` }} /><div className="bg-amber-500" style={{ width: `${100 - inputShare}%` }} /></div>
                <div className="flex justify-between mt-2 text-[11px] text-gray-400"><span>Input {inputShare}%</span><span>Output {100 - inputShare}%</span></div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs"><div className="rounded-lg bg-white/[0.03] p-3"><div className="text-gray-500">Input</div><div className="font-mono text-indigo-200 mt-1">{formatTokenUsage(apiUsageSummary.inputTokens)}</div></div><div className="rounded-lg bg-white/[0.03] p-3"><div className="text-gray-500">Output</div><div className="font-mono text-amber-200 mt-1">{formatTokenUsage(apiUsageSummary.outputTokens)}</div></div></div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/10">
              <table className="w-full text-xs text-left border-collapse">
                <thead><tr className="border-b border-white/10"><th className="py-2.5 px-3 text-gray-500">Model</th><th className="py-2.5 px-3 text-gray-500">Requests</th><th className="py-2.5 px-3 text-gray-500">Tokens</th><th className="py-2.5 px-3 text-gray-500">In</th><th className="py-2.5 px-3 text-gray-500">Out</th><th className="py-2.5 px-3 text-gray-500">Actual</th><th className="py-2.5 px-3 text-gray-500">Standard</th></tr></thead>
                <tbody>
                  {apiUsageSummary.modelDistribution.length === 0 ? (
                    <tr><td colSpan={7} className="py-5 px-3 text-center text-gray-500">No API usage yet.</td></tr>
                  ) : apiUsageSummary.modelDistribution.map((row) => (
                    <tr key={row.model} className="border-b border-white/5 last:border-0"><td className="py-2.5 px-3 font-bold text-white">{row.model}</td><td className="py-2.5 px-3 text-gray-300">{row.requests.toLocaleString("en-US")}</td><td className="py-2.5 px-3 text-gray-300">{formatTokenUsage(row.totalTokens)}</td><td className="py-2.5 px-3 text-gray-400">{formatTokenUsage(row.inputTokens)}</td><td className="py-2.5 px-3 text-gray-400">{formatTokenUsage(row.outputTokens)}</td><td className="py-2.5 px-3 text-emerald-300">{formatUsdMicros(row.actualUsdMicros)}</td><td className="py-2.5 px-3 text-gray-400">{formatUsdMicros(row.standardUsdMicros)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {apiDashboardSection === "activity" && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold">Recent API Credit Activity</h2>
                <p className="text-xs text-gray-500">Page {currentLedgerPage} of {ledgerTotalPages}</p>
              </div>
              {apiLedger.length > ledgerPageSize && <div className="flex gap-2"><button disabled={currentLedgerPage <= 1} onClick={() => setApiLedgerPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg bg-white/[0.04] border border-white/5 disabled:opacity-40 hover:bg-white/[0.08] cursor-pointer"><ChevronLeft size={14} /></button><button disabled={currentLedgerPage >= ledgerTotalPages} onClick={() => setApiLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))} className="p-2 rounded-lg bg-white/[0.04] border border-white/5 disabled:opacity-40 hover:bg-white/[0.08] cursor-pointer"><ChevronRight size={14} /></button></div>}
            </div>
            {apiLedger.length === 0 ? <p className="text-xs text-gray-500">No credit activity yet.</p> : (
              <div className="space-y-2">
                {paginatedLedger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 p-3 text-xs">
                    <div>
                      <div className="font-bold text-white capitalize">{entry.type}{entry.modelUsed ? ` · ${entry.modelUsed}` : ""}</div>
                      <div className="text-gray-500">{new Date(entry.createdAt).toLocaleString("id-ID")}</div>
                    </div>
                    <div className={entry.amountUsdMicros >= 0 ? "text-emerald-300 font-bold" : "text-red-300 font-bold"}>{entry.amountUsdMicros >= 0 ? "+" : "-"}${(Math.abs(entry.amountUsdMicros || 0) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
            </div>
          </div>
        </div>
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl glass-panel rounded-3xl p-6 my-4 relative">
              <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-gray-400 cursor-pointer"><X size={18} /></button>
              <h2 className="text-xl font-black text-white mb-1">Top Up API Credit</h2>
              <p className="text-sm text-gray-400 mb-5">Minimum top-up {formatTopupUsd(minimumApiTopupAmount)} atau Rp {minimumApiTopupAmount.toLocaleString("id-ID")}. Saldo masuk setelah admin konfirmasi pembayaran. Unused balance can be cashed out after admin review, minimum $1.00, one active request at a time.</p>
              {upgradeStep === "select" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Custom Amount</label>
                    <div className="flex gap-2">
                      <input type="number" min={minimumApiTopupAmount} step="1000" value={customApiTopupAmount} onChange={(e) => setCustomApiTopupAmount(e.target.value)} className="flex-1 glass-input rounded-xl px-4 py-3 text-sm" placeholder={`Min Rp ${minimumApiTopupAmount.toLocaleString("id-ID")}`} />
                      <button type="button" onClick={() => prepareApiTopup(customApiTopupAmount)} className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer">Continue</button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">Current rate: $1 = Rp {activeUsdIdrRate.toLocaleString("id-ID")}. Estimated credit: {formatTopupUsd(Number(customApiTopupAmount) || 0)}.</p>
                  </div>
                  <div className="space-y-2">
                  {apiTopupPresetAmounts.map((amount) => (
                    <button key={amount} onClick={() => prepareApiTopup(amount)} className="w-full p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] flex justify-between text-sm cursor-pointer">
                      <span>Top Up Rp {amount.toLocaleString("id-ID")} <span className="text-gray-500">({formatTopupUsd(amount)})</span></span><span className="text-gray-400">&rarr;</span>
                    </button>
                  ))}
                  </div>
                  {upgradeError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{upgradeError}</div>}
                </div>
              )}
              {upgradeStep === "pay" && (
                <form onSubmit={handleSubmitUpgrade} noValidate>
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-5 text-center">
                    <p className="text-xs text-gray-400 mb-2">Transfer exactly</p>
                    <p className="text-2xl font-black text-white">Rp {upgradeAmount?.toLocaleString("id-ID") || "-"}</p>
                    <p className="text-xs text-gray-500 mt-2">Unique code: <span className="text-indigo-300 font-bold text-sm">{upgradeCode || "-"}</span></p>
                  </div>
                  <div className="space-y-4 mb-6">
                    <select value={upgradePayment} onChange={(e) => setUpgradePayment(e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm">
                      <option value="gopay" className="bg-slate-900">GoPay</option>
                      <option value="ovo" className="bg-slate-900">OVO</option>
                      <option value="bank" className="bg-slate-900">Bank Transfer</option>
                      <option value="crypto" className="bg-slate-900">Crypto</option>
                    </select>
                    <input type="text" required value={upgradeRef} onChange={(e) => setUpgradeRef(e.target.value)} placeholder="Phone / account / wallet reference" className="w-full glass-input rounded-xl px-4 py-3 text-sm" />
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-gray-400 cursor-pointer hover:bg-white/[0.08]">
                      <ImagePlus size={14} /> Upload Screenshot
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files[0]; if (file) { try { setProofImage(await imageFileToDataUrl(file, { maxLength: 650_000 })); } catch (err) { setProofImage(null); setUpgradeError(err.message || "Failed to read screenshot."); } } }} />
                    </label>
                    {proofImage && <img src={proofImage} alt="proof" className="w-20 h-20 rounded-lg object-cover border border-white/10" />}
                    {upgradeError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{upgradeError}</div>}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setUpgradeStep("select")} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/5 text-sm font-semibold cursor-pointer">Back</button>
                    <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer">Submit Request</button>
                  </div>
                </form>
              )}
              {upgradeStep === "done" && <div className="text-center p-6"><h3 className="text-lg font-bold text-white">Request Submitted</h3><p className="text-sm text-gray-400 mt-2">Admin will add your API credit after payment review.</p></div>}
            </div>
          </div>
        )}
      </main>
      {feedbackOverlays}
      </>
    );
  }

  return (
    <>
      {authState === "loading" && <div className="flex h-screen items-center justify-center bg-main"><div className="text-gray-400 text-sm">Loading...</div></div>}

      {authState === "unauthenticated" && (
        <LandingPage />
      )}

      {authState === "authenticated" && (
    <div className="flex h-screen min-h-0 overflow-hidden bg-main">

      {sidebarOpen && <div className="fixed inset-0 z-10 bg-black/55 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 🚀 SIDEBAR COMPONENT */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 h-full glass-panel flex-col shrink-0 overflow-hidden md:relative md:inset-auto md:flex ${sidebarOpen ? "flex" : "hidden"}`}
        style={{ width: sidebarOpen ? `min(${sidebarWidth}px, 86vw)` : 0, minWidth: 0, transition: "width 0.25s ease" }}
      >
        {sidebarOpen && <>
        {/* Drag handle */}
        {sidebarOpen && (
          <div
            className="absolute top-0 right-0 hidden w-1.5 h-full cursor-col-resize z-30 hover:bg-indigo-500/30 transition-colors md:block"
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging(true);
              const startX = e.clientX;
              const startW = sidebarWidth;
              const onMove = (ev) => { setSidebarWidth(Math.min(500, Math.max(220, startW + (ev.clientX - startX)))); };
              const onUp = () => { setDragging(false); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
          />
        )}

        {/* Sidebar Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <Bot size={20} />
            </div>
            <span className="font-bold text-white tracking-wide">RintisAI</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="p-1.5 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* New Chat Action */}
        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="w-full py-3 px-4 bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-300 hover:text-white font-medium rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Conversations History List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1.5">
          <div className="px-4 pb-1">
            <input
              type="text"
              placeholder="Search conversations..."
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs"
            />
          </div>
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`group p-3 rounded-xl cursor-pointer transition-all duration-150 relative ${activeConvId === conv.id ? "bg-white/10 text-white font-medium border border-white/5 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-12">
                <MessageSquare size={16} className={`shrink-0 ${activeConvId === conv.id ? "text-indigo-400" : "text-gray-500"}`} />
                {editingConvId === conv.id ? (
                  <input
                    type="text"
                    value={editTitleInput}
                    onChange={(e) => setEditTitleInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white w-full focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameConversation(conv.id, e);
                      if (e.key === "Escape") setEditingConvId(null);
                    }}
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="truncate text-sm">{conv.title}</div>
                    {streamingConversationIds.includes(conv.id) ? (
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-indigo-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        {getStreamStatusLabel(streamStatusById[conv.id])}
                      </div>
                    ) : conv.latestPreview && <div className="truncate text-[10px] text-gray-500">{conv.latestPreview}</div>}
                  </div>
                )}
              </div>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f0f1a] rounded-lg px-1.5 py-1">
                {editingConvId === conv.id ? (
                  <button
                    onClick={(e) => handleRenameConversation(conv.id, e)}
                    className="p-1 hover:bg-white/10 text-emerald-400 rounded cursor-pointer"
                  >
                    <Check size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConvId(conv.id);
                        setEditTitleInput(conv.title);
                      }}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-indigo-300 rounded cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-red-400 rounded cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/conversations/${conv.id}/export?format=md`, "_blank");
                      }}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-indigo-300 rounded cursor-pointer"
                      title="Export"
                    >
                      <ArrowDownToLine size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 📊 ACTIVE USAGE PROGRESS WIDGET */}
        {usage && user && (
          <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-3">
            <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-3 space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest block">Active Plan</span>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <span className="text-sm font-semibold capitalize text-white flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    {getPlanDefinition(subscription?.plan)?.shortLabel || subscription?.plan || "free"}
                  </span>
              <button
                onClick={() => openUpgradeModal()}
                disabled={false}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] disabled:text-gray-600 disabled:cursor-not-allowed text-[11px] font-bold text-white rounded-lg transition active:scale-95 cursor-pointer"
              >
                Upgrade
              </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-gray-400">{usageSummary.label || "Package"} Usage</span>
                  <button onClick={() => openAccountModal("plan")} className="text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer">
                    View details
                  </button>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getProgressBarColor(usageSummary.percent)}`}
                    style={{ width: `${Math.max(usageSummary.percent, 2)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                  <span>{usageSummary.percent}% used</span>
                  <span className="font-mono">{usageLimitLabel}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 font-mono truncate">{user.email}</div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => openAccountModal("profile")}
                className="flex items-center justify-center gap-1.5 text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg py-2 font-semibold transition cursor-pointer"
              >
                <User size={14} />
                Account
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/15 border border-red-500/10 rounded-lg py-2 font-semibold transition cursor-pointer"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        )}
        </>}
      </aside>

      {/* 💬 MAIN CHAT WORKSPACE AREA */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full relative" onWheelCapture={handleChatWheel}>

        {/* Top Header Bar */}
        <header className="min-h-14 sm:min-h-16 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 bg-slate-950/20 backdrop-blur-md z-10">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer"
            >
              <Menu size={20} />
            </button>

            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelDropOpen(!modelDropOpen)}
                className="flex max-w-[calc(100vw-96px)] sm:max-w-none items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] border border-white/5 text-white text-xs sm:text-sm font-medium cursor-pointer transition"
              >
                <Sliders size={14} className="text-indigo-400" />
                <span className="truncate">{getModelPickerDetail(selectedModel).label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {modelDropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-52 glass-panel rounded-xl border border-white/10 shadow-xl z-50 py-1">
                    {availableModels.map((modelId) => {
                      const detail = getModelPickerDetail(modelId);
                      return (
                        <button key={modelId} onClick={() => { setSelectedModel(modelId); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === modelId ? "text-white" : "text-gray-400"}`}>
                          <div className="flex-1"><div className="font-medium">{detail.label}</div><div className="text-[10px] text-gray-500 mt-0.5">{detail.sub}</div></div>
                          {selectedModel === modelId && <span className="text-indigo-400 text-xs">&#10003;</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => openUpgradeModal()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition md:hidden"
            >
              <Sparkles size={13} />
              Upgrade
            </button>
            <button
              onClick={() => openAccountModal("profile")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-200 text-xs font-semibold cursor-pointer transition md:hidden"
            >
              <User size={13} />
              Account
            </button>
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold capitalize text-gray-200 md:hidden">
              {getPlanDefinition(subscription?.plan)?.shortLabel || subscription?.plan || "free"}
            </span>

            {/* Reasoning selector */}
            {canUseReasoningEffort && (
              <div className="relative hidden sm:flex items-center gap-1.5 border-l border-white/10 pl-3 ml-1">
                <Sparkles size={13} className="text-amber-400" />
                <div className="relative">
                  <button
                    onClick={() => setReasonDropOpen(!reasonDropOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 text-amber-300 text-xs font-medium cursor-pointer transition"
                  >
                    <Sparkles size={12} />
                    {reasoningEffort === "low" ? "Low" : reasoningEffort === "medium" ? "Medium" : reasoningEffort === "xhigh" ? "X-High" : "High"}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  {reasonDropOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setReasonDropOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 w-36 glass-panel rounded-xl border border-white/10 shadow-xl z-50 py-1">
                        {reasoningOptions.map((r) => (
                          <button key={r} onClick={() => { setReasoningEffort(r); setReasonDropOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between capitalize ${reasoningEffort === r ? "text-amber-300" : "text-gray-400"}`}>
                            {r === "xhigh" ? "x-high" : r} {reasoningEffort === r && <span className="text-amber-400">&#10003;</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {hasApiDashboardAccess && (
              <button
                onClick={() => setApiDashboardMode(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer transition"
              >
                <KeyRound size={13} />
                <span className="hidden sm:inline">API Dashboard</span>
                <span className="sm:hidden">API</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-3 ml-1">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                {activeContextUsage?.compacted ? "Compacted" : "Context"}
              </span>
              <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${contextPercent >= 90 ? "bg-red-500" : contextPercent >= 75 ? "bg-amber-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.max(contextPercent, visibleMessages.length > 0 ? 2 : 0)}%` }}
                />
              </div>
              <span className={`text-[11px] font-mono ${contextStatusColor}`}>{contextPercentLabel}</span>
              <span className="text-[10px] text-gray-600 font-mono">{formatTokenUsage(contextUsed)}/{formatTokenLimit(contextLimit)}</span>
            </div>
          </div>
        </header>

        {usage && user && isCompactViewport && (
          <div className="border-b border-white/5 bg-slate-950/30 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-bold text-gray-300">{usageSummary.label || "Package"} Usage</span>
              <span className="shrink-0 text-gray-400">{usageSummary.percent}% used</span>
              <span className="shrink-0 font-mono text-gray-400">{usageLimitLabel}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className={`h-full rounded-full transition-all ${getProgressBarColor(usageSummary.percent)}`} style={{ width: `${Math.max(usageSummary.percent, 2)}%` }} />
            </div>
          </div>
        )}

        {/* Messages Feed Viewport */}
        <div ref={chatScrollRef} className="chat-scroll-container flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6" style={{ WebkitOverflowScrolling: "touch", scrollbarGutter: "stable" }}>
          {limitExceeded || limitBlocked ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex gap-3 items-start max-w-5xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Usage limit reached</span>
                <span className="block mt-0.5">Your plan limit has been reached. Please upgrade or wait for the reset.</span>
              </div>
            </div>
          ) : errorBanner && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-start max-w-5xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Error:</span>
                <span className="block mt-0.5">{errorBanner}</span>
              </div>
            </div>
          )}
          {interruptedUserMessage && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-100 text-sm flex flex-col gap-3 max-w-5xl mx-auto sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="font-bold block">Generation interrupted</span>
                <span className="block mt-0.5 text-xs text-amber-200/80">The last prompt has no assistant response. Retry it to continue.</span>
              </div>
              <button type="button" onClick={(e) => handleSendMessage(e, interruptedUserMessage)} disabled={activeChatBusy || limitExceeded || limitBlocked} className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40 cursor-pointer">Retry</button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-5xl mx-auto space-y-5 mt-8 sm:mt-16 px-2">
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                <Bot size={36} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Hi{user ? `, ${user.name}` : ""}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-2">How can I help today?</p>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 pt-1">
                {[
                  { label: "Explain code", prompt: "Explain this code in simple terms:" },
                  { label: "Write function", prompt: "Write a JavaScript function that:" },
                  { label: "Debug error", prompt: "I'm getting this error. How do I fix it?" },
                  { label: "Translate", prompt: "Translate the following to English:" },
                ].map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => setInputMessage(qa.prompt)}
                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-gray-300 cursor-pointer transition"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full pt-2">
                {[
                  { title: "Explain REST vs GraphQL", prompt: "Explain the difference between REST API and GraphQL", detail: "Brief comparison of two API concepts" },
                  { title: "Validate email in JS", prompt: "Create a JavaScript regex function to validate email addresses", detail: "Practical email validation helper" },
                  { title: "SQL vs NoSQL", prompt: "What are the key differences between SQL and NoSQL databases?", detail: "When to use which database type" },
                  { title: "HTTPS explained", prompt: "Explain how HTTPS works in simple terms", detail: "Encryption, certificates, and handshake" },
                  { title: "Sort array in Python", prompt: "Write a Python function to sort an array of numbers", detail: "Quick sorting algorithm example" },
                  { title: "Write a README", prompt: "Write a README.md template for a Node.js project", detail: "Professional doc template" },
                ].map((card) => (
                  <button
                    key={card.title}
                    onClick={() => setInputMessage(card.prompt)}
                    className="glass-card p-3 sm:p-4 rounded-xl text-left cursor-pointer transition"
                  >
                    <span className="font-semibold block text-white text-xs sm:text-sm mb-0.5">{card.title}</span>
                    <span className="text-[10px] sm:text-[11px] text-gray-400">{card.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat messages loop */
            <div className="w-full max-w-6xl mx-auto space-y-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Bot avatar */}
                  {msg.role !== "user" && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 select-none">
                      <Bot size={16} />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`max-w-[92%] sm:max-w-[86%] lg:max-w-[82%] rounded-2xl px-4 py-2.5 text-[14px] leading-7 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-md" : ""} ${msg.role === "assistant" ? "relative pt-9 pr-12 bg-white/[0.04] border border-white/5 rounded-bl-md" : ""}`}
                  >
                    {msg.role === "user" ? (
                      <div>
                        {msg._images && msg._images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg._images.map((img, i) => (
                              <img key={i} src={img.base64} alt={img.name} className="max-w-[120px] max-h-32 rounded-lg object-cover border border-white/10" />
                            ))}
                          </div>
                        )}
                        {msg._files && msg._files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg._files.map((file, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-lg bg-black/15 border border-white/10 text-[11px] text-white/90">
                                <FileText size={12} className="shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    ) : (
                      msg.content === "" && activeChatBusy && index === messages.length - 1 ? (
                        <div className="flex items-center gap-2 py-1.5 px-1 text-gray-400">
                          <div className="flex items-center gap-1">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                          </div>
                          <span className="text-xs font-medium">{getStreamStatusLabel(activeStreamStatus)}</span>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={async () => {
                              const copied = await copyText(msg.content || "", "Response copied.");
                              if (copied) {
                                setCopiedResponseIndex(index);
                                window.setTimeout(() => {
                                  setCopiedResponseIndex((current) => (current === index ? null : current));
                                }, 1500);
                              }
                            }}
                            className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/30 px-2.5 py-1.5 text-[11px] font-bold text-gray-200 hover:bg-white/[0.08] cursor-pointer"
                            title="Copy response"
                          >
                            <Copy size={13} />{copiedResponseIndex === index ? "Copied" : "Copy"}
                          </button>
                          <div
                            className="message-content break-words"
                            onClick={handleMessageContentClick}
                            dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                          />
                          {activeChatBusy && index === messages.length - 1 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                              {getStreamStatusLabel(activeStreamStatus)}
                            </div>
                          )}
                          {msg.finishReason === "length" && (
                            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 leading-relaxed">
                              Response terpotong oleh batas token. Coba ketik &quot;Lanjutkan&quot; atau kirim ulang dengan instruksi lebih ringkas.
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to top / bottom floating buttons */}
        {showScrollTop && (
          <button
            onClick={() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="absolute top-20 right-4 z-20 p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition cursor-pointer shadow-lg"
            title="Scroll to top"
          >
            <ChevronUp size={18} />
          </button>
        )}
        {showScrollBottom && (
          <button
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
            className="absolute bottom-20 right-4 z-20 p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition cursor-pointer shadow-lg"
            title="Scroll to bottom"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Input Bar Form */}
        <footer className="p-3 sm:p-6 bg-gradient-to-t from-main via-main to-transparent">
          {(limitExceeded || limitBlocked || usageWarning) && (
            <div className={`max-w-6xl mx-auto mb-3 p-3 rounded-xl border text-sm flex gap-3 items-start ${limitExceeded || limitBlocked ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-500/5 border-amber-500/20 text-amber-300"}`}>
              <AlertTriangle size={17} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">{limitExceeded || limitBlocked ? "Usage limit reached" : "Usage nearly full"}</span>
                <span className="block mt-0.5">
                  {limitExceeded || limitBlocked
                    ? "Your plan limit has been reached. Upgrade or wait for the reset."
                    : `${usageSummary.label || "Usage"} is ${usageSummary.percent}% used. You can keep chatting, but you may need to upgrade soon.`}
                </span>
              </div>
            </div>
          )}
          {attachmentProgress.length > 0 && (
            <div className="max-w-6xl mx-auto mb-3 space-y-2">
              {attachmentProgress.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 text-xs ${item.state === "error" ? "border-red-500/20 bg-red-500/10 text-red-200" : item.state === "done" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-indigo-500/20 bg-indigo-500/10 text-indigo-100"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0" />
                      <span className="truncate font-semibold">{item.name}</span>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-80">{item.status}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
                    <div className={`h-full rounded-full transition-all ${item.state === "error" ? "bg-red-400" : item.state === "done" ? "bg-emerald-400" : "bg-indigo-400"}`} style={{ width: `${Math.max(8, Math.min(100, item.percent || 8))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {attachedImages.length > 0 && (
            <div className="max-w-6xl mx-auto mb-3 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative w-20 rounded-lg overflow-hidden border border-white/10 bg-white/[0.04]">
                  <img src={img.base64} alt={img.name} className="h-16 w-full object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[10px] text-gray-200">{img.name}</span>
                  <button onClick={() => removeAttachedImage(i)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white cursor-pointer">
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="max-w-6xl mx-auto mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 max-w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs text-gray-200">
                  <FileText size={14} className="shrink-0 text-indigo-300" />
                  <span className="truncate max-w-[180px]">{file.name}</span>
                  <span className="text-gray-500 shrink-0">{Math.max(1, Math.round(file.size / 1024))}KB</span>
                  <button type="button" onClick={() => removeAttachedFile(i)} className="text-gray-500 hover:text-red-300 cursor-pointer">
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="max-w-6xl mx-auto relative flex items-center gap-2">
            <input
              type="file"
              accept="image/*,.pdf,.docx,.xlsx,.zip,.txt,.md,.markdown,.csv,.json,.jsonl,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.php,.rb,.c,.cpp,.h,.hpp,.css,.scss,.html,.xml,.yaml,.yml,.toml,.ini,.env,.sql,.sh,.zsh,.log,text/*"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleAddAttachments(e.target.files, attachmentMode)}
              className="hidden"
            />
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => { setToolsMenuOpen((open) => !open); setAttachmentMenuOpen(false); }}
                className={`relative p-2.5 rounded-xl border transition cursor-pointer ${enabledChatTools.length > 0 ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-200" : "bg-white/[0.04] hover:bg-white/[0.08] border-white/5 text-gray-400 hover:text-gray-200"}`}
                title="Tools"
              >
                <Sliders size={18} />
                {enabledChatTools.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">{enabledChatTools.length}</span>}
              </button>
              {toolsMenuOpen && (
                <div className="absolute bottom-12 left-0 z-40 w-72 rounded-2xl border border-white/10 bg-[#171717] p-2 shadow-2xl shadow-black/50">
                  <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Tools</div>
                  {CHAT_TOOL_OPTIONS.map((tool) => {
                    const Icon = tool.icon;
                    const enabled = enabledChatTools.includes(tool.key);
                    const pinned = pinnedChatTools.includes(tool.key);
                    return (
                      <div key={tool.key} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/[0.04]">
                        <button type="button" onClick={() => toggleChatTool(tool.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-indigo-500/15 text-indigo-200" : "bg-white/[0.04] text-gray-400"}`}><Icon size={14} /></span>
                          <span className="min-w-0"><span className="block text-xs font-bold text-gray-100">{tool.label}</span><span className="block truncate text-[10px] text-gray-500">{tool.description}</span></span>
                        </button>
                        <button type="button" onClick={() => togglePinnedChatTool(tool.key)} className={`rounded-lg p-1.5 cursor-pointer ${pinned ? "text-cyan-300 bg-cyan-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"}`} title={pinned ? "Pinned for new chats" : "Pin for new chats"}>
                          <Pin size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => { setAttachmentMenuOpen((open) => !open); setToolsMenuOpen(false); }}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-gray-400 hover:text-gray-200 transition cursor-pointer"
                title={attachmentMode === "provider" ? "Upload to Provider" : "Upload as Text"}
              >
                <Paperclip size={18} />
              </button>
              {attachmentMenuOpen && (
                <div className="absolute bottom-12 left-0 z-40 w-60 rounded-2xl border border-white/10 bg-[#171717] p-2 shadow-2xl shadow-black/50">
                  <button type="button" onClick={() => openAttachmentPicker("provider")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left cursor-pointer ${attachmentMode === "provider" ? "bg-indigo-500/10 text-indigo-200" : "text-gray-300 hover:bg-white/[0.04]"}`}>
                    <ImagePlus size={15} /><span><span className="block text-xs font-bold">Upload to Provider</span><span className="block text-[10px] text-gray-500">Native upload when available</span></span>
                  </button>
                  <button type="button" onClick={() => openAttachmentPicker("text")} className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left cursor-pointer ${attachmentMode === "text" ? "bg-indigo-500/10 text-indigo-200" : "text-gray-300 hover:bg-white/[0.04]"}`}>
                    <FileText size={15} /><span><span className="block text-xs font-bold">Upload as Text</span><span className="block text-[10px] text-gray-500">Extract into prompt context</span></span>
                  </button>
                </div>
              )}
            </div>
            <textarea
              ref={inputTextareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onPaste={handlePaste}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 360) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={limitExceeded || limitBlocked ? "Usage limit reached - upgrade to continue" : getModelConfig(selectedModel)?.vision ? "Type your message here... (Enter to send, paste images/files)" : "Type your message here... (Enter to send, attach files)"}
              rows={1}
              className="w-full glass-input pr-14 pl-5 py-4 rounded-2xl text-sm focus:outline-none resize-none overflow-y-auto shadow-2xl shadow-black/45"
            />
            <button
              type={activeChatBusy ? "button" : "submit"}
              onClick={activeChatBusy ? handleStopGeneration : undefined}
              disabled={!activeChatBusy && ((!inputMessage.trim() && attachedImages.length === 0 && attachedFiles.length === 0) || attachmentBusy || limitExceeded || limitBlocked)}
              className={`p-2.5 rounded-xl text-white transition flex items-center justify-center cursor-pointer shadow-lg ${activeChatBusy ? "bg-red-600 hover:bg-red-500 shadow-red-600/15" : "bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] disabled:text-gray-600 shadow-indigo-600/15"}`}
              title={activeChatBusy ? "Stop generating" : attachmentBusy ? "Wait for attachments to finish processing" : "Send message"}
            >
              {activeChatBusy ? <XCircle size={16} /> : <Send size={16} />}
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-500 mt-3 font-medium uppercase tracking-wide">
            RintisAI - Your AI Workspace
          </p>
        </footer>
      </main>

      {/* 💎 PREMIUM UPGRADE / SUBSCRIPTION PLAN MODAL */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-5xl glass-panel p-5 sm:p-7 rounded-2xl relative my-4">
            <button
              onClick={() => { setIsUpgradeModalOpen(false); setUpgradeStep("select"); }}
              className="absolute right-4 top-4 p-1.5 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="text-amber-400" />
              Upgrade Subscription
            </h3>

            {upgradeStep === "select" && (
              <>
                <p className="text-sm text-gray-400 mb-5 max-w-2xl">
                  {`Choose a Codex, Claude, or API product. Current plan: ${getPlanDefinition(subscription?.plan)?.label || subscription?.plan || "free"}.`}
                </p>
                {isApiPlan(subscription?.plan) && (
                  <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div>
                        <h4 className="font-bold text-white text-base">API Pay-As-You-Go</h4>
                        <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">Top up saldo untuk API-only Codex atau Claude. Setelah admin approve, dashboard berubah menjadi API keys, usage, dan quick start.</p>
                      </div>
                      <span className="self-start text-[10px] rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-emerald-300 font-bold whitespace-nowrap">PAYG</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-300 mb-4">
                      {API_TOPUP_PLANS.map((plan) => (
                        <button key={plan} type="button" onClick={() => setUpgradePlan(plan)} className={`rounded-lg border px-3 py-1.5 text-left cursor-pointer ${upgradePlan === plan ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-black/10 border-white/5"}`}>
                          {PLAN_CATALOG[plan].label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                      {apiTopupPresetAmounts.slice(0, 6).map((amount) => (
                        <button
                          key={amount}
                          onClick={() => prepareApiTopup(amount)}
                          className="rounded-xl border border-white/5 bg-black/10 hover:bg-white/[0.05] px-3 py-2.5 text-left cursor-pointer transition"
                        >
                          <span className="block text-xs font-bold text-white">Rp {amount.toLocaleString("id-ID")}</span>
                          <span className="block text-[10px] text-gray-500">Add API credit ({formatTopupUsd(amount)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {subscription?.apiAccessEnabled && !isApiPlan(subscription?.plan) && (
                  <div className="mb-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
                    <h4 className="font-bold text-white text-sm">API keys are included in your current plan</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">Use API Dashboard for keys and usage. API PAYG top-up is only for API-only plans, so it is separated from web/code subscription upgrades.</p>
                  </div>
                )}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Subscription Plans</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">Choose one product family for web chat and coding workflows.</p>
                  </div>
                  <div className="flex rounded-xl border border-white/5 bg-black/10 p-1 text-xs sm:min-w-[320px]">
                    {[
                      ["monthly", "Monthly", "Best value"],
                      ["weekly", "Weekly", "Flexible"],
                      ["3day", "3-Day", "Trial"],
                    ].map(([value, label, sub]) => (
                      <button key={value} type="button" onClick={() => setUpgradeBillingInterval(value)} className={`flex-1 rounded-lg px-3 py-2 text-left transition cursor-pointer ${upgradeBillingInterval === value ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/[0.04]"}`}>
                        <span className="block font-bold">{label}</span>
                        <span className="block text-[10px] opacity-75">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {upgradeError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{upgradeError}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {UPGRADE_PLANS.map((plan) => {
                    const detail = PLAN_UPGRADE_DETAILS[plan];
                    const catalog = PLAN_CATALOG[plan];
                    return (
                    <button
                      key={plan}
                      onClick={() => prepareSubscriptionUpgrade(plan)}
                      className={`w-full h-full p-4 rounded-2xl border text-left cursor-pointer transition flex flex-col ${upgradePlan === plan ? "border-indigo-500/40 bg-indigo-500/10 shadow-lg shadow-indigo-950/20" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex h-full flex-col">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-white text-sm">{catalog.label}</h4>
                              <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">{detail.tag}</p>
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5">&rarr;</span>
                          </div>
                          <p className="text-lg text-white font-black mt-3">Rp {formatPlanPrice(plan, upgradeBillingInterval)}<span className="text-[10px] text-gray-500 font-semibold"> / {upgradeBillingInterval === "3day" ? "3 Days" : upgradeBillingInterval === "weekly" ? "Week" : "Month"}</span></p>
                          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{formatPlanUnits(plan, upgradeBillingInterval)}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 text-[10px] text-gray-300">
                            <span className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1">{detail.models}</span>
                            <span className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1">{detail.context}</span>
                            <span className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1">{detail.output}</span>
                            <span className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1">{detail.api}</span>
                          </div>
                        </div>
                        <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-indigo-300">Select plan</div>
                      </div>
                    </button>
                  );
                  })}
                  {subscription?.status === "active" && subscription?.plan !== "free" && !isApiPlan(subscription?.plan) && (
                  <div className="sm:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 mt-1">
                    <p className="text-sm font-bold text-white mb-1">Need more credit without changing plan?</p>
                    <p className="text-[11px] text-gray-500 mb-3">Add usage units to the current subscription.</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                    {[
                      { amount: 25000, label: "Rp 25.000", credits: "10M units" },
                      { amount: 50000, label: "Rp 50.000", credits: "25M units" },
                      { amount: 100000, label: "Rp 100.000", credits: "60M units" },
                    ].map((topup) => (
                      <button
                        key={topup.amount}
                        onClick={() => prepareWebTopup(topup.amount)}
                        className="w-full p-3 rounded-xl border border-white/5 bg-black/10 hover:border-white/10 text-left flex justify-between items-center cursor-pointer transition"
                      >
                        <div>
                          <h4 className="font-bold text-white text-sm">Top Up {topup.label}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">+{topup.credits} to your current plan</p>
                        </div>
                        <div className="text-xs text-gray-400">&rarr;</div>
                      </button>
                    ))}
                    </div>
                  </div>
                  )}
                </div>
              </>
            )}

            {upgradeStep === "pay" && (
               <form onSubmit={handleSubmitUpgrade} noValidate>
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-5 text-center">
                  <p className="text-xs text-gray-400 mb-2">Transfer exactly</p>
                  <p className="text-2xl font-black text-white">
                    Rp {upgradeAmount?.toLocaleString("id-ID") || "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Unique code: <span className="text-indigo-300 font-bold text-sm">{upgradeCode || "-"}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">This code identifies your payment - transfer the exact amount above.</p>
                </div>

                {upgradeError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{upgradeError}</div>}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">Pay To</label>
                    <select value={upgradePayment} onChange={(e) => setUpgradePayment(e.target.value)} className="mt-2 w-full glass-input rounded-xl px-4 py-3 text-sm">
                      {paymentDetails.payment_gopay_enabled !== "false" && <option value="gopay" className="bg-slate-900">GoPay {paymentDetails.gopay_number ? "\u2713" : ""}</option>}
                      {paymentDetails.payment_ovo_enabled !== "false" && <option value="ovo" className="bg-slate-900">OVO {paymentDetails.ovo_number ? "\u2713" : ""}</option>}
                      {paymentDetails.payment_bank_enabled !== "false" && <option value="bank" className="bg-slate-900">Bank Transfer {paymentDetails.bank_account ? "\u2713" : ""}</option>}
                      {paymentDetails.payment_crypto_enabled !== "false" && <option value="crypto" className="bg-slate-900">Crypto (USDT) {paymentDetails.crypto_address ? "\u2713" : ""}</option>}
                    </select>
                  </div>

                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-xs text-gray-300">
                    <span className="font-bold text-emerald-400 block mb-1">Pay to:</span>
                    {upgradePayment === "gopay" && paymentDetails.gopay_number && <span>GoPay: {paymentDetails.gopay_number}</span>}
                    {upgradePayment === "ovo" && paymentDetails.ovo_number && <span>OVO: {paymentDetails.ovo_number}</span>}
                    {upgradePayment === "bank" && paymentDetails.bank_account && (
                      <span>{paymentDetails.bank_name} | {paymentDetails.bank_account} | {paymentDetails.bank_holder}</span>
                    )}
                    {upgradePayment === "crypto" && paymentDetails.crypto_address && (
                      <span>USDT ({paymentDetails.crypto_network || "TRC20"}): {paymentDetails.crypto_address}</span>
                    )}
                    {!((upgradePayment === "gopay" && paymentDetails.gopay_number) || (upgradePayment === "ovo" && paymentDetails.ovo_number) || (upgradePayment === "bank" && paymentDetails.bank_account) || (upgradePayment === "crypto" && paymentDetails.crypto_address)) && (
                      <span className="text-gray-500">Admin has not set payment details yet. Contact via WhatsApp.</span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
                      {upgradePayment === "bank" ? "Account Number" : upgradePayment === "crypto" ? "Wallet Address" : "Phone Number (for admin reference)"}
                    </label>
                    <input
                      type="text"
                      required
                      value={upgradeRef}
                      onChange={(e) => setUpgradeRef(e.target.value)}
                      placeholder={upgradePayment === "gopay" ? "08xxxxxxxxxx" : "Your reference"}
                      className="mt-2 w-full glass-input rounded-xl px-4 py-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">Payment Proof (screenshot)</label>
                    <div className="mt-2">
                      {proofImage ? (
                        <div className="relative inline-block">
                          <img src={proofImage} alt="proof" className="w-20 h-20 rounded-lg object-cover border border-white/10" />
                          <button type="button" onClick={() => setProofImage(null)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white cursor-pointer">
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : (
                          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-gray-400 cursor-pointer hover:bg-white/[0.08]">
                            <ImagePlus size={14} />
                            Upload Screenshot
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) { imageFileToDataUrl(file, { maxLength: 650_000 }).then(setProofImage).catch((err) => { setProofImage(null); setUpgradeError(err.message || "Failed to read screenshot."); }); }
                            }} />
                          </label>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-500">
                    Send payment to the details above, upload the proof, then submit. Your account will be activated within 1-24 hours.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setUpgradeStep("select")} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/5 text-sm font-semibold cursor-pointer">Back</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer">Submit Request</button>
                </div>
              </form>
            )}

            {upgradeStep === "done" && (
              <div>
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-1">Request Submitted</h3>
                <p className="text-sm text-gray-400 text-center mb-5">Your payment proof has been sent to admin for review.</p>

                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 mb-5">
                  <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-3">What happens next</p>
                  <div className="space-y-2.5 text-xs text-gray-400">
                    <p className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">1.</span> Admin reviews your payment proof and matches the unique code <span className="text-indigo-300 font-bold">{upgradeCode}</span>.</p>
                    <p className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">2.</span> Once verified, your plan is activated - usually within 1-24 hours.</p>
                    <p className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">3.</span> You will be notified via WhatsApp when your plan is active.</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 text-center mb-4">
                  You can also follow up directly on WhatsApp for faster processing.
                </p>
                <a
                  href={`https://wa.me/6282255881166?text=Hi%2C%20saya%20sudah%20submit%20upgrade%20ke%20${upgradePlan}%20dengan%20kode%20${upgradeCode}.%20Mohon%20di-cek%20ya.%20Email%3A%20${user?.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition text-center block"
                >
                  Follow Up via WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Management Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl glass-panel rounded-2xl relative overflow-hidden my-4">
            <button
              onClick={() => setIsAccountModalOpen(false)}
              className="absolute right-4 top-4 z-10 p-1.5 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="grid md:grid-cols-[220px_1fr] min-h-[400px] md:min-h-[560px]">
              <div className="border-r border-white/5 bg-black/20 p-5">
                <div className="flex items-center gap-3 mb-6 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{user?.name || "Account"}</h3>
                    <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  {[
                    { id: "profile", label: "Profile", icon: User },
                    { id: "plan", label: "Plan", icon: Sparkles },
                    { id: "security", label: "Security", icon: Lock },
                    { id: "api", label: "API Keys", icon: KeyRound },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setAccountTab(tab.id);
                          setAccountError("");
                          setAccountMessage("");
                          if (tab.id === "api" && subscription?.plan !== "free" && subscription?.apiAccessEnabled) fetchApiKeys();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${accountTab === tab.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
                      >
                        <Icon size={15} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-8 overflow-y-auto max-h-[80vh]">
                {accountError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {accountError}
                  </div>
                )}
                {accountMessage && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                    {accountMessage}
                  </div>
                )}

                {accountTab === "profile" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Profile</h3>
                    <p className="text-sm text-gray-400 mb-6">Manage your basic account information.</p>
                    <form onSubmit={handleSaveProfile} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity} className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Name</label>
                        <input type="text" required data-label="Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Email</label>
                        <input type="email" disabled value={user?.email || ""} className="mt-2 w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/5 text-gray-500 cursor-not-allowed" />
                        <div className={`mt-2 text-xs ${user?.emailVerifiedAt ? "text-emerald-400" : "text-amber-300"}`}>
                          {user?.emailVerifiedAt ? "Email verified" : "Email not verified"}
                        </div>
                      </div>
                      {!user?.emailVerifiedAt && (
                        <button type="button" onClick={handleResendVerification} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 text-sm font-semibold rounded-xl transition cursor-pointer">
                          Resend Verification Email
                        </button>
                      )}
                      <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer">Save Profile</button>
                    </form>
                  </div>
                )}

                {accountTab === "plan" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Plan</h3>
                    <p className="text-sm text-gray-400 mb-6">Review your active plan and upgrade options.</p>
                    <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 mb-5">
                      <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-widest">Active Plan</span>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-lg font-bold text-white">{accountPlanLabel}</div>
                        <span className="text-xs text-emerald-400 font-semibold capitalize">{subscription?.status || "active"}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Valid until {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString("en-US") : "-"}</p>
                    </div>

                    <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] mb-5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3 block">Package Usage</span>
                      <div className="space-y-3">
                        {(usage?.packages?.length ? usage.packages : [usageSummary]).map((item) => {
                          const itemLimitLabel = item.limit ? `${formatTokenUsage(item.used)}/${formatTokenLimit(item.limit)} units` : "No package limit";
                          return (
                            <div key={item.packageId || item.key || item.label}>
                              <div className="flex justify-between gap-3 text-[11px] mb-1">
                                <span className="text-gray-400 truncate">{item.label || "Package"}</span>
                                <span className={item.status === "Queued" ? "text-cyan-300" : "text-gray-400"}>{item.status === "Queued" ? "Queued" : `${item.percent}%`}</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${item.status === "Queued" ? "bg-cyan-500/60" : getProgressBarColor(item.percent)}`} style={{ width: `${item.status === "Queued" ? 8 : Math.max(item.percent, 2)}%` }} />
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                                <span>{item.status === "Queued" && item.startsAt ? `Starts ${new Date(item.startsAt).toLocaleDateString("en-US")}` : formatCountdown(item.resetAt, item.billingInterval || item.key)}</span>
                                <span className="font-mono">{itemLimitLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => { setIsAccountModalOpen(false); openUpgradeModal(); }} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer">Upgrade Plan</button>
                    {subscription?.status === "active" && subscription?.plan !== "free" && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      <p className="text-xs text-gray-500 mb-3">Need more usage this month without changing plans?</p>
                      <button onClick={() => { setIsAccountModalOpen(false); openUpgradeModal(); }} className="px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 text-sm font-semibold rounded-xl transition cursor-pointer w-full">
                        Top Up Balance
                      </button>
                    </div>
                    )}
                  {isApiPlan(subscription?.plan) && (
                  <div className="border-t border-white/5 pt-3 mt-3 sm:col-span-2">
                    <p className="text-[11px] text-gray-500 mb-2">Top up {getPlanDefinition(subscription?.plan)?.label || "API"} credit balance.</p>
                    {apiTopupPresetAmounts.slice(0, 6).map((amount) => (
                      <button
                        key={amount}
                        onClick={() => openPresetApiTopup(amount)}
                        className="w-full p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 text-left flex justify-between items-center cursor-pointer transition mb-2"
                      >
                        <div>
                          <h4 className="font-bold text-white text-sm">API Top Up Rp {amount.toLocaleString("id-ID")}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">Adds {formatTopupUsd(amount)} API credit</p>
                        </div>
                        <div className="text-xs text-gray-400">&rarr;</div>
                      </button>
                    ))}
                  </div>
                  )}
                </div>
                )}

                {accountTab === "security" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Security</h3>
                    <p className="text-sm text-gray-400 mb-6">Change your account password regularly.</p>
                    <form onSubmit={handleChangePassword} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity} className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Current Password</label>
                        <input type="password" required data-label="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">New Password</label>
                        <input type="password" required minLength={8} data-label="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
                      </div>
                      <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer">Change Password</button>
                    </form>
                  </div>
                )}

                {accountTab === "api" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><KeyRound size={18} className="text-indigo-400" />Local API Keys</h3>
                    <p className="text-sm text-gray-400 mb-6 leading-relaxed">Use local API keys with external editors like Continue, Cline, or other OpenAI-compatible local apps.</p>
                    {subscription?.status !== "active" || subscription?.plan === "free" || !subscription?.apiAccessEnabled ? (
                        <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-100">API keys are available for active plans with API access. Upgrade to Codex Code, Claude Code, or an API plan to enable keys.</div>
                    ) : (
                      <div>
                        {keyError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{keyError}</div>}
                        {latestCreatedApiKey && (
                          <div className="mb-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-emerald-300">New API key</p>
                                <p className="mt-1 font-mono break-all text-white">{latestCreatedApiKey}</p>
                                <p className="mt-1 text-[10px] text-emerald-200/80">Copy it now. The full key is shown only once.</p>
                              </div>
                              <button type="button" onClick={() => copyText(latestCreatedApiKey, "API key copied.")} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-emerald-300 hover:text-white transition cursor-pointer shrink-0" title="Copy API key">
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                          {apiKeys.length === 0 ? <p className="text-xs text-gray-500 italic py-4 text-center">No active local API keys yet.</p> : apiKeys.map((k) => (
                            <div key={k.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <span className="font-semibold block text-white truncate">{k.name}</span>
                                <span className="font-mono text-indigo-300 block mt-0.5 truncate select-all" title="Masked key shown for security">{k.key}</span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Created: {new Date(k.createdAt).toLocaleDateString("en-US")}</span>
                                <span className="text-[10px] text-amber-300/80 block mt-1">{k.canCopyFull ? "Click copy to copy the full key while keeping the UI masked." : "Full key is not recoverable for older keys. Recreate the key if you need to copy it again."}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {k.canCopyFull ? (
                                  <button type="button" onClick={() => handleCopyStoredApiKey(k.id)} className="p-2 hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 rounded-lg cursor-pointer transition" title="Copy full key"><Copy size={14} /></button>
                                ) : (
                                  <span className="px-2 py-1 text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/10 rounded-md whitespace-nowrap">
                                    Recreate to copy
                                  </span>
                                )}
                                <button onClick={() => handleDeleteApiKey(k.id)} className="p-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg cursor-pointer transition" title="Delete Key"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleCreateApiKey} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity} className="flex gap-2">
                          <input type="text" required data-label="Key Name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (example: Home VS Code)" className="flex-1 glass-input px-3.5 py-2 rounded-xl text-xs" />
                          <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer">Create Key</button>
                        </form>
                        <div className="mt-6 border-t border-white/5 pt-4 text-[10px] text-gray-500 leading-normal space-y-2">
                          <p className="font-bold text-gray-400">Quick start:</p>
                          <p>1. Copy your API key above</p>
                          <p>2. Open VS Code / Continue / Cline</p>
                          <p>3. Provider: <span className="text-indigo-300">openai</span></p>
                          <p>4. API base: <span className="text-indigo-300">{typeof window !== "undefined" ? window.location.origin.concat("/api/v1") : ""}</span></p>
                          <p>5. Paste key and save</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl text-sm font-semibold animate-fade-in shadow-lg ${toast.type === "error" ? "bg-red-600 text-white" : toast.type === "success" ? "bg-emerald-600 text-white" : "bg-white/10 backdrop-blur text-white border border-white/10"}`}>
          {toast.message}
        </div>
      )}

      {confirmState.show && (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-6 my-4">
            <h3 className="font-bold text-white text-lg mb-2">{confirmState.title}</h3>
            <p className="text-sm text-gray-400 mb-6">{confirmState.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={showConfirmDismiss} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-sm text-gray-300 cursor-pointer">Cancel</button>
              <button onClick={confirmState.onConfirm} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function LandingPage() {
  const [planInterval, setPlanInterval] = useState("weekly");
  const [apiPricingTab, setApiPricingTab] = useState("claude");
  const [calculatorModel, setCalculatorModel] = useState("claude-sonnet");
  const [calculatorInputTokens, setCalculatorInputTokens] = useState(500000);
  const [calculatorOutputTokens, setCalculatorOutputTokens] = useState(100000);
  const [calculatorRate, setCalculatorRate] = useState(18500);
  const calculatorModelIds = Object.keys(API_PAYG_PRICING);
  const calculatorCostUsd = calculateApiCostUsd({ model: calculatorModel, inputTokens: calculatorInputTokens, outputTokens: calculatorOutputTokens });
  const calculatorCostRp = calculateApiCostRp({ model: calculatorModel, inputTokens: calculatorInputTokens, outputTokens: calculatorOutputTokens, usdIdrRate: calculatorRate });
  const calculatorTopup = recommendTopupAmount(calculatorCostRp);
  const calculatorPricing = API_PAYG_PRICING[calculatorModel];
  const formatCalculatorRp = (value) => `Rp ${Math.max(0, Math.ceil(value || 0)).toLocaleString("id-ID")}`;
  const formatCalculatorUsd = (value) => `$${Math.max(0, value || 0).toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
  const landingPlans = [
    { name: "Free", threeDayPrice: "Rp 0", weeklyPrice: "Rp 0", monthlyPrice: "Rp 0", threeDayFeatures: ["GPT-5.4 Mini", "Small limit", "Try it out"], weeklyFeatures: ["GPT-5.4 Mini", "Small limit", "Try it out"], monthlyFeatures: ["GPT-5.4 Mini", "Small limit", "Try it out"] },
    { name: "Codex Lite", threeDayPrice: "Rp 9K/3d", weeklyPrice: "Rp 15K/wk", monthlyPrice: "Rp 19K/mo", monthlySavings: "lowest Codex entry", threeDayFeatures: ["GPT-5.4 Mini", "8M units for 3 days", "Web chat only"], weeklyFeatures: ["GPT-5.4 Mini", "15M weekly units", "Web chat only"], monthlyFeatures: ["GPT-5.4 Mini", "25M monthly units", "Web chat only"] },
    { name: "Codex Code", threeDayPrice: "Rp 15K/3d", weeklyPrice: "Rp 29K/wk", monthlyPrice: "Rp 49K/mo", monthlySavings: "Codex + API", threeDayFeatures: ["GPT-5.6 Terra", "API key included", "15M units for 3 days"], weeklyFeatures: ["GPT-5.6 Terra", "API key included", "35M weekly units"], monthlyFeatures: ["GPT-5.6 Terra", "API key included", "75M monthly units"], popular: true },
    { name: "Codex Pro", threeDayPrice: "Rp 25K/3d", weeklyPrice: "Rp 49K/wk", monthlyPrice: "Rp 89K/mo", monthlySavings: "highest Codex limit", threeDayFeatures: ["GPT-5.6 Sol/Terra", "API key included", "35M units for 3 days"], weeklyFeatures: ["GPT-5.6 Sol/Terra", "API key included", "75M weekly units"], monthlyFeatures: ["GPT-5.6 Sol/Terra", "API key included", "160M monthly units"] },
    { name: "Claude Lite", threeDayPrice: "Rp 15K/3d", weeklyPrice: "Rp 35K/wk", monthlyPrice: "Rp 49K/mo", monthlySavings: "cheap Claude", threeDayFeatures: ["Claude Haiku/Sonnet", "10M units for 3 days", "Web chat only"], weeklyFeatures: ["Claude Haiku/Sonnet", "30M weekly units", "Web chat only"], monthlyFeatures: ["Claude Haiku/Sonnet", "45M monthly units", "Web chat only"] },
    { name: "Claude Code", threeDayPrice: "Rp 19K/3d", weeklyPrice: "Rp 49K/wk", monthlyPrice: "Rp 79K/mo", monthlySavings: "Claude agents", threeDayFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "15M units for 3 days"], weeklyFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "45M weekly units"], monthlyFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "80M monthly units"], popular: true },
    { name: "Claude Pro", threeDayPrice: "Rp 29K/3d", weeklyPrice: "Rp 79K/wk", monthlyPrice: "Rp 129K/mo", monthlySavings: "highest Claude limit", threeDayFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "30M units for 3 days"], weeklyFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "80M weekly units"], monthlyFeatures: ["Claude Sonnet/Opus", "Claude Code/OpenCode", "160M monthly units"] },
  ];
  const apiPricingGroups = {
    gpt: {
      label: "GPT API",
      description: "OpenAI-compatible endpoint for scripts, tools, and GPT automation.",
      rows: [["GPT-5.4 Mini", "$0.03", "$0.12"], ["GPT-5.4", "$0.10", "$0.40"], ["GPT-5.5", "$0.20", "$0.80"], ["GPT-5.6 Terra", "$0.30", "$1.20"], ["GPT-5.6 Sol", "$0.40", "$1.60"]],
    },
    claude: {
      label: "Claude API",
      description: "Anthropic-compatible endpoint for Claude Code, OpenCode, and agent workflows.",
      rows: [["Claude Haiku", "$0.085", "$0.425"], ["Claude Sonnet", "$0.17", "$0.85"], ["Claude Opus", "$0.425", "$2.125"]],
    },
  };
  const activeApiPricing = apiPricingGroups[apiPricingTab];

  return (
    <main className="landing-page min-h-screen bg-main text-white overflow-y-auto">
      <nav className="landing-nav sticky top-0 z-50 border-b border-white/5 bg-main/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"><Bot size={20} /></div>
            <span className="font-black tracking-tight">RintisAI</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-gray-400">
            <a href="#models" className="hover:text-white transition">Models</a>
            <Link href="/api-router" className="hover:text-white transition">API Router</Link>
            <a href="#plans" className="hover:text-white transition">Plans</a>
            <a href="#payment" className="hover:text-white transition">Payment</a>
            <Link href="/docs/api" className="hover:text-white transition">Docs</Link>
            <a href="#compare" className="hover:text-white transition">Compare</a>
            <a href="#privacy" className="hover:text-white transition">Privacy</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/login" className="text-xs sm:text-sm text-gray-300 hover:text-white transition">Sign In</Link>
            <Link href="/register" className="text-xs sm:text-sm py-2 px-3 sm:px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20 whitespace-nowrap">Get API Access</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden landing-hero landing-section-hero">
        <div className="landing-grid" />
        <div className="absolute inset-x-0 top-[-180px] mx-auto h-[360px] w-[360px] rounded-full bg-indigo-600/20 blur-3xl landing-float" />
        <div className="absolute right-[-120px] top-32 h-[260px] w-[260px] rounded-full bg-emerald-500/10 blur-3xl landing-float landing-float-delay" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 sm:pt-24 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300 mb-7">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI workspace for Indonesian developers
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[0.95] landing-rise">
            AI chat and API keys<br />
            <span className="landing-gradient-text bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">with local Rupiah payment</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Choose Codex, Claude, or API pay-as-you-go as separate products, then pay locally without an international card. 3-day, weekly, monthly, and API credit options are available from one account.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link href="/register" className="py-3.5 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20">Create Account</Link>
            <a href="#models" className="py-3.5 px-8 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 font-semibold rounded-xl text-sm transition">View Models</a>
          </div>
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 sm:gap-3 text-left">
            {[["Rp9K", "3-day Codex"], ["Codex/Claude", "separate products"], ["Local pay", "GoPay, bank, crypto"]].map(([value, label]) => (
              <div key={label} className="landing-metric rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4">
                <div className="text-lg sm:text-2xl font-black text-white">{value}</div>
                <div className="mt-1 text-[10px] sm:text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 text-left sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white"><Activity size={15} className="text-emerald-300" />Model status</div>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">Check Codex, Claude, API endpoints, and recent incidents before integrating.</p>
              </div>
              <Link href="/status" className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/15 sm:w-auto">View model status</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pb-20">
        <section id="models" className="landing-section scroll-mt-24">
          <h2 className="text-center text-2xl font-black mb-3">Models for chat, coding, and automation</h2>
          <p className="text-center text-sm text-gray-500 mb-10">Use the web app for daily work, or connect external tools through API keys when you need automation.</p>
          <div className="grid md:grid-cols-3 gap-5 mb-6 landing-stagger">
            <FeatureCard icon={Bot} title="Codex and Claude" desc="Pick one model family for web chat, coding agents, or API-only usage instead of buying a mixed bundle." />
            <FeatureCard icon={KeyRound} title="OpenAI-Compatible API" desc="Plug into VS Code, Continue, Cline, scripts, or local tools with a standard API key." />
            <FeatureCard icon={Shield} title="Local Payment" desc="Pay in Rupiah through local methods. No international card required for web plans or API credit." />
          </div>
          <div className="landing-surface mb-20 rounded-2xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 landing-glow-panel">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-5 items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300 mb-2">Optional API-only mode</p>
                <h3 className="text-xl font-black text-white leading-tight">Codex and Claude API Pay-As-You-Go</h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">For users who only need API keys, choose an API provider plan, top up Rupiah balance, and use the compatible endpoint. API-only accounts get a focused dashboard instead of web chat.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/register" className="inline-flex py-2.5 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 font-semibold rounded-xl text-sm transition">Register to Top Up</Link>
                  <Link href="/docs/api" className="inline-flex py-2.5 px-4 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-200 font-semibold rounded-xl text-sm transition">API Docs</Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/10 p-3">
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1 text-xs font-bold">
                  {Object.entries(apiPricingGroups).map(([key, group]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setApiPricingTab(key)}
                      className={`rounded-lg px-2 py-2 transition ${apiPricingTab === key ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"}`}
                    >
                      {group.label.replace(" API", "")}
                    </button>
                  ))}
                </div>
                <div className="mb-3 px-1">
                  <div className="text-sm font-black text-white">{activeApiPricing.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{activeApiPricing.description}</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="py-3 px-4 text-gray-400">Model</th>
                        <th className="py-3 px-4 text-gray-400">Input / 1M</th>
                        <th className="py-3 px-4 text-gray-400">Output / 1M</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {activeApiPricing.rows.map(([model, input, output]) => (
                        <tr key={model} className="border-b border-white/5 last:border-0">
                          <td className="py-3 px-4 font-bold text-white">{model}</td>
                          <td className="py-3 px-4 font-mono text-emerald-300">{input}</td>
                          <td className="py-3 px-4 font-mono text-emerald-300">{output}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">Minimum API top-up starts from $1, converted to Rupiah using the active managed USD/IDR rate. IDR payments are converted to USD API balance, then deducted from provider-reported input and output tokens. Unused API balance can be requested for cash-out after admin review, minimum $1.00.</p>
          </div>
        </section>

        <section id="calculator" className="landing-section scroll-mt-24 mb-20">
            <div className="landing-surface rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300 mb-3">API credit calculator</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">Estimate your API top-up before buying.</h2>
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed">Pick a model, estimate input and output tokens, then see the approximate PAYG cost and the nearest recommended top-up. Actual billing follows provider-reported token usage.</p>
                  <div className="mt-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-4 text-xs text-emerald-100/90 leading-relaxed">
                    Recommendation uses a 25% buffer, so a Rp188K estimate points to Rp250K instead of jumping straight to Rp500K.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/10 p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Model
                      <select value={calculatorModel} onChange={(e) => setCalculatorModel(e.target.value)} className="mt-1 w-full glass-input rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal">
                        {calculatorModelIds.map((modelId) => <option key={modelId} value={modelId} className="bg-slate-900">{API_PAYG_PRICING[modelId].label}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">USD/IDR Rate
                      <input type="number" min="1" value={calculatorRate} onChange={(e) => setCalculatorRate(Number(e.target.value) || 18500)} className="mt-1 w-full glass-input rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal" />
                    </label>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Input Tokens
                      <input type="number" min="0" value={calculatorInputTokens} onChange={(e) => setCalculatorInputTokens(Number(e.target.value) || 0)} className="mt-1 w-full glass-input rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal" />
                    </label>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Output Tokens
                      <input type="number" min="0" value={calculatorOutputTokens} onChange={(e) => setCalculatorOutputTokens(Number(e.target.value) || 0)} className="mt-1 w-full glass-input rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal" />
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Model</p>
                      <p className="mt-1 font-bold text-white">{calculatorPricing.label}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{calculatorPricing.family}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-300 font-bold">Estimated Cost</p>
                      <p className="mt-1 font-mono text-lg font-black text-emerald-100">{formatCalculatorUsd(calculatorCostUsd)}</p>
                      <p className="text-xs text-emerald-200/80">{formatCalculatorRp(calculatorCostRp)}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.08] p-4">
                      <p className="text-[10px] uppercase tracking-wide text-indigo-300 font-bold">Recommended Top Up</p>
                      <p className="mt-1 text-lg font-black text-indigo-100">{formatCalculatorRp(calculatorTopup)}</p>
                      <p className="text-xs text-indigo-200/70">nearest package</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {API_TOPUP_AMOUNTS.map((amount) => (
                      <span key={amount} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${amount === calculatorTopup ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-100" : "border-white/5 bg-white/[0.03] text-gray-400"}`}>
                        {formatCalculatorRp(amount)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
        </section>

        <section id="plans" className="landing-section scroll-mt-24">
          <h2 className="text-center text-2xl font-black mb-3">Plans that make sense locally</h2>
          <p className="text-center text-sm text-gray-500 mb-5">Built for Indonesia: local pricing, local payment, short 3-day access, weekly flexibility, and better-value monthly usage.</p>
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs font-bold">
              {[["3day", "3-Day"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlanInterval(value)}
                  className={`relative rounded-lg px-4 py-2 transition ${planInterval === value ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-gray-400 hover:text-white"}`}
                >
                  {label}
                  {value === "monthly" && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] uppercase tracking-wide text-emerald-300">Best Price</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-20 landing-stagger">
            {landingPlans.map((plan) => (
              <PlanCard
                key={plan.name}
                name={plan.name}
                price={planInterval === "3day" ? plan.threeDayPrice : planInterval === "weekly" ? plan.weeklyPrice : plan.monthlyPrice}
                features={planInterval === "3day" ? plan.threeDayFeatures : planInterval === "weekly" ? plan.weeklyFeatures : plan.monthlyFeatures}
                popular={plan.popular}
                badge={planInterval === "monthly" && plan.monthlySavings ? `Best Price - ${plan.monthlySavings}` : null}
              />
            ))}
          </div>
        </section>

        <section id="payment" className="landing-section scroll-mt-24 mb-20">
          <div className="landing-surface rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-7">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-300 mb-3">How payment works</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">Choose a plan for chat, or top up only when you need API credit.</h2>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">RintisAI keeps web chat plans and API-only balance separate, so you can pick the payment style that matches how you work.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Weekly</p>
                  <h3 className="text-white font-bold mt-2">Start small</h3>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">Use web chat and API keys for 7 days with a lower entry price. Good for trying paid models or short projects.</p>
                </div>
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-300">Monthly</p>
                  <h3 className="text-white font-bold mt-2">Best value</h3>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">Get more usage per Rupiah for daily work. Monthly plans are better when you use AI regularly.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">API PAYG</p>
                  <h3 className="text-white font-bold mt-2">Top up credit</h3>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">For API-only users, Rupiah top-ups become USD API balance and are deducted from actual input/output tokens. Unused balance can be requested for cash-out after admin review, minimum $1.00, one active request at a time.</p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="font-bold text-white">1. Pick what you need</p><p className="text-gray-400 mt-1 leading-relaxed">3-day, weekly, or monthly for web chat/code products, API PAYG for tools and automations.</p></div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="font-bold text-white">2. Pay in Rupiah</p><p className="text-gray-400 mt-1 leading-relaxed">Transfer with the unique payment code shown in-app, then submit the request for admin confirmation.</p></div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="font-bold text-white">3. Use your account</p><p className="text-gray-400 mt-1 leading-relaxed">Plans activate after approval. API-only top-ups add USD balance using the active managed USD/IDR rate.</p></div>
            </div>
          </div>
        </section>

        <section id="compare" className="landing-section scroll-mt-24">
          <div className="landing-surface mb-20 rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-white/[0.02] to-indigo-500/[0.06] p-5 sm:p-7 shadow-2xl shadow-black/20">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300 mb-3">Usage comparison</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">More room to work, without counting every token.</h2>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">Official APIs and OpenRouter are great for tiny usage. RintisAI separates Codex, Claude, and API PAYG so Indonesian users can buy only the workflow they need.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">Codex Code</p><p className="text-2xl font-black text-white mt-1">Rp49K</p><p className="text-xs text-emerald-300 mt-1">Monthly coding + API</p></div>
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4"><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">Claude Code</p><p className="text-2xl font-black text-white mt-1">Rp79K</p><p className="text-xs text-indigo-300 mt-1">Claude Code/OpenCode</p></div>
              </div>
            </div>
            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-white/5 bg-black/10 p-4"><p className="text-gray-500 font-bold uppercase tracking-wide">Codex</p><p className="text-white font-bold mt-2">Cheap daily chat or GPT coding</p><p className="text-gray-400 mt-1">Start at Rp9K for 3 days or Rp19K monthly.</p></div>
              <div className="rounded-2xl border border-white/5 bg-black/10 p-4"><p className="text-gray-500 font-bold uppercase tracking-wide">Claude</p><p className="text-white font-bold mt-2">Dedicated Claude Code/OpenCode plan</p><p className="text-gray-400 mt-1">Buy Claude only when the workflow needs Claude.</p></div>
            </div>
            <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">Actual value depends on input/output ratio, reasoning level, selected model, and upstream availability. API PAYG is best for tooling that should be billed per token.</p>
          </div>

          <h2 className="text-center text-2xl font-black mb-2">API Price Comparison</h2>
          <p className="text-center text-sm text-gray-500 mb-8">RintisAI vs pay-per-token APIs for developer workflows</p>
          <div className="overflow-x-auto mb-20 rounded-2xl border border-white/5 bg-white/[0.02]">
            <table className="w-full text-sm text-left border-collapse">
              <thead><tr className="border-b border-white/10"><th className="py-3 px-4 text-gray-400 font-medium"></th><th className="py-3 px-4 text-white font-bold">RintisAI</th><th className="py-3 px-4 text-gray-500">OpenAI API</th><th className="py-3 px-4 text-gray-500">Anthropic API</th><th className="py-3 px-4 text-gray-500">OpenRouter</th></tr></thead>
              <tbody className="text-gray-400">
                {[["Pricing model", "Separate web/code plans + API PAYG", "Pay per token", "Pay per token", "Pay per token + fee"], ["Codex/GPT", "Codex Lite, Code, or Pro", "Native", "N/A", "Routed"], ["Claude", "Claude Lite, Code, Pro, or API", "N/A", "Native", "Routed"], ["Monthly predictability", "High for web/code plans", "Depends on usage", "Depends on usage", "Depends on usage"], ["Payment method", "GoPay, OVO, bank, crypto", "International card", "International card", "Card/crypto"], ["Best fit", "Indonesian users choosing one AI workflow", "Production apps", "Claude-specific production apps", "Multi-provider routing"], ["Very light usage", "API PAYG may fit better", "Can be cheaper", "Can be cheaper", "Can be cheaper"]].map(([label, rintis, openai, anthropic, openrouter], i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0"><td className="py-3 px-4 text-gray-300 font-medium">{label}</td><td className="py-3 px-4 text-emerald-300">{rintis}</td><td className="py-3 px-4">{openai}</td><td className="py-3 px-4">{anthropic}</td><td className="py-3 px-4">{openrouter}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-20 grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5 border-emerald-500/20"><h3 className="font-bold text-white mb-2">Choose RintisAI if...</h3><p className="text-sm text-gray-400 leading-relaxed">You use AI daily in VS Code, Continue, Cline, scripts, or local automations and want predictable monthly cost with local Indonesian payment.</p></div>
            <div className="glass-card rounded-2xl p-5"><h3 className="font-bold text-white mb-2">Choose pay-as-you-go if...</h3><p className="text-sm text-gray-400 leading-relaxed">Your API usage is tiny or occasional. For just a few requests per week, OpenRouter or official API credits can be cheaper.</p></div>
          </div>
        </section>

        <section id="privacy" className="landing-section text-center py-16 border-t border-white/5 scroll-mt-24">
          <h2 className="text-2xl font-black mb-4">Private by default, useful by design</h2>
          <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">Chat history is stored so you can continue previous work, not to train models. API keys are stored as hashes, and you can delete conversations or revoke keys anytime.</p>
        </section>

        <footer className="pt-12 pb-8 border-t border-white/5 text-center">
          <div className="flex items-center justify-center gap-4 mb-4"><Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition">Privacy Policy</Link><span className="text-gray-700">·</span><Link href="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition">Terms of Service</Link></div>
          <p className="text-xs text-gray-600">RintisAI &mdash; AI workspace for Indonesian developers. Not affiliated with any AI model provider.</p>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 inline-block mb-3">
        <Icon size={20} />
      </div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function PlanCard({ name, price, subprice, features, popular, badge }) {
  return (
    <div className={`glass-card landing-plan-card rounded-2xl p-5 text-left relative overflow-hidden ${popular ? "border-indigo-500/30" : ""}`}>
      {popular && <div className="absolute top-0 right-0 py-0.5 px-3 bg-indigo-600 text-[9px] font-bold uppercase tracking-wider text-white rounded-bl-lg">Popular</div>}
      <h3 className="font-bold text-white">{name}</h3>
      <p className="text-xl font-black text-white mt-2">{price}</p>
      {subprice && <p className="text-[11px] text-gray-500 mt-0.5">{subprice} / month</p>}
      {badge && <p className="mt-2 inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">{badge}</p>}
      <ul className="mt-4 space-y-2">
        {features.map((f, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
            <Check size={12} className="text-emerald-400" />{f}
          </li>
        ))}
      </ul>
    </div>
  );
}
