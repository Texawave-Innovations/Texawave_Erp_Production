-- Loans: two-step approval (Docs/PAYROLL_AND_COMPLIANCE.md §3.7).
-- An employee (portal) or HR requests a loan → PENDING_HR; an HR reviewer
-- forwards it → PENDING_ADMIN or rejects it; a final approver (a different
-- person) approves it → ACTIVE or rejects it. Generated changes first, then
-- rules Prisma cannot express (with the data update inside them).

-- AlterTable
ALTER TABLE "hr"."employee_loans" ADD COLUMN     "hr_review_note" TEXT,
ADD COLUMN     "hr_reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN     "hr_reviewed_by_id" INTEGER,
ADD COLUMN     "requested_via" TEXT NOT NULL DEFAULT 'HR',
ALTER COLUMN "status" SET DEFAULT 'PENDING_HR';

-- AddForeignKey
ALTER TABLE "hr"."employee_loans" ADD CONSTRAINT "employee_loans_hr_reviewed_by_id_fkey" FOREIGN KEY ("hr_reviewed_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express
-- ---------------------------------------------------------------------------

ALTER TABLE "hr"."employee_loans" DROP CONSTRAINT "employee_loans_status_check";

-- Data (between the old and the new status check): loans awaiting the
-- previous single approval start at the HR review.
UPDATE "hr"."employee_loans" SET "status" = 'PENDING_HR' WHERE "status" = 'PENDING_APPROVAL';

ALTER TABLE "hr"."employee_loans"
  ADD CONSTRAINT "employee_loans_status_check"
  CHECK ("status" IN ('PENDING_HR', 'PENDING_ADMIN', 'ACTIVE', 'REJECTED', 'CLOSED', 'DEFAULTED', 'CANCELLED')),
  ADD CONSTRAINT "employee_loans_requested_via_check"
  CHECK ("requested_via" IN ('SELF', 'HR')),
  -- Maker-checker: the final approver is never the HR reviewer.
  ADD CONSTRAINT "employee_loans_distinct_approvers_check"
  CHECK ("hr_reviewed_by_id" IS NULL OR "approved_by_id" IS NULL
      OR "hr_reviewed_by_id" <> "approved_by_id");
