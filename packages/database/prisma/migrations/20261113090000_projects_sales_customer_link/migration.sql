-- Projects pick their customer from Sales customers (sales.customers) instead of
-- CRM accounts. The legacy customer_id column is kept (no longer written) until
-- the backfill below has been reviewed; a follow-up change drops it.

-- AlterTable
ALTER TABLE "projects"."projects" ADD COLUMN "sales_customer_id" INTEGER;

-- CreateIndex
CREATE INDEX "projects_organization_id_sales_customer_id_idx" ON "projects"."projects"("organization_id", "sales_customer_id");

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_sales_customer_id_fkey" FOREIGN KEY ("sales_customer_id") REFERENCES "sales"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link each project to the live Sales customer whose company name
-- matches its CRM account name (case/whitespace-insensitive, same organization).
-- Projects with no match stay NULL and keep their stored customer_name.
UPDATE "projects"."projects" p
SET "sales_customer_id" = (
  SELECT MIN(c."id")
  FROM "sales"."customers" c
  JOIN "crm"."accounts" a ON a."id" = p."customer_id"
  WHERE c."organization_id" = p."organization_id"
    AND c."deleted_at" IS NULL
    AND lower(btrim(c."company_name")) = lower(btrim(a."name"))
)
WHERE p."customer_id" IS NOT NULL;
