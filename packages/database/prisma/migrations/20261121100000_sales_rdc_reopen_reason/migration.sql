-- A returned RDC is reopened with a mandatory reason; kept on the row (and in the audit log).
-- AlterTable
ALTER TABLE "sales"."returnable_delivery_challans" ADD COLUMN     "reopen_reason" VARCHAR(500);
