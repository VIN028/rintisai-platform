-- AlterTable
ALTER TABLE "TokenUsage" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "TokenUsage" ADD COLUMN "apiKeyId" TEXT;
