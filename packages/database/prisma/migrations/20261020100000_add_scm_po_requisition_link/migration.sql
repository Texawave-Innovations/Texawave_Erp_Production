-- AlterTable
ALTER TABLE "scm"."purchase_orders" ADD COLUMN     "requisition_id" INTEGER,
ADD COLUMN     "requisition_number" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_requisition_id_idx" ON "scm"."purchase_orders"("requisition_id");

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "scm"."purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
