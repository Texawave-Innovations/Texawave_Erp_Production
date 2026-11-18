-- Timesheet review: two approval levels, the same shape as hr.leave_requests.
-- A day is approved first by the reporting manager (or team approver) and then by
-- HR (approval_levels = 2); an employee with no reporting manager goes to HR alone
-- (approval_levels = 1). The status stays SUBMITTED between the two decisions, so
-- the existing status CHECK and the submitted-row immutability triggers are
-- unchanged. Additive only: existing rows get approval_levels = 1 and no first
-- decision.

ALTER TABLE "hr"."timesheets"
  ADD COLUMN "approval_levels" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "first_decided_by" INTEGER,
  ADD COLUMN "first_decided_at" TIMESTAMPTZ(6),
  ADD COLUMN "first_decision_note" TEXT;

ALTER TABLE "hr"."timesheets"
  ADD CONSTRAINT "timesheets_approval_levels_check"
    CHECK ("approval_levels" IN (1, 2)),
  -- A first decision is both who and when, and exists only on a two-level day.
  ADD CONSTRAINT "timesheets_first_decision_check"
    CHECK (
      ("first_decided_by" IS NULL) = ("first_decided_at" IS NULL)
      AND ("first_decided_at" IS NULL OR "approval_levels" = 2)
    );
