-- Sales master list: an option belongs to a field, not to one document type.
-- A bank account, seal or HSN code added once is offered on every document
-- whose form has that field (FIELDS_BY_DOCUMENT in
-- apps/api/src/modules/sales/master-list/document-fields.rules.ts).

DROP INDEX "sales"."document_master_items_one_default_key";
ALTER TABLE "sales"."document_master_items" DROP CONSTRAINT "document_master_items_field_check";

-- The same option entered for several document types collapses into one:
-- the copy with an image (else the oldest) stays and is the default when any
-- copy was. The others are soft-deleted; documents that chose them keep
-- printing them (deleted options still resolve).
WITH grouped AS (
  SELECT "id",
         FIRST_VALUE("id") OVER w AS "keep_id",
         BOOL_OR("is_default") OVER (
           PARTITION BY "organization_id", "field", "label",
                        COALESCE("value", ''), COALESCE("bank_details"::text, '')
         ) AS "any_default"
    FROM "sales"."document_master_items"
   WHERE "deleted_at" IS NULL
  WINDOW w AS (
    PARTITION BY "organization_id", "field", "label",
                 COALESCE("value", ''), COALESCE("bank_details"::text, '')
    ORDER BY ("image_storage_key" IS NULL), "id"
  )
)
UPDATE "sales"."document_master_items" AS i
   SET "is_default" = CASE WHEN g."id" = g."keep_id" THEN g."any_default" ELSE FALSE END,
       "deleted_at" = CASE WHEN g."id" = g."keep_id" THEN NULL ELSE NOW() END
  FROM grouped AS g
 WHERE i."id" = g."id";

-- One default per field: the first by sort order.
WITH defaults AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "organization_id", "field" ORDER BY "sort_order", "id"
         ) AS "rn"
    FROM "sales"."document_master_items"
   WHERE "is_default" AND "deleted_at" IS NULL
)
UPDATE "sales"."document_master_items" AS i
   SET "is_default" = FALSE
  FROM defaults AS d
 WHERE i."id" = d."id" AND d."rn" > 1;

-- DropIndex
DROP INDEX "sales"."document_master_items_organization_id_document_type_field_idx";

-- AlterTable
ALTER TABLE "sales"."document_master_items" DROP COLUMN "document_type";

-- CreateIndex
CREATE INDEX "document_master_items_organization_id_field_idx" ON "sales"."document_master_items"("organization_id", "field");

ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_field_check"
  CHECK ("field" IN ('VALIDITY', 'DELIVERY_TERMS', 'PAYMENT_TERMS', 'HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY', 'PAYMENT_MODE'));
CREATE UNIQUE INDEX "document_master_items_one_default_key"
  ON "sales"."document_master_items" ("organization_id", "field")
  WHERE "is_default" AND "deleted_at" IS NULL;
