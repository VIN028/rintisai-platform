export const MODEL_CONFIG = {
  "gpt-5.5": {
    label: "GPT-5.5 Ultra",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 0,
      student: 0,
      starter: 256_000,
      pro: 512_000,
      developer: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      student: 0,
      starter: 16_384,
      pro: 65_536,
      developer: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
  },
  "gpt-5.4": {
    label: "GPT-5.4 Pro",
    contextTokens: 1_050_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 0,
      student: 128_000,
      starter: 256_000,
      pro: 512_000,
      developer: 1_050_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      student: 16_384,
      starter: 16_384,
      pro: 65_536,
      developer: 128_000,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 Mini",
    contextTokens: 400_000,
    resellerMaxOutputTokens: 128_000,
    maxContextByPlan: {
      free: 32_000,
      student: 128_000,
      starter: 256_000,
      pro: 400_000,
      developer: 400_000,
    },
    defaultOutputTokens: 8_192,
    maxOutputByPlan: {
      free: 4_096,
      student: 8_192,
      starter: 16_384,
      pro: 32_768,
      developer: 65_536,
    },
    reasoning: ["low", "medium", "high", "xhigh"],
    reseller: "plus",
  },
  "claude-sonnet": {
    label: "Claude Sonnet",
    upstreamModel: "claude-sonnet-5",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 64_000,
    maxContextByPlan: {
      free: 0,
      student: 0,
      starter: 0,
      pro: 128_000,
      developer: 200_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      student: 0,
      starter: 0,
      pro: 32_768,
      developer: 64_000,
    },
    reasoning: ["low", "medium", "high"],
    reseller: "claude",
  },
  "claude-haiku": {
    label: "Claude Haiku",
    upstreamModel: "claude-haiku-4-5",
    contextTokens: 200_000,
    resellerMaxOutputTokens: 64_000,
    maxContextByPlan: {
      free: 0,
      student: 0,
      starter: 0,
      pro: 128_000,
      developer: 200_000,
    },
    defaultOutputTokens: 16_384,
    maxOutputByPlan: {
      free: 0,
      student: 0,
      starter: 0,
      pro: 32_768,
      developer: 64_000,
    },
    reasoning: ["low", "medium", "high"],
    reseller: "claude",
  },
};

export const ALLOWED_MODELS = new Set(Object.keys(MODEL_CONFIG));

export const PLAN_MODEL_ALLOWANCE = {
  free: ["gpt-5.4-mini"],
  student: ["gpt-5.4-mini", "gpt-5.4"],
  starter: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"],
  pro: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku"],
  developer: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku"],
};

export function getModelConfig(model) {
  return MODEL_CONFIG[model] || null;
}

export function isModelAllowedForPlan(model, plan) {
  return (PLAN_MODEL_ALLOWANCE[plan] || []).includes(model);
}

export function getMaxOutputTokens(model, plan, requestedMaxTokens = null) {
  const config = getModelConfig(model);
  if (!config) return 0;
  const planMax = config.maxOutputByPlan[plan] || 0;
  const defaultTokens = Math.min(config.defaultOutputTokens, planMax);
  const requested = Number(requestedMaxTokens);
  if (!Number.isFinite(requested) || requested <= 0) return defaultTokens;
  return Math.min(Math.round(requested), planMax, config.resellerMaxOutputTokens);
}

export function getMaxContextTokens(model, plan) {
  const config = getModelConfig(model);
  if (!config) return 0;
  return Math.min(config.maxContextByPlan[plan] || 0, config.contextTokens);
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

  return {
    type: "openai",
    baseUrl: process.env.RESELLER_BASE_URL,
    apiKey: process.env.RESELLER_API_KEY,
    fallbackApiKey: process.env.RESELLER_API_KEY_PRO || null,
    upstreamModel: config?.upstreamModel || model,
  };
}
