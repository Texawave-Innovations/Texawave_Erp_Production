-- AlterTable
ALTER TABLE "crm"."leads" ADD COLUMN     "linked_opportunity_id" INTEGER;

-- CreateTable
CREATE TABLE "crm"."pipeline_stages" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "probability" INTEGER,
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "is_on_hold" BOOLEAN NOT NULL DEFAULT false,
    "sla_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."opportunities" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "account_id" INTEGER NOT NULL,
    "contact_id" INTEGER,
    "lead_id" INTEGER,
    "opportunity_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimated_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT DEFAULT 'INR',
    "expected_close_date" TIMESTAMP(3),
    "probability" INTEGER,
    "priority" TEXT,
    "next_action" TEXT,
    "next_action_date" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lost_reason" TEXT,
    "lost_reason_other" TEXT,
    "lost_at" TIMESTAMP(3),
    "competitor" TEXT,
    "hold_reason" TEXT,
    "hold_reason_other" TEXT,
    "expected_resume_date" TIMESTAMP(3),
    "hold_notes" TEXT,
    "on_hold_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "stuck_reason" TEXT,
    "stuck_reason_other" TEXT,
    "contact_role" TEXT,
    "campaign_source" TEXT,
    "closing_amount" DECIMAL(14,2),
    "closing_date" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "custom_fields" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."opportunity_stage_history" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "from_stage_id" INTEGER,
    "to_stage_id" INTEGER NOT NULL,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_stages_organization_id_idx" ON "crm"."pipeline_stages"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_organization_id_code_key" ON "crm"."pipeline_stages"("organization_id", "code");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_idx" ON "crm"."opportunities"("organization_id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_team_id_idx" ON "crm"."opportunities"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "opportunities_account_id_idx" ON "crm"."opportunities"("account_id");

-- CreateIndex
CREATE INDEX "opportunities_contact_id_idx" ON "crm"."opportunities"("contact_id");

-- CreateIndex
CREATE INDEX "opportunities_lead_id_idx" ON "crm"."opportunities"("lead_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_id_idx" ON "crm"."opportunities"("stage_id");

-- CreateIndex
CREATE INDEX "opportunity_stage_history_organization_id_idx" ON "crm"."opportunity_stage_history"("organization_id");

-- CreateIndex
CREATE INDEX "opportunity_stage_history_opportunity_id_idx" ON "crm"."opportunity_stage_history"("opportunity_id");

-- CreateIndex
CREATE INDEX "leads_linked_opportunity_id_idx" ON "crm"."leads"("linked_opportunity_id");

-- AddForeignKey
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_linked_opportunity_id_fkey" FOREIGN KEY ("linked_opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm"."pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "crm"."pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "crm"."pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Append-only enforcement for opportunity_stage_history, same mechanism as
-- audit_logs/employee_status_history (prevent_row_mutation() was moved to
-- the "platform" schema by 20261001120154_split_platform_hr_schemas).
-- Legacy's own comment: the opportunity's current stage "is only ever a
-- pointer... the full history lives in" this table — it must never be
-- editable after the fact.
CREATE TRIGGER "opportunity_stage_history_no_update_delete"
  BEFORE UPDATE OR DELETE ON "crm"."opportunity_stage_history"
  FOR EACH ROW EXECUTE FUNCTION "platform"."prevent_row_mutation"();

CREATE TRIGGER "opportunity_stage_history_no_truncate"
  BEFORE TRUNCATE ON "crm"."opportunity_stage_history"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform"."prevent_row_mutation"();
