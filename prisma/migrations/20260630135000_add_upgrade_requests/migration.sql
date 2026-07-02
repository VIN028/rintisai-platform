-- CreateTable
CREATE TABLE IF NOT EXISTS "UpgradeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpgradeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
