CREATE TABLE IF NOT EXISTS "CashoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountUsdMicros" INTEGER NOT NULL,
    "amountRp" INTEGER NOT NULL,
    "feeRp" INTEGER NOT NULL DEFAULT 0,
    "payoutAmountRp" INTEGER NOT NULL DEFAULT 0,
    "fxRate" INTEGER NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "payoutRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "adminActionBy" TEXT,
    "adminActionAt" DATETIME,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CashoutRequest_userId_status_idx" ON "CashoutRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "CashoutRequest_status_createdAt_idx" ON "CashoutRequest"("status", "createdAt");
