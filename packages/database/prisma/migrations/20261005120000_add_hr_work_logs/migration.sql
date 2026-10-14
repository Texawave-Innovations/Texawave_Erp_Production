-- CreateTable
CREATE TABLE "hr"."work_logs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "task_description" TEXT NOT NULL,
    "hours_worked" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_logs_organization_id_employee_id_work_date_idx" ON "hr"."work_logs"("organization_id", "employee_id", "work_date");

-- CreateIndex
CREATE INDEX "work_logs_organization_id_status_idx" ON "hr"."work_logs"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "hr"."work_logs" ADD CONSTRAINT "work_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."work_logs" ADD CONSTRAINT "work_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."work_logs" ADD CONSTRAINT "work_logs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."work_logs" ADD CONSTRAINT "work_logs_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma cannot express.

-- Legacy evidence: each entry is 0 < hours <= 24 (MyTimesheet.tsx submitLog).
ALTER TABLE "hr"."work_logs"
  ADD CONSTRAINT "work_logs_hours_range_check"
  CHECK ("hours_worked" > 0 AND "hours_worked" <= 24);

-- Only the three legacy statuses exist.
ALTER TABLE "hr"."work_logs"
  ADD CONSTRAINT "work_logs_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

-- A task description must carry real text, not a blank string.
ALTER TABLE "hr"."work_logs"
  ADD CONSTRAINT "work_logs_task_not_blank_check"
  CHECK (length(btrim("task_description")) > 0);

-- A decision is recorded together (who + when) and only once one exists.
ALTER TABLE "hr"."work_logs"
  ADD CONSTRAINT "work_logs_decision_consistency_check"
  CHECK (
    ("status" = 'PENDING' AND "decided_by" IS NULL AND "decided_at" IS NULL)
    OR ("status" <> 'PENDING' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
  );
