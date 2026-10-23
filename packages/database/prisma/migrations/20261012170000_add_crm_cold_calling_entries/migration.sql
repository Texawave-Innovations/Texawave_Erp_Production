-- CreateTable
CREATE TABLE "crm"."crm_cold_calling_entries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "serial_no" TEXT,
    "call_date" TIMESTAMPTZ(6),
    "company_name" TEXT NOT NULL,
    "prospect_name" TEXT,
    "designation" TEXT,
    "status" TEXT,
    "linked_account_id" INTEGER,
    "disposition_tag" TEXT,
    "disposition_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_cold_calling_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_cold_calling_entries_organization_id_idx" ON "crm"."crm_cold_calling_entries"("organization_id");

-- CreateIndex
CREATE INDEX "crm_cold_calling_entries_org_linked_account_idx" ON "crm"."crm_cold_calling_entries"("organization_id", "linked_account_id");

-- AddForeignKey
ALTER TABLE "crm"."crm_cold_calling_entries" ADD CONSTRAINT "crm_cold_calling_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_cold_calling_entries" ADD CONSTRAINT "crm_cold_calling_entries_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "crm"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
