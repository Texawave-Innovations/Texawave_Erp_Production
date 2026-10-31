-- AlterTable
ALTER TABLE "finance"."payments_made" ADD COLUMN "supplier_id" INTEGER;

-- CreateIndex
CREATE INDEX "payments_made_organization_id_supplier_id_idx" ON "finance"."payments_made"("organization_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
