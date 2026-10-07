-- AlterTable
ALTER TABLE "hr"."employee_salaries" ADD COLUMN     "arrears_paid_period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "hr"."employee_salaries" ADD CONSTRAINT "employee_salaries_arrears_paid_period_id_fkey" FOREIGN KEY ("arrears_paid_period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
