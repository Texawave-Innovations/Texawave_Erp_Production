-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "scm";

-- CreateTable
CREATE TABLE "scm"."suppliers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "gstin" TEXT,
    "pan" TEXT,
    "contact_person" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "pincode" TEXT,
    "payment_terms" TEXT DEFAULT '30 Days',
    "credit_limit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "notes" TEXT,
    "custom_fields" JSONB,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_organization_id_status_idx" ON "scm"."suppliers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_supplier_code_key" ON "scm"."suppliers"("organization_id", "supplier_code");

-- AddForeignKey
ALTER TABLE "scm"."suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

