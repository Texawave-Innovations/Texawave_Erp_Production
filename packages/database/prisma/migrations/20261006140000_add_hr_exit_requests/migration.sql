-- CreateTable
CREATE TABLE "hr"."exit_requests" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reason" TEXT NOT NULL,
    "preferred_last_working_date" DATE NOT NULL,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "additional_notes" TEXT,
    "confirmed_last_working_date" DATE,
    "settlement_status" TEXT,
    "hr_note" TEXT,
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exit_requests_organization_id_employee_id_created_at_idx" ON "hr"."exit_requests"("organization_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "exit_requests_organization_id_status_idx" ON "hr"."exit_requests"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "hr"."exit_requests" ADD CONSTRAINT "exit_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."exit_requests" ADD CONSTRAINT "exit_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."exit_requests" ADD CONSTRAINT "exit_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."exit_requests" ADD CONSTRAINT "exit_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma cannot express.

-- Legacy statuses (ExitRequests.tsx / ExitRequest.tsx), upper-cased.
ALTER TABLE "hr"."exit_requests"
  ADD CONSTRAINT "exit_requests_status_check"
  CHECK ("status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'));

-- Legacy settlement options: "Pending | In Progress | Completed | On Hold".
ALTER TABLE "hr"."exit_requests"
  ADD CONSTRAINT "exit_requests_settlement_status_check"
  CHECK ("settlement_status" IS NULL OR "settlement_status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'));

-- Legacy notice period is a number input with min 0 (no maximum exists in legacy).
ALTER TABLE "hr"."exit_requests"
  ADD CONSTRAINT "exit_requests_notice_period_non_negative_check"
  CHECK ("notice_period_days" >= 0);

-- Legacy requires a reason (ExitRequest.tsx), so it must carry real text.
ALTER TABLE "hr"."exit_requests"
  ADD CONSTRAINT "exit_requests_reason_not_blank_check"
  CHECK (length(btrim("reason")) > 0);

-- Only an HR decision (APPROVED or REJECTED, and the COMPLETED that follows an
-- approval) records who decided and when. Pending requests record neither.
ALTER TABLE "hr"."exit_requests"
  ADD CONSTRAINT "exit_requests_decision_consistency_check"
  CHECK (
    ("status" IN ('SUBMITTED', 'UNDER_REVIEW') AND "decided_by" IS NULL AND "decided_at" IS NULL)
    OR ("status" IN ('APPROVED', 'REJECTED', 'COMPLETED') AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
  );

-- Legacy blocks a new request while one is submitted, under review or approved
-- (ExitRequest.tsx hasActiveRequest). Enforced here too, as a backstop to the
-- service check, so two concurrent submissions cannot both succeed.
CREATE UNIQUE INDEX "exit_requests_one_active_per_employee_key"
  ON "hr"."exit_requests" ("organization_id", "employee_id")
  WHERE "status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED');
