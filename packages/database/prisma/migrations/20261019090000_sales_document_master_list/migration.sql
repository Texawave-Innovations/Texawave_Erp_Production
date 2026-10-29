-- Sales document master list: per-document choices (validity, delivery and
-- payment terms, HSN codes, bank accounts, seals, signatures, prepared-by),
-- the company logo, and documents pointing at the seal/signature they print.
-- Generated changes first, then rules Prisma cannot express.

-- AlterTable
ALTER TABLE "sales"."company_profiles" ADD COLUMN     "logo_mime_type" VARCHAR(50),
ADD COLUMN     "logo_storage_key" VARCHAR(255);

-- AlterTable
ALTER TABLE "sales"."delivery_challans" ADD COLUMN     "seal_item_id" INTEGER,
ADD COLUMN     "signature_item_id" INTEGER;

-- AlterTable
ALTER TABLE "sales"."invoices" ADD COLUMN     "seal_item_id" INTEGER,
ADD COLUMN     "signature_item_id" INTEGER;

-- AlterTable
ALTER TABLE "sales"."quotations" ADD COLUMN     "seal_item_id" INTEGER,
ADD COLUMN     "signature_item_id" INTEGER;

-- CreateTable
CREATE TABLE "sales"."document_master_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "field" VARCHAR(30) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "value" VARCHAR(50),
    "bank_details" JSONB,
    "image_storage_key" VARCHAR(255),
    "image_mime_type" VARCHAR(50),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_master_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_master_items_organization_id_document_type_field_idx" ON "sales"."document_master_items"("organization_id", "document_type", "field");

-- AddForeignKey
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_seal_item_id_fkey" FOREIGN KEY ("seal_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_signature_item_id_fkey" FOREIGN KEY ("signature_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_seal_item_id_fkey" FOREIGN KEY ("seal_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_signature_item_id_fkey" FOREIGN KEY ("signature_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_seal_item_id_fkey" FOREIGN KEY ("seal_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_signature_item_id_fkey" FOREIGN KEY ("signature_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express. The API enforces the same rules first; these
-- are the backstop if a bug or a manual write gets past it.
-- ---------------------------------------------------------------------------

ALTER TABLE "sales"."company_profiles" ADD CONSTRAINT "company_profiles_logo_pair_check"
  CHECK (("logo_storage_key" IS NULL) = ("logo_mime_type" IS NULL));

-- Only the fields each document form has.
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_field_check"
  CHECK (
    ("document_type" = 'QUOTATION' AND "field" IN ('VALIDITY', 'DELIVERY_TERMS', 'HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
 OR ("document_type" IN ('PROFORMA_INVOICE', 'TAX_INVOICE') AND "field" IN ('PAYMENT_TERMS', 'HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
 OR ("document_type" = 'DELIVERY_CHALLAN' AND "field" IN ('HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
  );
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_value_check"
  CHECK ((("field" = 'HSN_CODE') = ("value" IS NOT NULL))
     AND ("value" IS NULL OR "value" ~ '^[0-9]{4,8}$'));
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_bank_check"
  CHECK (("field" = 'BANK_ACCOUNT') = ("bank_details" IS NOT NULL));
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_image_check"
  CHECK (("image_storage_key" IS NULL) = ("image_mime_type" IS NULL)
     AND ("image_storage_key" IS NULL OR "field" IN ('COMPANY_SEAL', 'AUTHORIZED_SIGNATURE')));
CREATE UNIQUE INDEX "document_master_items_one_default_key"
  ON "sales"."document_master_items" ("organization_id", "document_type", "field")
  WHERE "is_default" AND "deleted_at" IS NULL;
