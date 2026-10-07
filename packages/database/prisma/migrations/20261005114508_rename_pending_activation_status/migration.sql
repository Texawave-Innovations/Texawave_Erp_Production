-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "onboarding_status" SET DEFAULT 'PENDING_ACTIVATION';


-- Backfill any rows already holding the old literal (none expected outside
-- local dev/test data, since the onboarding feature has no production rows yet).
UPDATE "employees" SET "onboarding_status" = 'PENDING_ACTIVATION' WHERE "onboarding_status" = 'PENDING_PASSWORD_CHANGE';
