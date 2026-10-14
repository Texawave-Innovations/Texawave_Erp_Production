-- HR attendance backend gaps (Docs/HR_API.md → Attendance):
--   1. Monthly attendance close per employee (finalize → approve, lock for payroll).
--   2. In-app notifications (platform), used first by the missing check-in /
--      check-out alerts.
--   3. Punch import: sessions created from a CSV carry source IMPORT.

-- CreateTable
CREATE TABLE "hr"."attendance_month_locks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "submitted_by" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendance_month_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."notifications" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedup_key" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_month_locks_organization_id_month_status_idx" ON "hr"."attendance_month_locks"("organization_id", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_month_locks_organization_id_employee_id_month_key" ON "hr"."attendance_month_locks"("organization_id", "employee_id", "month");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "platform"."notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedup_key_key" ON "platform"."notifications"("user_id", "dedup_key");

-- AddForeignKey
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express
-- ---------------------------------------------------------------------------
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_status_check"
  CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'RETURNED', 'REOPENED'));

-- `month` is always the first day of a calendar month.
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_month_first_day_check"
  CHECK (EXTRACT(DAY FROM "month") = 1);

-- A decided row carries its decider and time; a SUBMITTED row carries neither.
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_decision_check"
  CHECK (("status" = 'SUBMITTED' AND "decided_by" IS NULL AND "decided_at" IS NULL)
      OR ("status" <> 'SUBMITTED' AND "decided_at" IS NOT NULL));

-- Returning or reopening a month always says why.
ALTER TABLE "hr"."attendance_month_locks" ADD CONSTRAINT "attendance_month_locks_note_check"
  CHECK ("status" NOT IN ('RETURNED', 'REOPENED')
         OR ("decision_note" IS NOT NULL AND btrim("decision_note") <> ''));

ALTER TABLE "platform"."notifications" ADD CONSTRAINT "notifications_text_not_blank_check"
  CHECK (btrim("type") <> '' AND btrim("title") <> '' AND btrim("body") <> '');

ALTER TABLE "hr"."attendance_sessions" DROP CONSTRAINT "attendance_sessions_source_check";
ALTER TABLE "hr"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_source_check"
  CHECK ("source" IN ('SELF', 'HR', 'CORRECTION', 'IMPORT'));
