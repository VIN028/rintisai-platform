-- AlterTable
ALTER TABLE "UpgradeRequest" ADD COLUMN "paymentProof" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
