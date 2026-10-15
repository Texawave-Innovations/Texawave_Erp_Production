-- CreateTable
CREATE TABLE "crm"."leads" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "company_name" TEXT NOT NULL,
    "domain" TEXT,
    "hq" TEXT,
    "industry" TEXT,
    "annual_revenue" TEXT,
    "number_of_employees" TEXT,
    "prospect_name" TEXT NOT NULL,
    "title" TEXT,
    "contact_number" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "skype_id" TEXT,
    "meeting_status" TEXT,
    "meeting_scheduled" TEXT,
    "meeting_date" TIMESTAMP(3),
    "lead_status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT,
    "assigned_to" TEXT,
    "lead_source" TEXT,
    "email_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "data_processing_basis" TEXT,
    "address_street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "tags" TEXT,
    "area_of_interest" TEXT,
    "comments" TEXT,
    "linked_account_id" INTEGER,
    "linked_contact_id" INTEGER,
    "custom_fields" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_organization_id_idx" ON "crm"."leads"("organization_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_team_id_idx" ON "crm"."leads"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "leads_linked_account_id_idx" ON "crm"."leads"("linked_account_id");

-- CreateIndex
CREATE INDEX "leads_linked_contact_id_idx" ON "crm"."leads"("linked_contact_id");

-- AddForeignKey
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "crm"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_linked_contact_id_fkey" FOREIGN KEY ("linked_contact_id") REFERENCES "crm"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

