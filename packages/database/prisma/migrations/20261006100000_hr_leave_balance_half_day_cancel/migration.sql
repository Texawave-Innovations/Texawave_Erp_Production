-- Leave: balances, half-days, cancellation, resubmission.
-- Generated column/table changes first, then rules Prisma cannot express.

-- AlterTable
ALTER TABLE "hr"."leave_requests" ADD COLUMN     "cancellation_note" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(6),
ADD COLUMN     "day_portion" TEXT NOT NULL DEFAULT 'FULL',
ADD COLUMN     "leave_days" DECIMAL(4,1) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "hr"."leave_types" ADD COLUMN     "annual_entitlement" DECIMAL(5,1) NOT NULL DEFAULT 0,
ADD COLUMN     "carry_forward_limit" DECIMAL(5,1) NOT NULL DEFAULT 0,
ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "hr"."leave_entitlements" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "annual_entitlement" DECIMAL(5,1) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_entitlements_organization_id_employee_id_idx" ON "hr"."leave_entitlements"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entitlements_employee_id_leave_type_id_year_key" ON "hr"."leave_entitlements"("employee_id", "leave_type_id", "year");

-- AddForeignKey
ALTER TABLE "hr"."leave_entitlements" ADD CONSTRAINT "leave_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_entitlements" ADD CONSTRAINT "leave_entitlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_entitlements" ADD CONSTRAINT "leave_entitlements_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing requests were recorded as inclusive calendar days. Their working-day
-- consumption is set to the same value; no holiday/weekly-off data was applied.
-- The protect trigger forbids touching final rows; this backfill is a data
-- fix of an existing column, so the trigger is off for this one statement.
ALTER TABLE "hr"."leave_requests" DISABLE TRIGGER "leave_requests_protect";
UPDATE "hr"."leave_requests" SET "leave_days" = ("end_date" - "start_date" + 1);
ALTER TABLE "hr"."leave_requests" ENABLE TRIGGER "leave_requests_protect";

ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_entitlement_nonnegative"
  CHECK ("annual_entitlement" >= 0 AND "carry_forward_limit" >= 0);

ALTER TABLE "hr"."leave_entitlements" ADD CONSTRAINT "leave_entitlements_nonnegative"
  CHECK ("annual_entitlement" >= 0);

-- Replaces the original status check: CANCELLED is now a status.
ALTER TABLE "hr"."leave_requests" DROP CONSTRAINT "leave_requests_status_check";
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));

ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_day_portion_valid"
  CHECK ("day_portion" IN ('FULL', 'FIRST_HALF', 'SECOND_HALF'));

-- A half-day is a single date, so its range cannot span a second day.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_half_day_single_date"
  CHECK ("day_portion" = 'FULL' OR "start_date" = "end_date");

-- A decision is recorded for APPROVED and REJECTED only. A request cancelled
-- while PENDING has none; one cancelled after approval keeps its decision.
ALTER TABLE "hr"."leave_requests" DROP CONSTRAINT "leave_requests_decision_consistency_check";
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_decision_consistency_check"
  CHECK (
    (
         ("status" = 'PENDING' AND "decided_by" IS NULL AND "decided_at" IS NULL)
      OR ("status" IN ('APPROVED', 'REJECTED') AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
      OR ("status" = 'CANCELLED')
    )
    AND ("status" <> 'REJECTED' OR ("decision_note" IS NOT NULL AND btrim("decision_note") <> ''))
  );

ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_leave_days_nonnegative"
  CHECK ("leave_days" >= 0);

-- Overlap. The old rule forbade any shared day. Two different halves of one
-- date are legitimate, so the rule is split:
--  * FULL vs FULL (and FULL vs HALF, see note below) — full-day exclusion;
--  * two halves of the same portion on the same date.
-- A FULL row and a HALF row cannot be expressed in one exclusion constraint
-- (a predicate applies to both rows), so that cross case is enforced by the
-- service under a per-employee advisory lock. Documented in HR_LEAVE.md.
ALTER TABLE "hr"."leave_requests" DROP CONSTRAINT "leave_requests_employee_no_overlap";

ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employee_no_full_day_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED') AND "day_portion" = 'FULL');

ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employee_no_same_half_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    "day_portion" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED') AND "day_portion" <> 'FULL');

-- Immutability, extended for the new lifecycle. Submitted content never changes.
-- Allowed status moves:
--   PENDING   -> APPROVED | REJECTED | CANCELLED   (decision, or withdrawal)
--   APPROVED  -> CANCELLED                          (withdrawal before the start)
--   REJECTED  -> PENDING, CANCELLED -> PENDING      (resubmission)
-- A status that is not PENDING may not change otherwise (a final decision).
CREATE OR REPLACE FUNCTION "hr"."leave_requests_protect"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
     OR NEW."employee_id"     IS DISTINCT FROM OLD."employee_id"
     OR NEW."leave_type_id"   IS DISTINCT FROM OLD."leave_type_id"
     OR NEW."start_date"      IS DISTINCT FROM OLD."start_date"
     OR NEW."end_date"        IS DISTINCT FROM OLD."end_date"
     OR NEW."day_portion"     IS DISTINCT FROM OLD."day_portion"
     OR NEW."leave_days"      IS DISTINCT FROM OLD."leave_days"
     OR NEW."reason"          IS DISTINCT FROM OLD."reason"
     OR NEW."requested_by"    IS DISTINCT FROM OLD."requested_by" THEN
    RAISE EXCEPTION 'leave_requests: the submitted request cannot be edited'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- A status that is not PENDING may move only along the lifecycle edges above.
  IF NEW."status" = OLD."status" THEN
    IF OLD."status" <> 'PENDING' THEN
      RAISE EXCEPTION 'leave_requests: a % request is final and cannot be changed', OLD."status"
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF OLD."status" = 'PENDING' THEN
    IF NEW."status" NOT IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
      RAISE EXCEPTION 'leave_requests: % -> % is not an allowed transition', OLD."status", NEW."status"
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF NOT (
       (OLD."status" = 'APPROVED' AND NEW."status" = 'CANCELLED')
    OR (OLD."status" IN ('REJECTED', 'CANCELLED') AND NEW."status" = 'PENDING')
  ) THEN
    RAISE EXCEPTION 'leave_requests: a % request is final and cannot be changed', OLD."status"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
