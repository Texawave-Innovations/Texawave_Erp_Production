-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateTable
CREATE TABLE "sales"."company_details" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "logo_data_uri" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."bank_accounts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "branch_name" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."authorized_signatories" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT,
    "designation" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "authorized_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."salespersons" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "commission_percent" DECIMAL(5,2),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."seal_signatures" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "signatory_name" TEXT,
    "designation" TEXT,
    "image_data_uri" TEXT NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "seal_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."sales_master_list_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numeric_value" DECIMAL(10,4),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sales_master_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_details_organization_id_key" ON "sales"."company_details"("organization_id");

-- CreateIndex
CREATE INDEX "bank_accounts_organization_id_idx" ON "sales"."bank_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_signatories_organization_id_key" ON "sales"."authorized_signatories"("organization_id");

-- CreateIndex
CREATE INDEX "salespersons_organization_id_idx" ON "sales"."salespersons"("organization_id");

-- CreateIndex
CREATE INDEX "seal_signatures_organization_id_kind_idx" ON "sales"."seal_signatures"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "sales_master_list_items_organization_id_category_idx" ON "sales"."sales_master_list_items"("organization_id", "category");

-- AddForeignKey
ALTER TABLE "sales"."company_details" ADD CONSTRAINT "company_details_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."authorized_signatories" ADD CONSTRAINT "authorized_signatories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."salespersons" ADD CONSTRAINT "salespersons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."seal_signatures" ADD CONSTRAINT "seal_signatures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sales_master_list_items" ADD CONSTRAINT "sales_master_list_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
