-- Sales: quotations, proforma/tax invoices (with payments), delivery
-- challans, the Sales company profile, and per-financial-year document
-- number formats in the Sales master list. Generated changes first, then
-- rules Prisma cannot express.

-- AlterTable
ALTER TABLE "sales"."code_formats" ALTER COLUMN "prefix" SET DATA TYPE VARCHAR(20);

-- CreateTable
CREATE TABLE "sales"."company_profiles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "tagline" VARCHAR(200),
    "address" TEXT NOT NULL,
    "gstin" VARCHAR(15),
    "state_code" VARCHAR(2) NOT NULL,
    "pan" VARCHAR(10),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."quotations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "quotation_number" VARCHAR(40) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "quotation_date" DATE NOT NULL,
    "validity" VARCHAR(50),
    "delivery_terms" VARCHAR(200),
    "supplier_state_code" VARCHAR(2) NOT NULL,
    "place_of_supply" VARCHAR(2) NOT NULL,
    "tax_mode" TEXT NOT NULL,
    "transport_description" VARCHAR(200),
    "transport_charge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transport_hsn" VARCHAR(8),
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "items_subtotal" DECIMAL(14,2) NOT NULL,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "cgst_amount" DECIMAL(14,2) NOT NULL,
    "sgst_amount" DECIMAL(14,2) NOT NULL,
    "igst_amount" DECIMAL(14,2) NOT NULL,
    "round_off" DECIMAL(6,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "bank_details" JSONB,
    "seal_name" VARCHAR(150),
    "signature_name" VARCHAR(150),
    "prepared_by" VARCHAR(150),
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "converted_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."quotation_lines" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "hsn_code" VARCHAR(8),
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."invoices" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "invoice_type" TEXT NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "payment_terms" VARCHAR(50),
    "source_quotation_id" INTEGER,
    "source_invoice_id" INTEGER,
    "supplier_state_code" VARCHAR(2) NOT NULL,
    "place_of_supply" VARCHAR(2) NOT NULL,
    "tax_mode" TEXT NOT NULL,
    "transport_description" VARCHAR(200),
    "transport_charge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transport_hsn" VARCHAR(8),
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "items_subtotal" DECIMAL(14,2) NOT NULL,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "cgst_amount" DECIMAL(14,2) NOT NULL,
    "sgst_amount" DECIMAL(14,2) NOT NULL,
    "igst_amount" DECIMAL(14,2) NOT NULL,
    "round_off" DECIMAL(6,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "amount_received" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bank_details" JSONB,
    "seal_name" VARCHAR(150),
    "signature_name" VARCHAR(150),
    "prepared_by" VARCHAR(150),
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "converted_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."invoice_lines" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "hsn_code" VARCHAR(8),
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."invoice_payments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" TEXT NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."delivery_challans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "dc_number" VARCHAR(40) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "dc_date" DATE NOT NULL,
    "source_invoice_id" INTEGER,
    "seal_name" VARCHAR(150),
    "signature_name" VARCHAR(150),
    "prepared_by" VARCHAR(150),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."delivery_challan_lines" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "delivery_challan_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "hsn_code" VARCHAR(8),
    "quantity" DECIMAL(12,3) NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_challan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_organization_id_key" ON "sales"."company_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "quotations_organization_id_quotation_date_idx" ON "sales"."quotations"("organization_id", "quotation_date");

-- CreateIndex
CREATE INDEX "quotations_organization_id_customer_id_idx" ON "sales"."quotations"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organization_id_quotation_number_key" ON "sales"."quotations"("organization_id", "quotation_number");

-- CreateIndex
CREATE INDEX "quotation_lines_organization_id_quotation_id_idx" ON "sales"."quotation_lines"("organization_id", "quotation_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_invoice_type_invoice_date_idx" ON "sales"."invoices"("organization_id", "invoice_type", "invoice_date");

-- CreateIndex
CREATE INDEX "invoices_organization_id_customer_id_idx" ON "sales"."invoices"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "sales"."invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_organization_id_invoice_id_idx" ON "sales"."invoice_lines"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_organization_id_invoice_id_idx" ON "sales"."invoice_payments"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_organization_id_payment_date_idx" ON "sales"."invoice_payments"("organization_id", "payment_date");

-- CreateIndex
CREATE INDEX "delivery_challans_organization_id_dc_date_idx" ON "sales"."delivery_challans"("organization_id", "dc_date");

-- CreateIndex
CREATE INDEX "delivery_challans_organization_id_customer_id_idx" ON "sales"."delivery_challans"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_challans_organization_id_dc_number_key" ON "sales"."delivery_challans"("organization_id", "dc_number");

-- CreateIndex
CREATE INDEX "delivery_challan_lines_organization_id_delivery_challan_id_idx" ON "sales"."delivery_challan_lines"("organization_id", "delivery_challan_id");

-- AddForeignKey
ALTER TABLE "sales"."company_profiles" ADD CONSTRAINT "company_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_lines" ADD CONSTRAINT "quotation_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_source_quotation_id_fkey" FOREIGN KEY ("source_quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoice_lines" ADD CONSTRAINT "invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_delivery_challan_id_fkey" FOREIGN KEY ("delivery_challan_id") REFERENCES "sales"."delivery_challans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;




-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express. The API enforces the same rules first; these
-- are the backstop if a bug or a manual write gets past it.
-- ---------------------------------------------------------------------------

-- Code formats: document number types, and prefixes such as TW/QUO.
ALTER TABLE "sales"."code_formats" DROP CONSTRAINT "code_formats_code_type_check";
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_code_type_check"
  CHECK ("code_type" IN ('customer', 'quotation', 'proforma_invoice', 'tax_invoice', 'delivery_challan'));
ALTER TABLE "sales"."code_formats" DROP CONSTRAINT "code_formats_prefix_check";
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_prefix_check"
  CHECK ("prefix" ~ '^[A-Z][A-Z0-9]*(/[A-Z0-9]+)*$'
     AND ("code_type" <> 'customer' OR "prefix" ~ '^[A-Z][A-Z0-9]{0,9}$'));

ALTER TABLE "sales"."company_profiles" ADD CONSTRAINT "company_profiles_gstin_format_check"
  CHECK ("gstin" IS NULL OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$');
ALTER TABLE "sales"."company_profiles" ADD CONSTRAINT "company_profiles_state_code_check"
  CHECK ("state_code" ~ '^[0-9]{2}$');
ALTER TABLE "sales"."company_profiles" ADD CONSTRAINT "company_profiles_pan_format_check"
  CHECK ("pan" IS NULL OR "pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');

-- Quotations
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_status_check"
  CHECK ("status" IN ('OPEN', 'CONVERTED'));
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_converted_pair_check"
  CHECK (("status" = 'CONVERTED') = ("converted_at" IS NOT NULL));
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_tax_mode_check"
  CHECK (("tax_mode" = 'INTRA' AND "igst_rate" = 0 AND "igst_amount" = 0)
      OR ("tax_mode" = 'INTER' AND "cgst_rate" = 0 AND "sgst_rate" = 0
          AND "cgst_amount" = 0 AND "sgst_amount" = 0));
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_state_codes_check"
  CHECK ("supplier_state_code" ~ '^[0-9]{2}$' AND "place_of_supply" ~ '^[0-9]{2}$');
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_rates_check"
  CHECK ("cgst_rate" BETWEEN 0 AND 100 AND "sgst_rate" BETWEEN 0 AND 100
     AND "igst_rate" BETWEEN 0 AND 100);
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_amounts_check"
  CHECK ("transport_charge" >= 0 AND "items_subtotal" >= 0
     AND "taxable_amount" = "items_subtotal" + "transport_charge"
     AND "cgst_amount" >= 0 AND "sgst_amount" >= 0 AND "igst_amount" >= 0
     AND "total_amount" >= 0
     AND "total_amount" = "taxable_amount" + "cgst_amount" + "sgst_amount" + "igst_amount" + "round_off");

ALTER TABLE "sales"."quotation_lines" ADD CONSTRAINT "quotation_lines_values_check"
  CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "amount" >= 0 AND "line_no" >= 1);

-- Invoices
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_invoice_type_check"
  CHECK ("invoice_type" IN ('PROFORMA', 'TAX'));
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_status_check"
  CHECK ("status" IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CONVERTED')
     AND ("status" <> 'CONVERTED' OR "invoice_type" = 'PROFORMA'));
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_converted_pair_check"
  CHECK (("status" = 'CONVERTED') = ("converted_at" IS NOT NULL));
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_source_invoice_check"
  CHECK ("source_invoice_id" IS NULL OR "invoice_type" = 'TAX');
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_tax_mode_check"
  CHECK (("tax_mode" = 'INTRA' AND "igst_rate" = 0 AND "igst_amount" = 0)
      OR ("tax_mode" = 'INTER' AND "cgst_rate" = 0 AND "sgst_rate" = 0
          AND "cgst_amount" = 0 AND "sgst_amount" = 0));
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_state_codes_check"
  CHECK ("supplier_state_code" ~ '^[0-9]{2}$' AND "place_of_supply" ~ '^[0-9]{2}$');
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_rates_check"
  CHECK ("cgst_rate" BETWEEN 0 AND 100 AND "sgst_rate" BETWEEN 0 AND 100
     AND "igst_rate" BETWEEN 0 AND 100);
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_amounts_check"
  CHECK ("transport_charge" >= 0 AND "items_subtotal" >= 0
     AND "taxable_amount" = "items_subtotal" + "transport_charge"
     AND "cgst_amount" >= 0 AND "sgst_amount" >= 0 AND "igst_amount" >= 0
     AND "total_amount" >= 0
     AND "total_amount" = "taxable_amount" + "cgst_amount" + "sgst_amount" + "igst_amount" + "round_off");
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_amount_received_check"
  CHECK ("amount_received" >= 0 AND "amount_received" <= "total_amount");
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_due_date_check"
  CHECK ("due_date" IS NULL OR "due_date" >= "invoice_date");

ALTER TABLE "sales"."invoice_lines" ADD CONSTRAINT "invoice_lines_values_check"
  CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "amount" >= 0 AND "line_no" >= 1);

ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_amount_check"
  CHECK ("amount" > 0);
ALTER TABLE "sales"."invoice_payments" ADD CONSTRAINT "invoice_payments_mode_check"
  CHECK ("mode" IN ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'));

-- Delivery challans
ALTER TABLE "sales"."delivery_challans" ADD CONSTRAINT "delivery_challans_status_check"
  CHECK ("status" IN ('DRAFT', 'DISPATCHED'));

ALTER TABLE "sales"."delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_values_check"
  CHECK ("quantity" > 0 AND "line_no" >= 1);
