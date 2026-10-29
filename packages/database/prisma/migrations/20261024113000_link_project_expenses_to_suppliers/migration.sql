-- AlterTable
ALTER TABLE "projects"."project_expenses" ADD COLUMN     "supplier_id" INTEGER;

-- CreateIndex
CREATE INDEX "project_expenses_organization_id_supplier_id_idx" ON "projects"."project_expenses"("organization_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "projects"."project_expenses" ADD CONSTRAINT "project_expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

