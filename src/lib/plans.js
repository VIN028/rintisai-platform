export const BILLING_INTERVALS = ["3day", "weekly", "monthly"];

export const USAGE_WINDOW_CONFIG = {
  "3day": { key: "3day", label: "3-Day", ms: 3 * 24 * 60 * 60 * 1000, limitKey: "threeDay" },
  weekly: { key: "weekly", label: "Weekly", ms: 7 * 24 * 60 * 60 * 1000, limitKey: "weekly" },
  monthly: { key: "monthly", label: "Monthly", ms: 30 * 24 * 60 * 60 * 1000, limitKey: "monthly" },
};

const EMPTY_LIMITS = { threeDay: 0, weekly: 0, monthly: 0 };

export const PLAN_CATALOG = {
  free: {
    family: "free",
    label: "Free",
    shortLabel: "Free",
    description: "Try RintisAI with a limited monthly allowance.",
    prices: { "3day": 0, weekly: 0, monthly: 0 },
    limits: { threeDay: 100000, weekly: 300000, monthly: 1000000 },
    models: ["gpt-5.4-mini"],
    apiAccess: false,
  },
  gpt_chat: {
    family: "gpt",
    label: "Codex Lite",
    shortLabel: "Codex Lite",
    description: "Low-cost GPT/Codex web chat for daily work, files, URLs, and light coding.",
    prices: { "3day": 9000, weekly: 15000, monthly: 19000 },
    limits: { threeDay: 8000000, weekly: 15000000, monthly: 25000000 },
    models: ["gpt-5.4-mini"],
    apiAccess: false,
  },
  gpt_code: {
    family: "gpt",
    label: "Codex Code",
    shortLabel: "Codex Code",
    description: "GPT/Codex coding with API keys for editor and automation workflows.",
    prices: { "3day": 15000, weekly: 29000, monthly: 49000 },
    limits: { threeDay: 15000000, weekly: 35000000, monthly: 75000000 },
    models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra"],
    apiAccess: true,
  },
  codex_pro: {
    family: "gpt",
    label: "Codex Pro",
    shortLabel: "Codex Pro",
    description: "Higher GPT/Codex limits for daily coding agents and heavier automation.",
    prices: { "3day": 25000, weekly: 49000, monthly: 89000 },
    limits: { threeDay: 35000000, weekly: 75000000, monthly: 160000000 },
    models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol"],
    apiAccess: true,
  },
  claude_lite: {
    family: "claude",
    label: "Claude Lite",
    shortLabel: "Claude Lite",
    description: "Affordable Claude web chat and coding help with Haiku and Sonnet.",
    prices: { "3day": 15000, weekly: 35000, monthly: 49000 },
    limits: { threeDay: 10000000, weekly: 30000000, monthly: 45000000 },
    models: ["claude-haiku", "claude-sonnet"],
    apiAccess: false,
  },
  claude_code: {
    family: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    description: "Claude web chat and Claude Code/OpenCode compatible coding workflows.",
    prices: { "3day": 19000, weekly: 49000, monthly: 79000 },
    limits: { threeDay: 15000000, weekly: 45000000, monthly: 80000000 },
    models: ["claude-haiku", "claude-sonnet", "claude-opus"],
    apiAccess: true,
  },
  claude_pro: {
    family: "claude",
    label: "Claude Pro",
    shortLabel: "Claude Pro",
    description: "Higher Claude limits for regular Sonnet and Opus coding workflows.",
    prices: { "3day": 29000, weekly: 79000, monthly: 129000 },
    limits: { threeDay: 30000000, weekly: 80000000, monthly: 160000000 },
    models: ["claude-haiku", "claude-sonnet", "claude-opus"],
    apiAccess: true,
  },
  grok_lite: {
    family: "grok",
    label: "Discontinued Plan",
    shortLabel: "Discontinued",
    description: "Discontinued legacy plan kept for old records.",
    prices: { "3day": 12000, weekly: 19000, monthly: 29000 },
    limits: { threeDay: 15000000, weekly: 25000000, monthly: 40000000 },
    models: [],
    apiAccess: false,
    discontinued: true,
  },
  grok_code: {
    family: "grok",
    label: "Discontinued Plan",
    shortLabel: "Discontinued",
    description: "Discontinued legacy plan kept for old records.",
    prices: { "3day": 15000, weekly: 29000, monthly: 49000 },
    limits: { threeDay: 25000000, weekly: 45000000, monthly: 90000000 },
    models: [],
    apiAccess: false,
    discontinued: true,
  },
  grok_pro: {
    family: "grok",
    label: "Discontinued Plan",
    shortLabel: "Discontinued",
    description: "Discontinued legacy plan kept for old records.",
    prices: { "3day": 25000, weekly: 49000, monthly: 79000 },
    limits: { threeDay: 45000000, weekly: 90000000, monthly: 160000000 },
    models: [],
    apiAccess: false,
    discontinued: true,
  },
  api_gpt: {
    family: "api_payg",
    label: "API PAYG",
    shortLabel: "API PAYG",
    description: "API-only pay-as-you-go access for GPT and Claude models.",
    prices: { "3day": 0, weekly: 0, monthly: 0 },
    limits: EMPTY_LIMITS,
    models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "claude-haiku", "claude-sonnet", "claude-opus"],
    apiAccess: true,
    apiOnly: true,
  },
  api_claude: {
    family: "api_payg",
    label: "API PAYG",
    shortLabel: "API PAYG",
    description: "API-only pay-as-you-go access for GPT and Claude models.",
    prices: { "3day": 0, weekly: 0, monthly: 0 },
    limits: EMPTY_LIMITS,
    models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "claude-haiku", "claude-sonnet", "claude-opus"],
    apiAccess: true,
    apiOnly: true,
  },
  api_grok: {
    family: "api_payg",
    label: "API PAYG",
    shortLabel: "API PAYG",
    description: "Legacy API PAYG alias for Codex and Claude models.",
    prices: { "3day": 0, weekly: 0, monthly: 0 },
    limits: EMPTY_LIMITS,
    models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "claude-haiku", "claude-sonnet", "claude-opus"],
    apiAccess: true,
    apiOnly: true,
    discontinued: true,
  },
};

export const LEGACY_PLAN_ALIASES = {
  student: { limits: { threeDay: 3000000, weekly: 8000000, monthly: 40000000 }, models: ["gpt-5.4-mini", "gpt-5.4"], apiAccess: true },
  starter: { limits: { threeDay: 5000000, weekly: 14000000, monthly: 60000000 }, models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"], apiAccess: true },
  pro: { limits: { threeDay: 10000000, weekly: 28000000, monthly: 120000000 }, models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku", "claude-opus"], apiAccess: true },
  developer: { limits: { threeDay: 15000000, weekly: 44000000, monthly: 200000000 }, models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "claude-sonnet", "claude-haiku", "claude-opus"], apiAccess: true },
  claude_api: { aliasOf: "api_claude" },
};

export function getPlanDefinition(plan) {
  if (PLAN_CATALOG[plan]) return PLAN_CATALOG[plan];
  const legacy = LEGACY_PLAN_ALIASES[plan];
  if (legacy?.aliasOf) return PLAN_CATALOG[legacy.aliasOf];
  if (legacy) return { family: "legacy", label: plan, shortLabel: plan, ...legacy };
  return null;
}

export function normalizeBillingInterval(interval) {
  return interval === "3day" ? "3day" : interval === "weekly" ? "weekly" : "monthly";
}

export function getUsageWindowConfig(interval = "monthly") {
  return USAGE_WINDOW_CONFIG[normalizeBillingInterval(interval)] || USAGE_WINDOW_CONFIG.monthly;
}

export function getUsageWindowStart(subscription, limits, now = new Date()) {
  const windowMs = limits?.windowMs || getUsageWindowConfig("monthly").ms;
  const rollingStart = new Date(now.getTime() - windowMs);
  const periodStart = subscription?.updatedAt ? new Date(subscription.updatedAt) : null;

  if (periodStart && !Number.isNaN(periodStart.getTime()) && periodStart > rollingStart) {
    return periodStart;
  }

  return rollingStart;
}

export function getPlanLimits(plan) {
  return getPlanDefinition(plan)?.limits || EMPTY_LIMITS;
}

export function getPlanLimit(plan, interval = "monthly", subscription = null) {
  const limits = getPlanLimits(plan);
  const normalizedInterval = normalizeBillingInterval(interval);

  if (normalizedInterval === "3day") return subscription?.[getCustomLimitField(normalizedInterval)] ?? limits.threeDay ?? 0;
  if (normalizedInterval === "weekly") return subscription?.customLimitWeekly ?? limits.weekly ?? 0;
  return subscription?.customLimitMonthly ?? limits.monthly ?? 0;
}

export function getCustomLimitField(interval = "monthly") {
  const normalizedInterval = normalizeBillingInterval(interval);
  if (normalizedInterval === "3day") return "customLimit5h";
  if (normalizedInterval === "weekly") return "customLimitWeekly";
  return "customLimitMonthly";
}

export function getPlanPrice(plan, interval = "monthly") {
  return PLAN_CATALOG[plan]?.prices?.[interval] || 0;
}

export function isPurchasablePlan(plan) {
  const definition = getPlanDefinition(plan);
  return Boolean(definition && !definition.discontinued && !definition.apiOnly && definition.family !== "free");
}

export function isApiPlan(plan) {
  return Boolean(getPlanDefinition(plan)?.apiOnly);
}

export function isDiscontinuedPlan(plan) {
  return Boolean(getPlanDefinition(plan)?.discontinued);
}
