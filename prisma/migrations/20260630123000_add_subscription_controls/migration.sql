-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "apiAccessEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "customLimit5h" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "customLimitWeekly" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "customLimitMonthly" INTEGER;

-- Existing trial records are kept usable as starter-level inactive accounts until admin activates them.
UPDATE "Subscription" SET "plan" = 'starter' WHERE "plan" = 'trial';
