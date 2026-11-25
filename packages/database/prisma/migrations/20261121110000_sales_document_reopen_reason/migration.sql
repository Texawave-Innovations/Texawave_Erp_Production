-- A converted quotation / proforma is reopened with a mandatory reason; kept on the row (and in the audit log).
-- AlterTable
ALTER TABLE "sales"."quotations" ADD COLUMN     "reopen_reason" VARCHAR(500);

-- AlterTable
ALTER TABLE "sales"."invoices" ADD COLUMN     "reopen_reason" VARCHAR(500);
