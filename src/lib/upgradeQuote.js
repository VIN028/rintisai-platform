const quoteMap = new Map();
const QUOTE_TTL_MS = 15 * 60 * 1000;

function keyFor({ userId, plan, amount }) {
  return `${userId}:${plan}:${amount || ""}`;
}

export function createUpgradeQuote({ userId, plan, amount, baseAmount }) {
  const uniqueCode = String(Math.floor(Math.random() * 900) + 100);
  const quote = {
    uniqueCode,
    transferAmount: baseAmount + Number(uniqueCode),
    expiresAt: Date.now() + QUOTE_TTL_MS,
  };
  quoteMap.set(keyFor({ userId, plan, amount }), quote);
  return quote;
}

export function getUpgradeQuote({ userId, plan, amount }) {
  const key = keyFor({ userId, plan, amount });
  const quote = quoteMap.get(key);
  if (!quote || quote.expiresAt < Date.now()) {
    quoteMap.delete(key);
    return null;
  }
  return quote;
}
