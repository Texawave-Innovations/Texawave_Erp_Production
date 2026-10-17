-- Additive: legacy Account parity fields (location, priority, temperature).
ALTER TABLE "crm"."accounts" ADD COLUMN "hq" TEXT;
ALTER TABLE "crm"."accounts" ADD COLUMN "priority" TEXT;
ALTER TABLE "crm"."accounts" ADD COLUMN "temperature" TEXT;
