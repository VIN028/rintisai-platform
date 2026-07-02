import prisma from "@/lib/db";
import { estimateTokens, modelMultiplier, reasoningMultiplier } from "@/lib/security";

const userLocks = new Map();

async function withUserLock(userId, fn) {
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  userLocks.set(userId, previous.then(() => current));

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === current) userLocks.delete(userId);
  }
}

export function estimateUsageUnits({ promptText, model, maxTokens, reasoningEffort }) {
  return (estimateTokens(promptText) + maxTokens) * modelMultiplier(model) * reasoningMultiplier(reasoningEffort);
}

export async function reserveUsage({ userId, model, source, apiKeyId = null, estimatedPromptTokens, estimatedTotalTokens, limits, plan }) {
  return withUserLock(userId, async () => {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (plan === "free") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const freeReqToday = await prisma.tokenUsage.count({ where: { userId, timestamp: { gte: todayStart } } });
      if (freeReqToday >= 30) {
        return { error: "Free plan daily limit reached (30 requests). Upgrade for unlimited.", status: 429 };
      }
    }

    const [usage5h, usage7d, usage30d] = await Promise.all([
      prisma.tokenUsage.aggregate({ where: { userId, timestamp: { gte: fiveHoursAgo } }, _sum: { totalTokens: true } }),
      prisma.tokenUsage.aggregate({ where: { userId, timestamp: { gte: sevenDaysAgo } }, _sum: { totalTokens: true } }),
      prisma.tokenUsage.aggregate({ where: { userId, timestamp: { gte: thirtyDaysAgo } }, _sum: { totalTokens: true } }),
    ]);

    const total5h = usage5h._sum.totalTokens || 0;
    const total7d = usage7d._sum.totalTokens || 0;
    const total30d = usage30d._sum.totalTokens || 0;

    if (total5h + estimatedTotalTokens > limits.rolling5h) {
      return { error: "Pemakaian sesi aktif sedang penuh. Coba lagi beberapa saat nanti atau upgrade paket.", status: 429 };
    }
    if (total7d + estimatedTotalTokens > limits.weekly) {
      return { error: "Your weekly plan usage limit has been reached.", status: 429 };
    }
    if (total30d + estimatedTotalTokens > limits.monthly) {
      return { error: "Your monthly plan usage limit has been reached.", status: 429 };
    }

    const reservation = await prisma.tokenUsage.create({
      data: {
        userId,
        modelUsed: model,
        promptTokens: estimatedPromptTokens,
        completionTokens: 0,
        totalTokens: estimatedTotalTokens,
        source,
        apiKeyId,
      },
    });

    return { reservation };
  });
}

export function finalizeUsageReservation({ reservationId, promptTokens, completionTokens, model, reasoningEffort }) {
  const totalTokens = (promptTokens + completionTokens) * modelMultiplier(model) * reasoningMultiplier(reasoningEffort);
  return prisma.tokenUsage.update({
    where: { id: reservationId },
    data: { promptTokens, completionTokens, totalTokens },
  });
}

export async function cancelUsageReservation(reservationId) {
  if (!reservationId) return;
  await prisma.tokenUsage.delete({ where: { id: reservationId } }).catch(() => {});
}
