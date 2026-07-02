"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMaxContextTokens, getMaxOutputTokens, isModelAllowedForPlan, PLAN_MODEL_ALLOWANCE } from "@/lib/models";
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
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Menu,
  ImagePlus,
  XCircle,
  ArrowDownToLine
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
const estimateClientTokens = (text) => Math.ceil((text || "").length / 3.8);
const PENDING_STREAM_ID = "__pending_stream__";
const currentTimestamp = () => new Date().getTime();

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
  student: {
    price: "29.000",
    tag: "Belajar & tugas ringan",
    models: "Mini + GPT-5.4 Pro",
    context: "128k context",
    output: "Output hingga 16k",
    api: "API key belum termasuk",
    bestFor: "Cocok untuk pelajar, rangkuman, tugas, dan coding ringan.",
  },
  starter: {
    price: "49.000",
    tag: "Daily coding",
    models: "GPT-5.4 Mini, GPT-5.4 Pro, GPT-5.5",
    context: "256k context",
    output: "Output hingga 16k",
    api: "API key belum termasuk",
    bestFor: "Cocok untuk penggunaan harian dan problem solving teknis.",
  },
  pro: {
    price: "89.000",
    tag: "Professional use",
    models: "Semua model + Claude Sonnet & Haiku",
    context: "400k-512k context",
    output: "Output hingga 64k",
    api: "API key belum termasuk",
    bestFor: "Cocok untuk project serius, analisis panjang, dan workflow intensif.",
  },
  developer: {
    price: "149.000",
    tag: "Editor & API workflow",
    models: "Semua model + Claude + API access",
    context: "400k-1.05M context",
    output: "Output hingga 128k",
    api: "3 API keys untuk VS Code/Cline/Continue",
    bestFor: "Cocok untuk developer yang butuh web chat dan OpenAI-compatible API.",
  },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [keyError, setKeyError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [attachedImages, setAttachedImages] = useState([]);
  const fileInputRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const conversationLoadSeqRef = useRef(0);
  const backgroundStreamsRef = useRef(new Map());
  const [streamingConversationIds, setStreamingConversationIds] = useState([]);
  const [streamStatusById, setStreamStatusById] = useState({});
  const [processTick, setProcessTick] = useState(0);
  const [upgradeStep, setUpgradeStep] = useState("select");
  const [upgradePlan, setUpgradePlan] = useState("pro");
  const [upgradePayment, setUpgradePayment] = useState("gopay");
  const [upgradeRef, setUpgradeRef] = useState("");
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeSuccess, setUpgradeSuccess] = useState("");
  const [upgradeAmount, setUpgradeAmount] = useState(null);
  const [upgradeCode, setUpgradeCode] = useState("");
  const [paymentDetails, setPaymentDetails] = useState({});
  const [proofImage, setProofImage] = useState(null);
  const [confirmState, setConfirmState] = useState({ show: false, title: "", message: "", onConfirm: null });
  const [convSearch, setConvSearch] = useState("");
  const [toast, setToast] = useState(null);

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

  // Fetch Local API Keys (for Developer plan only)
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
    try {
      const res = await fetch("/api/auth/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create API key.");
      }
      setNewKeyName("");
      fetchApiKeys();
    } catch (err) {
      setKeyError(err.message);
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
      }
    } catch (err) {
      console.error("Failed to delete key:", err);
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
    if (!user?.id) return;
    const plan = subscription?.plan || "free";
    const allowedModels = PLAN_MODEL_ALLOWANCE[plan] || ["gpt-5.4-mini"];
    const storedModel = getStoredPreference(getModelPreferenceKey(user.id), "gpt-5.4-mini", allowedModels);
    const timer = window.setTimeout(() => {
      setSelectedModel(isModelAllowedForPlan(storedModel, plan) ? storedModel : allowedModels[0]);
      setReasoningEffort(getStoredPreference(getReasoningPreferenceKey(user.id), "medium", ["low", "medium", "high", "xhigh"]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id, subscription?.plan]);

  useEffect(() => {
    if (!user?.id) return;
    const plan = subscription?.plan || "free";
    const allowedModels = PLAN_MODEL_ALLOWANCE[plan] || ["gpt-5.4-mini"];
    if (!isModelAllowedForPlan(selectedModel, plan)) {
      const timer = window.setTimeout(() => setSelectedModel(allowedModels[0]), 0);
      return () => window.clearTimeout(timer);
    }
    window.localStorage.setItem(getModelPreferenceKey(user.id), selectedModel);
  }, [user?.id, subscription?.plan, selectedModel]);

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(getReasoningPreferenceKey(user.id), reasoningEffort);
  }, [user?.id, reasoningEffort]);

  useEffect(() => {
    if (streamingConversationIds.length === 0 && Object.keys(streamStatusById).length === 0) return;
    const timer = setInterval(() => setProcessTick(currentTimestamp()), 1_000);
    return () => clearInterval(timer);
  }, [streamingConversationIds.length, streamStatusById]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

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
    if (!user?.id || activeConvId || conversations.length === 0 || messages.length > 0) return;
    const lastConversationId = window.localStorage.getItem(getLastConversationKey(user.id));
    if (!lastConversationId) return;
    const exists = conversations.some((conversation) => conversation.id === lastConversationId);
    if (exists) {
      const timer = setTimeout(() => handleSelectConversation(lastConversationId), 0);
      return () => clearTimeout(timer);
    } else {
      window.localStorage.removeItem(getLastConversationKey(user.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversations, activeConvId, messages.length]);

  const handleNewChat = () => {
    conversationLoadSeqRef.current += 1;
    activeConvIdRef.current = null;
    setActiveConvId(null);
    setMessagesConvId(null);
    setActiveContextUsage(null);
    if (user?.id) window.localStorage.removeItem(getLastConversationKey(user.id));
    setMessages([]);
    setErrorBanner("");
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
    setConfirmState({ show: true, title, message, onConfirm: () => { setConfirmState({ show: false }); resolve(true); } });
  });

  const showConfirmDismiss = () => { setConfirmState({ show: false }); };

  const showToast = (message, type = "info") => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };

  const filteredConversations = conversations.filter((c) => !convSearch || c.title.toLowerCase().includes(convSearch.toLowerCase()));

  const handleAddImages = (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file?.type?.startsWith("image/"));
    const availableSlots = Math.max(0, 3 - attachedImages.length);
    if (imageFiles.length > availableSlots) {
      showToast(`Maximum ${availableSlots || 0} more image(s) allowed.`, "error");
    }

    for (const file of imageFiles.slice(0, availableSlots)) {
      if (file.size > 8 * 1024 * 1024) {
        showToast(`${file.name} is too large. Max 8MB before compression.`, "error");
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1280;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.75);
          if (base64.length > 900_000) {
            showToast(`${file.name} is still too large after compression.`, "error");
            return;
          }
          setAttachedImages((prev) => [...prev, { name: file.name, base64 }]);
        };
        img.onerror = () => showToast(`Failed to read ${file.name}.`, "error");
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedImage = (index) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
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
      handleAddImages(files);
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
        body: JSON.stringify({ plan: upgradePlan, paymentMethod: upgradePayment, paymentRef: upgradeRef, paymentProof: proofImage, requestedCode: upgradeCode, transferAmount: upgradeAmount }),
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
    setUpgradePlan(subscription?.plan === "free" ? "starter" : subscription?.plan === "student" ? "starter" : "pro");
    setUpgradePayment("gopay");
    setUpgradeRef("");
    setUpgradeError("");
    setUpgradeSuccess("");
    setProofImage(null);

    try {
      const res = await fetch("/api/payment");
      const data = await res.json();
      setPaymentDetails(data.paymentDetails || {});
    } catch {}

    setIsUpgradeModalOpen(true);
  };

  const openAccountModal = async (tab = "profile") => {
    setAccountTab(tab);
    setAccountError("");
    setAccountMessage("");
    setKeyError("");
    setProfileName(user?.name || "");
    setIsAccountModalOpen(true);

    if (tab === "api" && subscription?.plan === "developer") {
      await fetchApiKeys();
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setAccountError("");
    setAccountMessage("");

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

  // 2. Chat Streaming Submission Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const hasImages = attachedImages.length > 0;
    if ((!inputMessage.trim() && !hasImages) || activeChatBusy || limitExceeded || limitBlocked) return;

    setErrorBanner("");
    const userMsgText = inputMessage;
    const imagesToSend = [...attachedImages];
    setInputMessage("");
    setAttachedImages([]);
    setLoading(true);
    const sendSeq = conversationLoadSeqRef.current;

    let userContent;
    if (hasImages) {
      userContent = [
        ...imagesToSend.map((img) => ({ type: "image_url", image_url: { url: img.base64 } })),
      ];
      if (userMsgText.trim()) {
        userContent.push({ type: "text", text: userMsgText });
      }
    } else {
      userContent = userMsgText;
    }

    // Optimistic UI update
    const displayContent = hasImages
      ? `${userMsgText || "Attached image"}\n${imagesToSend.map((img) => `[Image: ${img.name}]`).join("\n")}`
      : userMsgText;
    let streamConvId = activeConvId;
    let streamStatusId = streamConvId || PENDING_STREAM_ID;
    const updatedMessages = [...messages, { role: "user", content: displayContent, _images: hasImages ? imagesToSend : undefined }];
    setMessagesConvId(streamConvId);
    setActiveContextUsage(null);
    setMessages(updatedMessages);

    // Add placeholder assistant bubble
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    backgroundStreamsRef.current.set(streamStatusId, [...updatedMessages, { role: "assistant", content: "" }]);
    setConversationStreaming(streamStatusId, true);
    setConversationStreamStatus(streamStatusId, { startedAt: currentTimestamp(), phase: "reading_context", hasContent: false });

    try {
      const requestController = new AbortController();
      const requestTimeout = setTimeout(() => requestController.abort(), hasImages ? 90_000 : 60_000);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({
          messages: [{ role: "user", content: displayContent }],
          userContent,
          model: selectedModel,
          conversationId: activeConvId,
          ...(["pro", "developer"].includes(subscription?.plan) ? { reasoning_effort: reasoningEffort } : {}),
        }),
      });
      clearTimeout(requestTimeout);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let assistantBuffer = "";
      let receivedAssistantContent = false;
      let flushTimer = null;

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
      if (!streamConvId || activeConvIdRef.current === streamConvId) {
        setErrorBanner(err.name === "AbortError" ? "Request timed out. Try a smaller image or send a shorter prompt." : err.message);
      }
      if (conversationLoadSeqRef.current === sendSeq && activeConvIdRef.current === streamConvId) {
        setMessages(prev => prev.slice(0, prev.length - 1));
      }
      if (err.message.toLowerCase().includes("pemakaian") || err.message.toLowerCase().includes("limit") || err.message.toLowerCase().includes("penuh")) {
        setLimitBlocked(true);
      }
      fetchAuth();
    } finally {
      setConversationStreaming(streamConvId, false);
      setConversationStreaming(streamStatusId, false);
      clearConversationStreamStatus(streamConvId);
      clearConversationStreamStatus(streamStatusId);
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
  const usageSummary = usageItems.reduce((highest, item) => {
    return item.percent > highest.percent ? item : highest;
  }, { percent: 0, status: "Normal" });
  const limitExceeded = usageSummary.percent >= 100;
  const [limitBlocked, setLimitBlocked] = useState(false);
  const contextLimit = getMaxContextTokens(selectedModel, subscription?.plan || "free");
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
  const currentPlan = subscription?.plan || "free";
  const availableModels = PLAN_MODEL_ALLOWANCE[currentPlan] || ["gpt-5.4-mini"];

  useEffect(() => {
    if (limitBlocked && usageSummary.percent < 95) setLimitBlocked(false);
  }, [usageSummary.percent]);

  const formatCountdown = (targetIsoString, type = "5h") => {
    if (!targetIsoString) {
      if (type === "5h") return "Resets in 0 hours";
      if (type === "weekly") return "Resets in 0 days";
      return "Resets in 0 days";
    }

    const target = new Date(targetIsoString);
    const now = new Date();
    const diffMs = target - now;

    if (diffMs <= 0) {
      if (type === "5h") return "Resets in 0 hours";
      if (type === "weekly") return "Resets in 0 days";
      return "Resets in 0 days";
    }

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (type === "5h") {
      const hours = diffHours % 24;
      const minutes = diffMin % 60;
      if (hours === 0) return `Resets in ${minutes} minutes`;
      return `Resets in ${hours} hours ${minutes} minutes`;
    } else if (type === "weekly" || type === "monthly") {
      const days = diffDays;
      const hours = diffHours % 24;
      if (days === 0) return `Resets in ${hours} hours`;
      return `Resets in ${days} days ${hours} hours`;
    }

    return "Resets in 0 hours";
  };

  return (
    <>
      {authState === "loading" && <div className="flex h-screen items-center justify-center bg-main"><div className="text-gray-400 text-sm">Loading...</div></div>}

      {authState === "unauthenticated" && (
        <LandingPage />
      )}

      {authState === "authenticated" && (
    <div className="flex h-screen overflow-hidden bg-main">

      {/* 🚀 SIDEBAR COMPONENT */}
      <aside
        className="relative z-20 h-full glass-panel flex flex-col shrink-0 overflow-hidden"
        style={{ width: sidebarOpen ? sidebarWidth : 0, minWidth: 0, transition: "width 0.25s ease" }}
      >
        {/* Drag handle */}
        {sidebarOpen && (
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-30 hover:bg-indigo-500/30 transition-colors"
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 hover:bg-white/5 text-gray-400 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
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
                    {subscription?.plan || "free"}
                  </span>
              <button
                onClick={() => openUpgradeModal()}
                disabled={subscription?.plan === "developer"}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] disabled:text-gray-600 disabled:cursor-not-allowed text-[11px] font-bold text-white rounded-lg transition active:scale-95 cursor-pointer"
              >
                Upgrade
              </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1.5">
                  <span className="text-gray-400">Usage</span>
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
                <div className="text-[10px] text-gray-500 mt-1">{usageSummary.status}</div>
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
      </aside>

      {/* 💬 MAIN CHAT WORKSPACE AREA */}
      <main className="flex-1 flex flex-col h-full relative">

        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 border-b border-white/5 flex items-center justify-between px-3 sm:px-6 bg-slate-950/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] border border-white/5 text-white text-sm font-medium cursor-pointer transition"
              >
                <Sliders size={14} className="text-indigo-400" />
                {selectedModel === "gpt-5.4-mini" ? "GPT-5.4 Mini" : selectedModel === "gpt-5.4" ? "GPT-5.4 Pro" : selectedModel === "gpt-5.5" ? "GPT-5.5 Ultra" : selectedModel === "claude-haiku" ? "Claude Haiku" : "Claude Sonnet"}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {modelDropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-52 glass-panel rounded-xl border border-white/10 shadow-xl z-50 py-1">
                    {availableModels.includes("gpt-5.4-mini") && (
                      <button onClick={() => { setSelectedModel("gpt-5.4-mini"); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === "gpt-5.4-mini" ? "text-white" : "text-gray-400"}`}>
                        <div className="flex-1"><div className="font-medium">GPT-5.4 Mini</div><div className="text-[10px] text-gray-500 mt-0.5">Fast & efficient</div></div>
                        {selectedModel === "gpt-5.4-mini" && <span className="text-indigo-400 text-xs">&#10003;</span>}
                      </button>
                    )}
                    {availableModels.includes("gpt-5.4") && (
                      <button onClick={() => { setSelectedModel("gpt-5.4"); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === "gpt-5.4" ? "text-white" : "text-gray-400"}`}>
                        <div className="flex-1"><div className="font-medium">GPT-5.4 Pro</div><div className="text-[10px] text-gray-500 mt-0.5">Balanced & capable</div></div>
                        {selectedModel === "gpt-5.4" && <span className="text-indigo-400 text-xs">&#10003;</span>}
                      </button>
                    )}
                    {availableModels.includes("gpt-5.5") && (
                      <button onClick={() => { setSelectedModel("gpt-5.5"); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === "gpt-5.5" ? "text-white" : "text-gray-400"}`}>
                        <div className="flex-1"><div className="font-medium">GPT-5.5 Ultra</div><div className="text-[10px] text-gray-500 mt-0.5">Deep reasoning</div></div>
                        {selectedModel === "gpt-5.5" && <span className="text-indigo-400 text-xs">&#10003;</span>}
                      </button>
                    )}
                    {availableModels.includes("claude-sonnet") && (
                      <button onClick={() => { setSelectedModel("claude-sonnet"); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === "claude-sonnet" ? "text-white" : "text-gray-400"}`}>
                        <div className="flex-1"><div className="font-medium">Claude Sonnet</div><div className="text-[10px] text-gray-500 mt-0.5">Coding & analysis</div></div>
                        {selectedModel === "claude-sonnet" && <span className="text-indigo-400 text-xs">&#10003;</span>}
                      </button>
                    )}
                    {availableModels.includes("claude-haiku") && (
                      <button onClick={() => { setSelectedModel("claude-haiku"); setModelDropOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] flex items-center gap-3 ${selectedModel === "claude-haiku" ? "text-white" : "text-gray-400"}`}>
                        <div className="flex-1"><div className="font-medium">Claude Haiku</div><div className="text-[10px] text-gray-500 mt-0.5">Fast Claude model</div></div>
                        {selectedModel === "claude-haiku" && <span className="text-indigo-400 text-xs">&#10003;</span>}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Reasoning selector */}
            {(selectedModel === "gpt-5.5" || selectedModel === "gpt-5.4") && (
              <div className="relative flex items-center gap-1.5 border-l border-white/10 pl-3 ml-1">
                <Sparkles size={13} className="text-amber-400" />
                {(["pro", "developer"].includes(subscription?.plan)) ? (
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
                          {["low", "medium", "high", "xhigh"].map((r) => (
                            <button key={r} onClick={() => { setReasoningEffort(r); setReasonDropOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between capitalize ${reasoningEffort === r ? "text-amber-300" : "text-gray-400"}`}>
                              {r === "xhigh" ? "x-high" : r} {reasoningEffort === r && <span className="text-amber-400">&#10003;</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500 flex items-center gap-1 cursor-not-allowed select-none font-medium">
                    Reasoning: Medium (locked)
                  </span>
                )}
              </div>
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

        {/* Messages Feed Viewport */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {limitExceeded || limitBlocked ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex gap-3 items-start max-w-2xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Usage limit reached</span>
                <span className="block mt-0.5">Your plan limit has been reached. Please upgrade or wait for the reset.</span>
              </div>
            </div>
          ) : errorBanner && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-start max-w-2xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Error:</span>
                <span className="block mt-0.5">{errorBanner}</span>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto space-y-5 mt-8 sm:mt-16 px-2">
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
            <div className="max-w-3xl mx-auto space-y-6">
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
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-7 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-md" : ""} ${msg.role === "assistant" ? "" : ""}`}
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
                        <p className="whitespace-pre-wrap">{msg.content}</p>
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
                          <div
                            className="message-content"
                            onClick={handleMessageContentClick}
                            dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                          />
                          {activeChatBusy && index === messages.length - 1 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                              {getStreamStatusLabel(activeStreamStatus)}
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

        {/* Input Bar Form */}
        <footer className="p-3 sm:p-6 bg-gradient-to-t from-main via-main to-transparent">
          {attachedImages.length > 0 && (
            <div className="max-w-3xl mx-auto mb-3 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                  <img src={img.base64} alt={img.name} className="w-full h-full object-cover" />
                  <button onClick={() => removeAttachedImage(i)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white cursor-pointer">
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleAddImages(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-gray-400 hover:text-gray-200 transition cursor-pointer"
              title="Attach images"
            >
              <ImagePlus size={18} />
            </button>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onPaste={handlePaste}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={limitExceeded || limitBlocked ? "Usage limit reached — upgrade to continue" : "Type your message here... (Enter to send, paste images)"}
              rows={1}
              className="w-full glass-input pr-14 pl-5 py-4 rounded-2xl text-sm focus:outline-none resize-none overflow-y-hidden shadow-2xl shadow-black/45"
            />
            <button
              type="submit"
              disabled={activeChatBusy || (!inputMessage.trim() && attachedImages.length === 0) || limitExceeded || limitBlocked}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] text-white disabled:text-gray-600 transition flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-600/15"
            >
              <Send size={16} />
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-500 mt-3 font-medium uppercase tracking-wide">
            RintisAI — Your AI Workspace
          </p>
        </footer>
      </main>

      {/* 💎 PREMIUM UPGRADE / SUBSCRIPTION PLAN MODAL */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl glass-panel p-5 sm:p-7 rounded-2xl relative my-4">
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
                <p className="text-sm text-gray-400 mb-6">
                  {subscription?.plan === "developer" 
                    ? "You are on the highest plan." 
                    : `Upgrade from ${subscription?.plan || "free"} to a higher plan.`}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {["student", "starter", "pro", "developer"]
                    .filter((p) => {
                      const tier = { free: 0, student: 1, starter: 2, pro: 3, developer: 4 };
                      return tier[p] > (tier[subscription?.plan] || 0);
                    })
                    .map((plan) => {
                    const detail = PLAN_UPGRADE_DETAILS[plan];
                    return (
                    <button
                      key={plan}
                      onClick={async () => {
                        setUpgradePlan(plan);
                        setUpgradeError("");
                        try {
                          const res = await fetch("/api/upgrade/prepare", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ plan }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setUpgradeCode(data.uniqueCode);
                            setUpgradeAmount(data.transferAmount);
                          }
                        } catch {}
                        setUpgradeStep("pay");
                      }}
                      className={`w-full h-full p-4 rounded-2xl border text-left cursor-pointer transition flex flex-col ${upgradePlan === plan ? "border-indigo-500/40 bg-indigo-500/10 shadow-lg shadow-indigo-950/20" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex h-full flex-col">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-white text-sm capitalize">{plan} Plan</h4>
                              <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">{detail.tag}</p>
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5">&rarr;</span>
                          </div>
                          <p className="text-lg text-white font-black mt-3">Rp {detail.price}<span className="text-[10px] text-gray-500 font-semibold"> / Month</span></p>
                          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed min-h-[34px]">{detail.bestFor}</p>
                          <div className="grid grid-cols-1 gap-1.5 mt-3 text-[10px] text-gray-300">
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
                  {subscription?.status === "active" && subscription?.plan !== "free" && (
                  <div className="border-t border-white/5 pt-3 mt-3">
                    <p className="text-[11px] text-gray-500 mb-2">Need more credit without changing plan?</p>
                    {[
                      { amount: 10000, label: "Rp 10.000", credits: "2M credits" },
                      { amount: 25000, label: "Rp 25.000", credits: "5M credits" },
                      { amount: 50000, label: "Rp 50.000", credits: "12M credits" },
                    ].map((topup) => (
                      <button
                        key={topup.amount}
                        onClick={async () => {
                          setUpgradePlan("topup");
                          setUpgradeError("");
                          try {
                            const res = await fetch("/api/upgrade/prepare", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ plan: "topup", amount: topup.amount }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setUpgradeCode(data.uniqueCode);
                              setUpgradeAmount(data.transferAmount);
                            }
                          } catch {}
                          setUpgradeStep("pay");
                        }}
                        className="w-full p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 text-left flex justify-between items-center cursor-pointer transition mb-2"
                      >
                        <div>
                          <h4 className="font-bold text-white text-sm">Top Up {topup.label}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">+{topup.credits} to your current plan</p>
                        </div>
                        <div className="text-xs text-gray-400">&rarr;</div>
                      </button>
                    ))}
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
                    Rp {upgradeAmount?.toLocaleString("id-ID") || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Unique code: <span className="text-indigo-300 font-bold text-sm">{upgradeCode || "—"}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">This code identifies your payment — transfer the exact amount above.</p>
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
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setProofImage(ev.target.result);
                              reader.readAsDataURL(file);
                            }
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
                    <p className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">2.</span> Once verified, your plan is activated — usually within 1-24 hours.</p>
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
                          if (tab.id === "api" && subscription?.plan === "developer") fetchApiKeys();
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
                    <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Name</label>
                        <input type="text" required value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
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
                        <div className="text-lg font-bold text-white capitalize">{subscription?.plan || "starter"}</div>
                        <span className="text-xs text-emerald-400 font-semibold capitalize">{subscription?.status || "active"}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Valid until {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString("en-US") : "-"}</p>
                    </div>

                    <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] mb-5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3 block">Usage Breakdown</span>
                      {usageItems.map((item) => (
                        <div key={item.key} className="mb-3 last:mb-0">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-gray-400">{item.label}</span>
                            <span className="text-gray-400">{item.percent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${getProgressBarColor(item.percent)}`} style={{ width: `${Math.max(item.percent, 2)}%` }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{formatCountdown(item.resetAt, item.key)}</div>
                        </div>
                      ))}
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
                  </div>
                )}

                {accountTab === "security" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Security</h3>
                    <p className="text-sm text-gray-400 mb-6">Change your account password regularly.</p>
                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Current Password</label>
                        <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">New Password</label>
                        <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl text-sm" />
                      </div>
                      <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer">Change Password</button>
                    </form>
                  </div>
                )}

                {accountTab === "api" && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><KeyRound size={18} className="text-indigo-400" />Local API Keys</h3>
                    <p className="text-sm text-gray-400 mb-6 leading-relaxed">Use local API keys with external editors like Continue, Cline, or other OpenAI-compatible local apps.</p>
                    {subscription?.plan !== "developer" || !subscription?.apiAccessEnabled ? (
                      <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-100">API keys are available for active Developer plans. Upgrade to connect RintisAI to your local editor.</div>
                    ) : (
                      <div>
                        {keyError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{keyError}</div>}
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                          {apiKeys.length === 0 ? <p className="text-xs text-gray-500 italic py-4 text-center">No active local API keys yet.</p> : apiKeys.map((k) => (
                            <div key={k.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <span className="font-semibold block text-white truncate">{k.name}</span>
                                <span className="font-mono text-indigo-300 block mt-0.5 truncate select-all" title="Click to copy">{k.key}</span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Created: {new Date(k.createdAt).toLocaleDateString("en-US")}</span>
                              </div>
                              <button onClick={() => handleDeleteApiKey(k.id)} className="p-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg cursor-pointer shrink-0 transition" title="Delete Key"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                        {apiKeys.length < 3 ? (
                          <form onSubmit={handleCreateApiKey} className="flex gap-2">
                            <input type="text" required value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (example: Home VS Code)" className="flex-1 glass-input px-3.5 py-2 rounded-xl text-xs" />
                            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer">Create Key</button>
                          </form>
                        ) : <p className="text-xs text-amber-500 text-center bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl">Maximum 3 API keys reached. Revoke one to create a new key.</p>}
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
  return (
    <main className="min-h-screen bg-main text-white overflow-y-auto">
      <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Bot size={24} className="text-indigo-400" />
          <span className="font-bold text-white">RintisAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white">Sign In</Link>
          <Link href="/register" className="text-sm py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition">Get Started</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-16 pb-8 text-center">
        <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-8 text-indigo-400">
          <Bot size={40} />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          AI workspace for<br />
          <span className="text-indigo-400">Indonesian developers</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Multi-model AI chat, local API keys for your editor, and simple Rupiah payments.
          No foreign credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link href="/register" className="py-3.5 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20">
            Create Free Account
          </Link>
          <Link href="/login" className="py-3.5 px-8 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 font-semibold rounded-xl text-sm transition">
            Sign In
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-center text-2xl font-black mb-12">Why RintisAI?</h2>
        <div className="grid md:grid-cols-3 gap-5 mb-20">
          <FeatureCard icon={Bot} title="GPT-5.4 Mini, 5.4, & 5.5" desc="Three AI models with different capabilities. Mini for speed, Pro for balance, Ultra for depth." />
          <FeatureCard icon={KeyRound} title="Local API Keys" desc="Generate your own API key and use it in VS Code, Continue, Cline — full OpenAI compatibility." />
          <FeatureCard icon={Shield} title="Pay in Rupiah" desc="GoPay, OVO, bank transfer, crypto. No foreign card, no VPN tricks." />
        </div>

        <h2 className="text-center text-2xl font-black mb-12">Plans</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 mb-20">
          <PlanCard name="Free" price="Rp 0" features={["GPT-5.4 Mini", "Small limit", "Try it out"]} />
          <PlanCard name="Student" price="Rp 29K" features={["GPT-5.4 Mini", "GPT-5.4 Pro", "Good for learning"]} />
          <PlanCard name="Starter" price="Rp 49K" features={["All models", "Daily usage", "Casual coding"]} />
          <PlanCard name="Pro" price="Rp 89K" features={["All models", "Higher limits", "Reasoning control"]} popular />
          <PlanCard name="Developer" price="Rp 149K" features={["Local API keys", "VS Code support", "Editor integration"]} />
        </div>

        <h2 className="text-center text-2xl font-black mb-2">Compare</h2>
        <p className="text-center text-sm text-gray-500 mb-8">RintisAI vs popular AI platforms for Indonesian developers</p>
        <div className="overflow-x-auto mb-20">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 text-gray-400 font-medium"></th>
                <th className="py-3 px-4 text-white font-bold">RintisAI</th>
                <th className="py-3 px-4 text-gray-500">ChatGPT Plus</th>
                <th className="py-3 px-4 text-gray-500">Claude Pro</th>
                <th className="py-3 px-4 text-gray-500">GitHub Copilot</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              {[
                ["Monthly price", "From Rp 29K", "$20 (~Rp 360K)", "$20 (~Rp 360K)", "$10 (~Rp 180K)"],
                ["Payment method", "GoPay, OVO, bank, crypto", "Credit card only", "Credit card only", "Credit card only"],
                ["Flat monthly, no hidden cost", "Yes — pay once, use freely", "Yes", "Yes", "Yes"],
                ["API key for external editor", "Yes — use in VS Code, Continue, Cline", "Extra cost (pay-per-token)", "Extra cost (pay-per-token)", "Editor-only, no API key"],
                ["API pricing model", "Included in subscription", "$2.5-15 / 1M tokens", "$3-15 / 1M tokens", "N/A"],
                ["Web chat", "Yes — full UI", "Yes", "Yes", "No"],
                ["Multi-model in one place", "GPT-5.4 Mini, 5.4, 5.5", "GPT only", "Claude only", "Copilot only"],
                ["Support language", "Bahasa Indonesia (WhatsApp)", "English (email)", "English (email)", "English (email)"],
                ["Student discount", "Rp 29K plan", "None", "None", "Free with GitHub edu"],
                ["Requires foreign payment", "No", "Yes", "Yes", "Yes"],
              ].map(([label, rintis, gpt, claude, copilot], i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-3 px-4 text-gray-300 font-medium">{label}</td>
                  <td className="py-3 px-4 text-emerald-300">{rintis}</td>
                  <td className="py-3 px-4">{gpt}</td>
                  <td className="py-3 px-4">{claude}</td>
                  <td className="py-3 px-4">{copilot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center py-16 border-t border-white/5">
          <h2 className="text-2xl font-black mb-4">Your chats are private</h2>
          <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
            All your conversations and API keys are stored securely on our server. 
            You get your own account, your own history, and your own API keys — 
            never shared with anyone else.
          </p>
        </div>

        <footer className="pt-12 pb-8 border-t border-white/5 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition">Privacy Policy</Link>
            <span className="text-gray-700">·</span>
            <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition">Terms of Service</Link>
          </div>
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

function PlanCard({ name, price, features, popular }) {
  return (
    <div className={`glass-card rounded-2xl p-5 text-left relative overflow-hidden ${popular ? "border-indigo-500/30" : ""}`}>
      {popular && <div className="absolute top-0 right-0 py-0.5 px-3 bg-indigo-600 text-[9px] font-bold uppercase tracking-wider text-white rounded-bl-lg">Popular</div>}
      <h3 className="font-bold text-white">{name}</h3>
      <p className="text-xl font-black text-white mt-2">{price}</p>
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
