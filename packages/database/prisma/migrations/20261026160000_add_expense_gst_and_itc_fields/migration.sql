-- AlterTable
ALTER TABLE "finance"."expenses"
ADD COLUMN "vendor_gstin" TEXT,
ADD COLUMN "vendor_invoice_number" TEXT,
ADD COLUMN "vendor_invoice_date" DATE,
ADD COLUMN "hsn_sac_code" TEXT,
ADD COLUMN "tax_rate" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "is_itc_eligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ineligibility_reason" TEXT,
ADD COLUMN "gst_jurisdiction" TEXT;

-- CreateIndex
CREATE INDEX "expenses_organization_id_vendor_gstin_idx" ON "finance"."expenses"("organization_id", "vendor_gstin");

