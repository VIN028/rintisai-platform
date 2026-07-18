-- AlterTable
ALTER TABLE "TokenUsage" ADD COLUMN     "packageId" TEXT;

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "sourceRequestId" TEXT,
    "limitUnits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanEntitlement_userId_family_startsAt_expiresAt_idx" ON "PlanEntitlement"("userId", "family", "startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PlanEntitlement_sourceRequestId_idx" ON "PlanEntitlement"("sourceRequestId");

-- CreateIndex
CREATE INDEX "ApiCreditLedger_userId_createdAt_idx" ON "ApiCreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "TokenUsage_userId_timestamp_idx" ON "TokenUsage"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "TokenUsage_modelUsed_idx" ON "TokenUsage"("modelUsed");

-- CreateIndex
CREATE INDEX "TokenUsage_packageId_timestamp_idx" ON "TokenUsage"("packageId", "timestamp");

-- CreateIndex
CREATE INDEX "UpgradeRequest_userId_status_idx" ON "UpgradeRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
