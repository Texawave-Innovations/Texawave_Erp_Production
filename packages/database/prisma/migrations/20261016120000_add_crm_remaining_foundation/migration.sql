-- CreateTable
CREATE TABLE "crm"."crm_mining_rows" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "serial_no" TEXT,
    "mined_date" TEXT,
    "domain" TEXT,
    "company_name" TEXT NOT NULL,
    "hq" TEXT,
    "website" TEXT,
    "key_decision_makers" TEXT,
    "title" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "email_status" TEXT,
    "follow_up_status" TEXT,
    "industry" TEXT,
    "number_of_employees" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "linkedin_profile" TEXT,
    "assigned_to" TEXT,
    "priority" TEXT,
    "next_follow_up_date" TEXT,
    "notes" TEXT,
    "promoted_to_lead_id" INTEGER,
    "custom_fields" JSONB,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_mining_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_quotas" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "rep_name" TEXT NOT NULL,
    "team" TEXT,
    "manager_name" TEXT,
    "target_owner" TEXT,
    "period" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "target_amount" DECIMAL(16,2) NOT NULL,
    "metric" TEXT NOT NULL DEFAULT 'closedWonValue',
    "currency" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_notifications" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "account_id" INTEGER,
    "company_name" TEXT,
    "prospect_name" TEXT,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "snooze_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_custom_field_defs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source_header" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_custom_field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_mining_rows_organization_id_idx" ON "crm"."crm_mining_rows"("organization_id");

-- CreateIndex
CREATE INDEX "crm_quotas_organization_id_idx" ON "crm"."crm_quotas"("organization_id");

-- CreateIndex
CREATE INDEX "crm_quotas_organization_id_period_key_idx" ON "crm"."crm_quotas"("organization_id", "period_key");

-- CreateIndex
CREATE INDEX "crm_notifications_organization_id_status_idx" ON "crm"."crm_notifications"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_notifications_dedupe_key" ON "crm"."crm_notifications"("organization_id", "source_type", "source_id", "type", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_field_defs_org_module_key" ON "crm"."crm_custom_field_defs"("organization_id", "module", "key");

-- AddForeignKey
ALTER TABLE "crm"."crm_mining_rows" ADD CONSTRAINT "crm_mining_rows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_quotas" ADD CONSTRAINT "crm_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_notifications" ADD CONSTRAINT "crm_notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_custom_field_defs" ADD CONSTRAINT "crm_custom_field_defs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
