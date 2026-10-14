-- Leave workflow: one- or two-level approval, HR cancellation (who cancelled),
-- approval delegations. Generated changes first, then rules Prisma cannot express.

-- AlterTable
ALTER TABLE "hr"."leave_types" ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "hr"."leave_requests" ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "cancelled_by" INTEGER,
ADD COLUMN     "first_decided_at" TIMESTAMPTZ(6),
ADD COLUMN     "first_decided_by" INTEGER,
ADD COLUMN     "first_decision_note" TEXT;

-- CreateTable
CREATE TABLE "hr"."leave_approval_delegations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "delegator_user_id" INTEGER NOT NULL,
    "delegate_user_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_approval_delegations_organization_id_delegate_user_id_idx" ON "hr"."leave_approval_delegations"("organization_id", "delegate_user_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_approval_delegations_organization_id_delegator_user_i_idx" ON "hr"."leave_approval_delegations"("organization_id", "delegator_user_id");

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_first_decided_by_fkey" FOREIGN KEY ("first_decided_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_delegator_user_id_fkey" FOREIGN KEY ("delegator_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_delegate_user_id_fkey" FOREIGN KEY ("delegate_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_approval_levels_check"
  CHECK ("approval_levels" IN (1, 2));

ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_approval_levels_check"
  CHECK ("approval_levels" IN (1, 2));

-- The first approval exists only on two-level requests, and is recorded as a
-- whole (the decider column alone may later be nulled by ON DELETE SET NULL).
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_first_decision_check"
  CHECK (
       ("first_decided_at" IS NULL AND "first_decided_by" IS NULL AND "first_decision_note" IS NULL)
    OR ("first_decided_at" IS NOT NULL AND "approval_levels" = 2)
  );

-- Two-level approval means two different people.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_two_approvers_check"
  CHECK ("first_decided_by" IS NULL OR "decided_by" IS NULL OR "first_decided_by" <> "decided_by");

ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_not_self_check"
  CHECK ("delegator_user_id" <> "delegate_user_id");

ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_range_check"
  CHECK ("end_date" >= "start_date");

ALTER TABLE "hr"."leave_approval_delegations" ADD CONSTRAINT "leave_approval_delegations_reason_check"
  CHECK ("reason" IS NULL OR btrim("reason") <> '');

-- Immutability (20261006100000), extended: `approval_levels` is fixed at
-- submission and may change only when a REJECTED/CANCELLED request is
-- resubmitted (it is copied from the leave type again). Everything else is
-- unchanged from the previous version of this function.
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

  IF NEW."approval_levels" IS DISTINCT FROM OLD."approval_levels"
     AND NOT (OLD."status" IN ('REJECTED', 'CANCELLED') AND NEW."status" = 'PENDING') THEN
    RAISE EXCEPTION 'leave_requests: approval levels change only on resubmission'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- A status that is not PENDING may move only along the lifecycle edges.
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
