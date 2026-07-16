import { getPlanDefinition } from "@/lib/plans";

export const API_PAYG_MODELS = ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "claude-haiku", "claude-sonnet", "claude-opus"];

export const MODEL_CONFIG = {
  "gpt-5.6-sol": {
    label: "GPT-5.6 Sol",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    fallbackModel: "gpt-5.6-terra",
    maxContextByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 0,
      codex_pro: 1_050_000,
      api_gpt: 1_050_000,
      api_claude: 1_050_000,
      api_grok: 1_050_000,
      claude_api: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 0,
      codex_pro: 128_000,
      api_gpt: 128_000,
      api_claude: 128_000,
      api_grok: 128_000,
      claude_api: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    vision: false,
  },
  "gpt-5.6-terra": {
    label: "GPT-5.6 Terra",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 1_050_000,
      codex_pro: 1_050_000,
      api_gpt: 1_050_000,
      api_claude: 1_050_000,
      api_grok: 1_050_000,
      claude_api: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 128_000,
      codex_pro: 128_000,
      api_gpt: 128_000,
      api_claude: 128_000,
      api_grok: 128_000,
      claude_api: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    vision: false,
  },
  "gpt-5.5": {
    label: "GPT-5.5 Ultra",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 1_050_000,
      codex_pro: 1_050_000,
      api_gpt: 1_050_000,
      api_claude: 1_050_000,
      api_grok: 1_050_000,
      claude_api: 1_050_000,
      student: 0,
      starter: 256_000,
      pro: 512_000,
      developer: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 128_000,
      codex_pro: 128_000,
      api_gpt: 128_000,
      api_claude: 128_000,
      api_grok: 128_000,
      claude_api: 128_000,
      student: 0,
      starter: 16_384,
      pro: 65_536,
      developer: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    vision: false,
  },
  "gpt-5.4": {
    label: "GPT-5.4 Pro",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 1_050_000,
      codex_pro: 1_050_000,
      api_gpt: 1_050_000,
      api_claude: 1_050_000,
      api_grok: 1_050_000,
      claude_api: 1_050_000,
      student: 128_000,
      starter: 256_000,
      pro: 512_000,
      developer: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      gpt_chat: 0,
      gpt_code: 128_000,
      codex_pro: 128_000,
      api_gpt: 128_000,
      api_claude: 128_000,
      api_grok: 128_000,
      claude_api: 128_000,
      student: 16_384,
      starter: 16_384,
      pro: 65_536,
      developer: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    vision: false,
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 Mini",
    contextTokens: 400_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 32_000,
      gpt_chat: 128_000,
      gpt_code: 400_000,
      codex_pro: 400_000,
      api_gpt: 400_000,
      api_claude: 400_000,
      api_grok: 400_000,
      claude_api: 400_000,
      student: 128_000,
      starter: 256_000,
      pro: 400_000,
      developer: 400_000,
    },
    defaultOutputTokens: 8_192,
    maxOutputByPlan: {
      free: 4_096,
      gpt_chat: 16_384,
      gpt_code: 65_536,
      codex_pro: 65_536,
      api_gpt: 65_536,
      api_claude: 65_536,
      api_grok: 65_536,
      claude_api: 65_536,
      student: 8_192,
      starter: 16_384,
      pro: 32_768,
      developer: 65_536,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    reseller: "plus",
    vision: false,
  },
  "claude-sonnet": {
    label: "Claude Sonnet",
    upstreamModel: "claude-sonnet-5",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 64_000,
    maxContextByPlan: {
      free: 0,
      claude_lite: 200_000,
      claude_code: 200_000,
      claude_pro: 200_000,
      api_claude: 200_000,
      api_gpt: 200_000,
      api_grok: 200_000,
      student: 0,
      starter: 0,
      pro: 128_000,
      developer: 200_000,
      claude_api: 200_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      claude_lite: 64_000,
      claude_code: 64_000,
      claude_pro: 64_000,
      api_claude: 64_000,
      api_gpt: 64_000,
      api_grok: 64_000,
      student: 0,
      starter: 0,
      pro: 32_768,
      developer: 64_000,
      claude_api: 64_000,
    },
    reasoning: ["low", "medium", "high"],
    reseller: "claude",
    vision: false,
  },
  "claude-haiku": {
    label: "Claude Haiku",
    upstreamModel: "claude-haiku-4-5",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 64_000,
    maxContextByPlan: {
      free: 0,
      claude_lite: 200_000,
      claude_code: 200_000,
      claude_pro: 200_000,
      api_claude: 200_000,
      api_gpt: 200_000,
      api_grok: 200_000,
      student: 0,
      starter: 0,
      pro: 128_000,
      developer: 200_000,
      claude_api: 200_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      claude_lite: 64_000,
      claude_code: 64_000,
      claude_pro: 64_000,
      api_claude: 64_000,
      api_gpt: 64_000,
      api_grok: 64_000,
      student: 0,
      starter: 0,
      pro: 32_768,
      developer: 64_000,
      claude_api: 64_000,
    },
    reasoning: ["low", "medium", "high"],
    reseller: "claude",
    vision: false,
  },
  "claude-opus": {
    label: "Claude Opus 4.8",
    upstreamModel: "claude-opus-4-8",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 64_000,
    maxContextByPlan: {
      free: 0,
      claude_lite: 0,
      claude_code: 200_000,
      claude_pro: 200_000,
      api_claude: 200_000,
      api_gpt: 200_000,
      api_grok: 200_000,
      student: 0,
      starter: 0,
      pro: 64_000,
      developer: 128_000,
      claude_api: 200_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      claude_lite: 0,
      claude_code: 64_000,
      claude_pro: 64_000,
      api_claude: 64_000,
      api_gpt: 64_000,
      api_grok: 64_000,
      student: 0,
      starter: 0,
      pro: 8_192,
      developer: 16_384,
      claude_api: 64_000,
    },
    reasoning: ["low", "medium", "high"],
    reseller: "claude",
    vision: false,
  },
  "grok-4.5": {
    label: "Grok 4.5",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 32_000,
    defaultOutputTokens: 8_192,
    maxContextByPlan: { free: 0, grok_lite: 200_000, grok_code: 200_000, grok_pro: 200_000, api_grok: 200_000, api_gpt: 200_000, api_claude: 200_000, claude_api: 200_000 },
    maxOutputByPlan: { free: 0, grok_lite: 32_000, grok_code: 32_000, grok_pro: 32_000, api_grok: 32_000, api_gpt: 32_000, api_claude: 32_000, claude_api: 32_000 },
    reasoning: ["low", "medium", "high"],
    reseller: "grok",
    vision: false,
  },
  "grok-4.3": {
    label: "Grok 4.3",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 32_000,
    defaultOutputTokens: 8_192,
    maxContextByPlan: { free: 0, grok_lite: 200_000, grok_code: 200_000, grok_pro: 200_000, api_grok: 200_000, api_gpt: 200_000, api_claude: 200_000, claude_api: 200_000 },
    maxOutputByPlan: { free: 0, grok_lite: 32_000, grok_code: 32_000, grok_pro: 32_000, api_grok: 32_000, api_gpt: 32_000, api_claude: 32_000, claude_api: 32_000 },
    reasoning: ["low", "medium", "high"],
    reseller: "grok",
    vision: false,
  },
  "grok-build-0.1": {
    label: "Grok Build",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 32_000,
    defaultOutputTokens: 8_192,
    maxContextByPlan: { free: 0, grok_lite: 200_000, grok_code: 200_000, grok_pro: 200_000, api_grok: 200_000, api_gpt: 200_000, api_claude: 200_000, claude_api: 200_000 },
    maxOutputByPlan: { free: 0, grok_lite: 32_000, grok_code: 32_000, grok_pro: 32_000, api_grok: 32_000, api_gpt: 32_000, api_claude: 32_000, claude_api: 32_000 },
    reasoning: ["low", "medium", "high"],
    reseller: "grok",
    vision: false,
  },
};

export const ALLOWED_MODELS = new Set(Object.keys(MODEL_CONFIG));

export const MODEL_ALIASES = {
  "claude-sonnet-5": "claude-sonnet",
  "claude-haiku-4-5": "claude-haiku",
  "claude-opus-4-8": "claude-opus",
};

export function normalizeModelId(model) {
  return MODEL_ALIASES[model] || model;
}

export function getModelFamily(model) {
  const normalized = normalizeModelId(model || "");
  if (normalized.startsWith("gpt-")) return "gpt";
  if (normalized.startsWith("claude-")) return "claude";
  if (normalized.startsWith("grok-")) return "grok";
  return null;
}

export const PLAN_MODEL_ALLOWANCE = {
  free: ["gpt-5.4-mini"],
  gpt_chat: ["gpt-5.4-mini"],
  gpt_code: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra"],
  codex_pro: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol"],
  claude_lite: ["claude-haiku", "claude-sonnet"],
  claude_code: ["claude-haiku", "claude-sonnet", "claude-opus"],
  claude_pro: ["claude-haiku", "claude-sonnet", "claude-opus"],
  grok_lite: [],
  grok_code: [],
  grok_pro: [],
  api_gpt: API_PAYG_MODELS,
  api_claude: API_PAYG_MODELS,
  api_grok: API_PAYG_MODELS,
  student: ["gpt-5.4-mini", "gpt-5.4"],
  starter: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"],
  pro: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku", "claude-opus"],
  developer: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku", "claude-opus"],
  claude_api: API_PAYG_MODELS,
};

export function getModelConfig(model) {
  return MODEL_CONFIG[model] || null;
}

export function isModelAllowedForPlan(model, plan) {
  return (PLAN_MODEL_ALLOWANCE[plan] || getPlanDefinition(plan)?.models || []).includes(model);
}

export function getMaxOutputTokens(model, plan, requestedMaxTokens = null) {
  const config = getModelConfig(model);
  if (!config) return 0;
  const planMax = Object.prototype.hasOwnProperty.call(config.maxOutputByPlan, plan) ? config.maxOutputByPlan[plan] : 0;
  const defaultTokens = Math.min(config.defaultOutputTokens, planMax);
  const requested = Number(requestedMaxTokens);
  if (!Number.isFinite(requested) || requested <= 0) return defaultTokens;
  return Math.min(Math.round(requested), planMax, config.resellerMaxOutputTokens);
}

export function getMaxContextTokens(model, plan) {
  const config = getModelConfig(model);
  if (!config) return 0;
  if (plan !== "free") return config.contextTokens;
  const planMax = Object.prototype.hasOwnProperty.call(config.maxContextByPlan, plan) ? config.maxContextByPlan[plan] : 0;
  return Math.min(planMax, config.contextTokens);
}

export function supportsVisionInput(model) {
  const envModels = typeof process !== "undefined" ? process.env.VISION_ENABLED_MODELS : "";
  if (envModels?.split(",").map((item) => item.trim()).includes(model)) return true;
  return getModelConfig(model)?.vision === true;
}

export function normalizeReasoningEffort(value) {
  if (!["low", "medium", "high", "xhigh"].includes(value)) return null;
  return value;
}

export function toUpstreamReasoningEffort(value) {
  const normalized = normalizeReasoningEffort(value);
  if (normalized === "xhigh") return "high";
  if (normalized === "high") return "medium";
  return normalized;
}

export function getResellerConfig(model) {
  const config = getModelConfig(model);
  const reseller = config?.reseller || "plus";

  if (reseller === "claude") {
    return {
      type: "anthropic",
      baseUrl: process.env.RESELLER_BASE_URL_CLAUDE || process.env.RESELLER_BASE_URL,
      apiKey: process.env.RESELLER_API_KEY_CLAUDE || process.env.RESELLER_API_KEY,
      upstreamModel: config?.upstreamModel || model,
    };
  }

  if (reseller === "grok") {
    return {
      type: "anthropic",
      baseUrl: process.env.RESELLER_BASE_URL_GROK || "https://codex-everywhere.com/v1",
      apiKey: process.env.RESELLER_API_KEY_GROK,
      upstreamModel: config?.upstreamModel || model,
      providerPool: "grok",
    };
  }

  return {
    type: "openai",
    baseUrl: process.env.RESELLER_BASE_URL,
    apiKey: process.env.RESELLER_API_KEY,
    fallbackApiKey: process.env.RESELLER_API_KEY_PRO || null,
    fallbackModel: config?.fallbackModel || null,
    upstreamModel: config?.upstreamModel || model,
  };
}
