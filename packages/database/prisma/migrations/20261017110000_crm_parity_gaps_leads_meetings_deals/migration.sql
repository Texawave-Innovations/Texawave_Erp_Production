-- Additive CRM parity gaps (leads rating/month/notes, meeting next step, deal forecast category).
ALTER TABLE "crm"."leads" ADD COLUMN "rating" TEXT;
ALTER TABLE "crm"."leads" ADD COLUMN "month" TEXT;
ALTER TABLE "crm"."crm_meetings" ADD COLUMN "next_step" TEXT;
ALTER TABLE "crm"."opportunities" ADD COLUMN "forecast_category" TEXT;

CREATE TABLE "crm"."crm_lead_notes" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "crm_lead_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_lead_notes_organization_id_lead_id_idx" ON "crm"."crm_lead_notes"("organization_id", "lead_id");
ALTER TABLE "crm"."crm_lead_notes" ADD CONSTRAINT "crm_lead_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm"."crm_lead_notes" ADD CONSTRAINT "crm_lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
