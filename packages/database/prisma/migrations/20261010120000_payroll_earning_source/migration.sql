-- Link each BONUS earning to the employee_bonuses row it pays, so finalize
-- marks exactly the bonuses the approved run paid (mirrors payroll_deductions).
-- AlterTable
ALTER TABLE "hr"."payroll_earnings" ADD COLUMN     "source_id" INTEGER,
ADD COLUMN     "source_type" TEXT;

-- CreateIndex
CREATE INDEX "payroll_earnings_source_type_source_id_idx" ON "hr"."payroll_earnings"("source_type", "source_id");
