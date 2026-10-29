-- Sales: customers (with billing/shipping addresses), the dashboard action
-- checklist and the Sales master list (code formats), in the new `sales`
-- schema. Generated changes first, then rules Prisma cannot express.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateTable
CREATE TABLE "sales"."customers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "customer_code" VARCHAR(30) NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "contact_person" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "mobile_country_code" VARCHAR(5) NOT NULL DEFAULT '+91',
    "mobile_number" VARCHAR(15) NOT NULL,
    "gstin" VARCHAR(15),
    "state_code" VARCHAR(2),
    "cgst_rate" DECIMAL(5,2),
    "sgst_rate" DECIMAL(5,2),
    "igst_rate" DECIMAL(5,2),
    "pan" VARCHAR(10),
    "cin" VARCHAR(21),
    "bank_name" VARCHAR(150),
    "bank_account_number_encrypted" TEXT,
    "bank_account_number_masked" VARCHAR(40),
    "bank_ifsc" VARCHAR(11),
    "bank_branch" VARCHAR(150),
    "payment_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."customer_addresses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "address_type" TEXT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "street" VARCHAR(500) NOT NULL,
    "area" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."action_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."code_formats" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code_type" VARCHAR(40) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 3,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "code_formats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_company_name_idx" ON "sales"."customers"("organization_id", "company_name");

-- CreateIndex
CREATE INDEX "customers_organization_id_gstin_idx" ON "sales"."customers"("organization_id", "gstin");

-- CreateIndex
CREATE INDEX "customers_organization_id_status_idx" ON "sales"."customers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "sales"."customers"("organization_id", "customer_code");

-- CreateIndex
CREATE INDEX "customer_addresses_organization_id_customer_id_idx" ON "sales"."customer_addresses"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "action_items_organization_id_completed_at_due_date_idx" ON "sales"."action_items"("organization_id", "completed_at", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "code_formats_organization_id_code_type_key" ON "sales"."code_formats"("organization_id", "code_type");

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customer_addresses" ADD CONSTRAINT "customer_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sales"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."action_items" ADD CONSTRAINT "action_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."action_items" ADD CONSTRAINT "action_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express. The API enforces the same rules first; these
-- are the backstop if a bug or a manual write gets past it.
-- ---------------------------------------------------------------------------

ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_status_check"
  CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_is_active_mirrors_status_check"
  CHECK ("is_active" = ("status" = 'ACTIVE'));
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_gstin_format_check"
  CHECK ("gstin" IS NULL OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$');
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_state_code_check"
  CHECK ("state_code" IS NULL OR "state_code" ~ '^[0-9]{2}$');
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_pan_format_check"
  CHECK ("pan" IS NULL OR "pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_tax_rates_check"
  CHECK (("cgst_rate" IS NULL OR "cgst_rate" BETWEEN 0 AND 100)
     AND ("sgst_rate" IS NULL OR "sgst_rate" BETWEEN 0 AND 100)
     AND ("igst_rate" IS NULL OR "igst_rate" BETWEEN 0 AND 100));
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_bank_account_pair_check"
  CHECK (("bank_account_number_encrypted" IS NULL) = ("bank_account_number_masked" IS NULL));
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_bank_ifsc_check"
  CHECK ("bank_ifsc" IS NULL OR "bank_ifsc" ~ '^[A-Z]{4}0[A-Z0-9]{6}$');
CREATE UNIQUE INDEX "customers_organization_id_gstin_live_key"
  ON "sales"."customers" ("organization_id", "gstin")
  WHERE "gstin" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "sales"."customer_addresses" ADD CONSTRAINT "customer_addresses_address_type_check"
  CHECK ("address_type" IN ('BILLING', 'SHIPPING'));
ALTER TABLE "sales"."customer_addresses" ADD CONSTRAINT "customer_addresses_state_code_check"
  CHECK ("state_code" ~ '^[0-9]{2}$');
CREATE UNIQUE INDEX "customer_addresses_one_default_key"
  ON "sales"."customer_addresses" ("customer_id", "address_type")
  WHERE "is_default" AND "deleted_at" IS NULL;

ALTER TABLE "sales"."action_items" ADD CONSTRAINT "action_items_completed_pair_check"
  CHECK (("completed_at" IS NULL) = ("completed_by" IS NULL));

ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_code_type_check"
  CHECK ("code_type" IN ('customer'));
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_prefix_check"
  CHECK ("prefix" ~ '^[A-Z][A-Z0-9]{0,9}$');
ALTER TABLE "sales"."code_formats" ADD CONSTRAINT "code_formats_padding_check"
  CHECK ("padding" BETWEEN 1 AND 8);
