-- AlterTable
ALTER TABLE "scm"."products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "barcode_created_at" TIMESTAMP(3),
ADD COLUMN     "warehouse_id" INTEGER,
ADD COLUMN     "bin_location_id" INTEGER,
ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "expiry_not_applicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_barcode_key" ON "scm"."products"("organization_id", "barcode");

-- AddForeignKey
ALTER TABLE "scm"."products" ADD CONSTRAINT "products_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."products" ADD CONSTRAINT "products_bin_location_id_fkey" FOREIGN KEY ("bin_location_id") REFERENCES "scm"."warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
