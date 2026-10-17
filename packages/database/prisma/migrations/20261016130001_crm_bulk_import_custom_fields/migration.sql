-- Bulk import: custom columns stored on meetings and cold-calling rows.
ALTER TABLE "crm"."crm_meetings" ADD COLUMN "custom_fields" JSONB;
ALTER TABLE "crm"."crm_cold_calling_entries" ADD COLUMN "custom_fields" JSONB;
