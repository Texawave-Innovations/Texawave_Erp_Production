-- AlterTable
ALTER TABLE "finance"."payments_made" ADD COLUMN "bill_id" INTEGER;

-- CreateIndex
CREATE INDEX "payments_made_organization_id_bill_id_idx" ON "finance"."payments_made"("organization_id", "bill_id");

-- AddForeignKey
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "scm"."supplier_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
