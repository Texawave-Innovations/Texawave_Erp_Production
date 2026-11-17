-- Timesheets foundation (PR1, migration 1 of 3 — additive only).
--
-- ONE new table, hr.timesheets: one row per activity per IST work date, split
-- by `category` (TASK for assigned project tasks; meeting / discussion /
-- research ... for custom activities). Task time itself stays in
-- projects.project_time_entries (the single source of task work sessions);
-- those rows gain a link (`timesheet_id`) plus bookkeeping columns. Task status
-- history and submit/approve/correct history use the existing audit log, so
-- there is no separate history table.
--
-- This migration changes no existing data and no existing behaviour: every new
-- column on project_time_entries is nullable or defaulted. The data backfill is
-- the next migration; constraints that the current (pre-PR2) application code
-- could violate (NOT NULL timesheet_id, same-IST-day sessions) are deliberately
-- NOT added here — they ship with the application change that satisfies them.

-- AlterTable
ALTER TABLE "projects"."project_time_entries" ADD COLUMN     "closed_reason" TEXT,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "legacy_entry_date" DATE,
ADD COLUMN     "review_state" TEXT NOT NULL DEFAULT 'OK',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'TIMER',
ADD COLUMN     "time_precision" TEXT NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "timesheet_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "hr"."timesheets" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "task_id" INTEGER,
    "project_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "daily_status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "daily_status_source" TEXT NOT NULL DEFAULT 'RECORDED',
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "is_backdated" BOOLEAN NOT NULL DEFAULT false,
    "late_entry_reason" TEXT,
    "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT NOT NULL DEFAULT 'NATIVE',
    "submitted_at" TIMESTAMPTZ(6),
    "submitted_by" INTEGER,
    "approver_employee_id" INTEGER,
    "approver_basis" TEXT,
    "attendance_status_at_submit" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "decided_by" INTEGER,
    "decision_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheets_organization_id_employee_id_work_date_idx" ON "hr"."timesheets"("organization_id", "employee_id", "work_date");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_status_work_date_idx" ON "hr"."timesheets"("organization_id", "status", "work_date");

-- CreateIndex
CREATE INDEX "timesheets_task_id_idx" ON "hr"."timesheets"("task_id");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_project_id_idx" ON "hr"."timesheets"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "project_time_entries_organization_id_employee_id_started_at_idx" ON "projects"."project_time_entries"("organization_id", "employee_id", "started_at");

-- CreateIndex
CREATE INDEX "project_time_entries_timesheet_id_idx" ON "projects"."project_time_entries"("timesheet_id");

-- AddForeignKey
ALTER TABLE "projects"."project_time_entries" ADD CONSTRAINT "project_time_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "hr"."timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."timesheets" ADD CONSTRAINT "timesheets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."timesheets" ADD CONSTRAINT "timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."timesheets" ADD CONSTRAINT "timesheets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "projects"."project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."timesheets" ADD CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- projects.project_time_entries — value domains for the new columns.
-- ---------------------------------------------------------------------------
ALTER TABLE "projects"."project_time_entries"
  ADD CONSTRAINT "project_time_entries_source_check"
    CHECK ("source" IN ('TIMER', 'MANUAL', 'CORRECTION')),
  ADD CONSTRAINT "project_time_entries_time_precision_check"
    CHECK ("time_precision" IN ('EXACT', 'DURATION_ONLY')),
  ADD CONSTRAINT "project_time_entries_closed_reason_check"
    CHECK ("closed_reason" IS NULL OR "closed_reason" IN (
      'STOPPED', 'PAUSED', 'COMPLETED', 'ATTENDANCE_CHECKOUT', 'AUTO_CHECKOUT',
      'STALE', 'MIDNIGHT_SPLIT', 'MIGRATED_DUPLICATE', 'CORRECTED')),
  ADD CONSTRAINT "project_time_entries_review_state_check"
    CHECK ("review_state" IN ('OK', 'REVIEW_REQUIRED', 'STALE_UNRESOLVED'));

-- ---------------------------------------------------------------------------
-- hr.timesheets — CHECKs (hr convention: text + CHECK, not Prisma enums).
-- `category` has no CHECK on purpose: its allowed codes live in one place
-- (apps/api/src/modules/timesheets/timesheets.rules.ts TIMESHEET_CATEGORIES, mirrored
-- by hand in packages/api-types) and are validated by the DTO.
-- ---------------------------------------------------------------------------
ALTER TABLE "hr"."timesheets"
  ADD CONSTRAINT "timesheets_status_check"
    CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT "timesheets_origin_check"
    CHECK ("origin" IN ('NATIVE', 'MIGRATED')),
  ADD CONSTRAINT "timesheets_daily_status_check"
    CHECK ("daily_status" IN ('IN_PROGRESS', 'ON_HOLD', 'COMPLETED')),
  ADD CONSTRAINT "timesheets_daily_status_source_check"
    CHECK ("daily_status_source" IN ('RECORDED', 'INFERRED')),
  ADD CONSTRAINT "timesheets_approver_basis_check"
    CHECK ("approver_basis" IS NULL
           OR "approver_basis" IN ('REPORTING_MANAGER', 'TEAM', 'HR')),
  ADD CONSTRAINT "timesheets_text_not_blank_check"
    CHECK (btrim("category") <> '' AND btrim("title") <> ''),
  -- A TASK row references a task; a custom row never does.
  ADD CONSTRAINT "timesheets_task_shape_check"
    CHECK (("category" = 'TASK') = ("task_id" IS NOT NULL)),
  -- TASK rows own no interval (their time is in project_time_entries); custom
  -- rows own exactly one real interval that stays inside one IST day.
  ADD CONSTRAINT "timesheets_interval_shape_check"
    CHECK (
      CASE WHEN "category" = 'TASK'
        THEN "started_at" IS NULL AND "ended_at" IS NULL AND "duration_minutes" IS NULL
        ELSE "started_at" IS NOT NULL AND "ended_at" IS NOT NULL
             AND "duration_minutes" IS NOT NULL AND "duration_minutes" > 0
             AND "ended_at" > "started_at"
             AND timezone('Asia/Kolkata', "started_at")::date = "work_date"
             -- end minus 1µs: an activity ending exactly at IST midnight
             -- (e.g. 23:00-24:00) still belongs to this day.
             AND timezone('Asia/Kolkata', "ended_at" - interval '1 microsecond')::date = "work_date"
      END),
  -- Submission / decision bookkeeping must match the status.
  ADD CONSTRAINT "timesheets_decision_consistency_check"
    CHECK (
      ("status" NOT IN ('SUBMITTED', 'APPROVED', 'REJECTED') OR "submitted_at" IS NOT NULL)
      AND ("status" NOT IN ('APPROVED', 'REJECTED')
           OR ("decided_at" IS NOT NULL AND "decided_by" IS NOT NULL))
      AND ("status" <> 'REJECTED' OR btrim(COALESCE("decision_note", '')) <> '')),
  ADD CONSTRAINT "timesheets_backdated_reason_check"
    CHECK (NOT "is_backdated" OR btrim(COALESCE("late_entry_reason", '')) <> '');

-- One entry per task per employee per day (a task still has many entries
-- across days). Custom rows are unconstrained here.
CREATE UNIQUE INDEX "timesheets_one_task_per_day_key"
  ON "hr"."timesheets" ("organization_id", "employee_id", "work_date", "task_id")
  WHERE "task_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Custom activities of one employee may never overlap (exclusion constraint,
-- same technique as hr.shifts). Task-vs-custom overlap is checked in the
-- service under the per-employee advisory lock.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "hr"."timesheets"
  ADD CONSTRAINT "timesheets_custom_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    tstzrange("started_at", "ended_at") WITH &&
  ) WHERE ("category" <> 'TASK' AND "deleted_at" IS NULL);
