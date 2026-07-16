export const API_BASE_URL = "https://rintisai.site/api/v1";
export const ANTHROPIC_BASE_URL = "https://rintisai.site/api";
export const DEFAULT_USD_IDR_RATE = 18500;

export const API_PAYG_PRICING = {
  "gpt-5.4-mini": { label: "GPT-5.4 Mini", family: "Codex/GPT", inputUsdPerMillion: 0.03, outputUsdPerMillion: 0.12, officialInputUsdPerMillion: 0.3, officialOutputUsdPerMillion: 1.2, recommendedTopupRp: 25000 },
  "gpt-5.4": { label: "GPT-5.4 Pro", family: "Codex/GPT", inputUsdPerMillion: 0.10, outputUsdPerMillion: 0.40, officialInputUsdPerMillion: 1, officialOutputUsdPerMillion: 4, recommendedTopupRp: 50000 },
  "gpt-5.5": { label: "GPT-5.5 Ultra", family: "Codex/GPT", inputUsdPerMillion: 0.20, outputUsdPerMillion: 0.80, officialInputUsdPerMillion: 2, officialOutputUsdPerMillion: 8, recommendedTopupRp: 100000 },
  "gpt-5.6-terra": { label: "GPT-5.6 Terra", family: "Codex/GPT", inputUsdPerMillion: 0.30, outputUsdPerMillion: 1.20, officialInputUsdPerMillion: 3, officialOutputUsdPerMillion: 12, recommendedTopupRp: 100000 },
  "gpt-5.6-sol": { label: "GPT-5.6 Sol", family: "Codex/GPT", inputUsdPerMillion: 0.40, outputUsdPerMillion: 1.60, officialInputUsdPerMillion: 4, officialOutputUsdPerMillion: 16, recommendedTopupRp: 250000 },
  "claude-haiku": { label: "Claude Haiku", family: "Claude", inputUsdPerMillion: 0.085, outputUsdPerMillion: 0.425, officialInputUsdPerMillion: 1, officialOutputUsdPerMillion: 5, recommendedTopupRp: 50000 },
  "claude-sonnet": { label: "Claude Sonnet", family: "Claude", inputUsdPerMillion: 0.17, outputUsdPerMillion: 0.85, officialInputUsdPerMillion: 2, officialOutputUsdPerMillion: 10, recommendedTopupRp: 100000 },
  "claude-opus": { label: "Claude Opus", family: "Claude", inputUsdPerMillion: 0.425, outputUsdPerMillion: 2.125, officialInputUsdPerMillion: 5, officialOutputUsdPerMillion: 25, recommendedTopupRp: 250000 },
};

export const API_TOPUP_AMOUNTS = [25000, 50000, 100000, 250000, 500000];

export const API_MODEL_GROUPS = [
  { key: "codex", label: "Codex/GPT", models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol"], endpoint: "openai", status: "available" },
  { key: "claude", label: "Claude", models: ["claude-haiku", "claude-sonnet", "claude-opus"], anthropicModels: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"], endpoint: "anthropic", status: "available" },
];

export const API_ENDPOINT_STATUS = [
  { name: "OpenAI-compatible API", url: API_BASE_URL, status: "operational" },
  { name: "Anthropic-compatible API", url: ANTHROPIC_BASE_URL, status: "operational" },
  { name: "Dashboard & Billing", url: "https://rintisai.site", status: "operational" },
];

export const API_INCIDENTS = [
  { title: "No active incident reported", status: "resolved", detail: "Model routing and API dashboard are operating normally.", date: "Current" },
];

export function calculateApiCostUsd({ model, inputTokens = 0, outputTokens = 0 }) {
  const pricing = API_PAYG_PRICING[model];
  if (!pricing) return 0;
  return ((Math.max(0, Number(inputTokens) || 0) * pricing.inputUsdPerMillion) + (Math.max(0, Number(outputTokens) || 0) * pricing.outputUsdPerMillion)) / 1_000_000;
}

export function calculateApiCostRp({ model, inputTokens = 0, outputTokens = 0, usdIdrRate = DEFAULT_USD_IDR_RATE }) {
  return Math.ceil(calculateApiCostUsd({ model, inputTokens, outputTokens }) * usdIdrRate);
}

export function recommendTopupAmount(costRp) {
  const minimum = Math.max(25000, Math.ceil((Number(costRp) || 0) * 1.25));
  return API_TOPUP_AMOUNTS.find((amount) => amount >= minimum) || API_TOPUP_AMOUNTS[API_TOPUP_AMOUNTS.length - 1];
}

export function getModelLabel(model) {
  return API_PAYG_PRICING[model]?.label || model;
}
