-- Sales: Payments Received (numbered payments, payment mode from the master
-- list, due date) and Returnable Delivery Challans. Existing payments are
-- numbered in date order per financial year, and their mode codes become
-- labels. Generated changes, then rules Prisma cannot express.

-- Payments: number, due date, master-list mode.
ALTER TABLE "sales"."invoice_payments" ADD COLUMN "due_date" DATE,
ADD COLUMN "mode_item_id" INTEGER,
ADD COLUMN "payment_number" VARCHAR(40);

ALTER TABLE "sales"."invoice_payments" DROP CONSTRAINT "invoice_payments_mode_check";
UPDATE "sales"."invoice_payments" SET "mode" = CASE "mode"
  WHEN 'CASH' THEN 'Cash'
  WHEN 'BANK_TRANSFER' THEN 'Bank Transfer'
  WHEN 'UPI' THEN 'UPI'
  WHEN 'CHEQUE' THEN 'Cheque'
  WHEN 'CARD' THEN 'Card'
  ELSE 'Other' END;
ALTER TABLE "sales"."invoice_payments" ALTER COLUMN "mode" SET DATA TYPE VARCHAR(50);

-- Number existing payments TW/PR/<FY>/NNNN (deleted ones too — numbers are
-- never reused), then start each year's counter after them.
WITH fy AS (
  SELECT "id", "organization_id", "payment_date",
         CASE WHEN extract(month FROM "payment_date") >= 4
              THEN extract(year FROM "payment_date")::int
              ELSE extract(year FROM "payment_date")::int - 1 END AS start_year
    FROM "sales"."invoice_payments"
), numbered AS (
  SELECT "id", "organization_id",
         lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0') AS label,
         row_number() OVER (PARTITION BY "organization_id", start_year ORDER BY "payment_date", "id") AS n
    FROM fy
)
UPDATE "sales"."invoice_payments" p
   SET "payment_number" = 'TW/PR/' || numbered.label || '/' || lpad(numbered.n::text, 4, '0')
  FROM numbered
 WHERE p."id" = numbered."id";

INSERT INTO "platform"."document_sequences"
  ("organization_id", "doc_type", "prefix", "padding", "next_number", "updated_at")
SELECT "organization_id", 'sales_payment_received_' || split_part("payment_number", '/', 3),
       'TW/PR', 4, max(split_part("payment_number", '/', 4)::int) + 1, now()
  FROM "sales"."invoice_payments"
 GROUP BY "organization_id", split_part("payment_number", '/', 3)
ON CONFLICT ("organization_id", "doc_type") DO NOTHING;

ALTER TABLE "sales"."invoice_payments" ALTER COLUMN "payment_number" SET NOT NULL;
CREATE UNIQUE INDEX "invoice_payments_organization_id_payment_number_key" ON "sales"."invoice_payments"("organization_id", "payment_number");
ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_mode_check"
  CHECK (length(btrim("mode")) > 0);

-- CreateTable
CREATE TABLE "sales"."returnable_delivery_challans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "rdc_number" VARCHAR(40) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "issue_date" DATE NOT NULL,
    "purpose" VARCHAR(200) NOT NULL,
    "expected_return_date" DATE NOT NULL,
    "taken_by" VARCHAR(150),
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "returned_date" DATE,
    "seal_name" VARCHAR(150),
    "signature_name" VARCHAR(150),
    "seal_item_id" INTEGER,
    "signature_item_id" INTEGER,
    "prepared_by" VARCHAR(150),
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "returnable_delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."returnable_delivery_challan_lines" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "returnable_dc_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "returnable_delivery_challan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returnable_delivery_challans_organization_id_issue_date_idx" ON "sales"."returnable_delivery_challans"("organization_id", "issue_date");

-- CreateIndex
CREATE INDEX "returnable_delivery_challans_organization_id_customer_id_idx" ON "sales"."returnable_delivery_challans"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "returnable_delivery_challans_organization_id_rdc_number_key" ON "sales"."returnable_delivery_challans"("organization_id", "rdc_number");

-- CreateIndex
CREATE INDEX "returnable_delivery_challan_lines_organization_id_returnabl_idx" ON "sales"."returnable_delivery_challan_lines"("organization_id", "returnable_dc_id");

-- AddForeignKey
ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_mode_item_id_fkey" FOREIGN KEY ("mode_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_seal_item_id_fkey" FOREIGN KEY ("seal_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_signature_item_id_fkey" FOREIGN KEY ("signature_item_id") REFERENCES "sales"."document_master_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challan_lines" ADD CONSTRAINT "returnable_delivery_challan_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."returnable_delivery_challan_lines" ADD CONSTRAINT "returnable_delivery_challan_lines_returnable_dc_id_fkey" FOREIGN KEY ("returnable_dc_id") REFERENCES "sales"."returnable_delivery_challans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Returnable delivery challans
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_status_check"
  CHECK ("status" IN ('ISSUED', 'RETURNED')
     AND (("status" = 'RETURNED') = ("returned_date" IS NOT NULL))
     AND ("returned_date" IS NULL OR "returned_date" >= "issue_date"));
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_dates_check"
  CHECK ("expected_return_date" >= "issue_date");
ALTER TABLE "sales"."returnable_delivery_challans" ADD CONSTRAINT "returnable_delivery_challans_purpose_check"
  CHECK (length(btrim("purpose")) > 0);
ALTER TABLE "sales"."returnable_delivery_challan_lines" ADD CONSTRAINT "returnable_delivery_challan_lines_values_check"
  CHECK ("quantity" > 0 AND "line_no" >= 1);

-- Code formats: the two new running numbers (TW/PR, TW/RDC).
ALTER TABLE "sales"."code_formats" DROP CONSTRAINT "code_formats_code_type_check";
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_code_type_check"
  CHECK ("code_type" IN ('customer', 'quotation', 'proforma_invoice', 'tax_invoice', 'delivery_challan', 'payment_received', 'returnable_dc'));

-- Master list: payment modes for Payments Received; seal, signature and
-- prepared-by for returnable DCs.
ALTER TABLE "sales"."document_master_items" DROP CONSTRAINT "document_master_items_field_check";
ALTER TABLE "sales"."document_master_items" ADD CONSTRAINT "document_master_items_field_check"
  CHECK (
    ("document_type" = 'QUOTATION' AND "field" IN ('VALIDITY', 'DELIVERY_TERMS', 'HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
 OR ("document_type" IN ('PROFORMA_INVOICE', 'TAX_INVOICE') AND "field" IN ('PAYMENT_TERMS', 'HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
 OR ("document_type" = 'DELIVERY_CHALLAN' AND "field" IN ('HSN_CODE', 'BANK_ACCOUNT', 'COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
 OR ("document_type" = 'PAYMENT_RECEIVED' AND "field" IN ('PAYMENT_MODE'))
 OR ("document_type" = 'RETURNABLE_DC' AND "field" IN ('COMPANY_SEAL', 'AUTHORIZED_SIGNATURE', 'PREPARED_BY'))
  );
