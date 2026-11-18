-- Timesheets constraints (PR1, migration 3 of 3).
--
-- Tightens only what the CURRENT application code already satisfies, so this
-- deploys safely before the PR2 application change:
--   * at most one running timer per employee (database-level guard);
--   * a session never ends before it starts;
--   * submitted/approved timesheets and their sessions are immutable except
--     through the one audited correction path.
--
-- Deliberately NOT here (they ship with PR2, together with the code that
-- satisfies them, because today's startTimer/stop/manual-entry code would
-- violate them):
--   * project_time_entries.timesheet_id SET NOT NULL
--   * "a session stays inside one IST day" CHECK (needs the midnight split on close)

-- One running (ended_at IS NULL) session per employee. The previous migration
-- already resolved legacy duplicates.
CREATE UNIQUE INDEX "project_time_entries_one_open_per_employee_key"
  ON "projects"."project_time_entries" ("organization_id", "employee_id")
  WHERE "ended_at" IS NULL;

ALTER TABLE "projects"."project_time_entries"
  ADD CONSTRAINT "project_time_entries_end_after_start_check"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

-- ---------------------------------------------------------------------------
-- Immutability of submitted / approved days.
--
-- The ONLY bypass is the audited correction service, which runs
--   SET LOCAL app.allow_timesheet_correction = 'on';
-- inside its transaction (and writes the audit row). Everything else — including
-- a buggy code path — is refused with SQLSTATE 23514.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "projects"."guard_locked_time_entry"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  locked boolean;
BEGIN
  IF current_setting('app.allow_timesheet_correction', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."timesheet_id" IS NOT NULL THEN
      SELECT t."status" IN ('SUBMITTED', 'APPROVED') INTO locked
      FROM "hr"."timesheets" t WHERE t."id" = NEW."timesheet_id";
      IF COALESCE(locked, false) THEN
        RAISE EXCEPTION 'TIMESHEET_LOCKED: cannot add a session to a submitted or approved timesheet'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."timesheet_id" IS NOT NULL THEN
    SELECT t."status" IN ('SUBMITTED', 'APPROVED') INTO locked
    FROM "hr"."timesheets" t WHERE t."id" = OLD."timesheet_id";
    IF COALESCE(locked, false) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'TIMESHEET_LOCKED: cannot delete a session of a submitted or approved timesheet'
          USING ERRCODE = '23514';
      END IF;
      IF NEW."started_at" IS DISTINCT FROM OLD."started_at"
         OR NEW."ended_at" IS DISTINCT FROM OLD."ended_at"
         OR NEW."duration_minutes" IS DISTINCT FROM OLD."duration_minutes"
         OR NEW."entry_date" IS DISTINCT FROM OLD."entry_date"
         OR NEW."task_id" IS DISTINCT FROM OLD."task_id"
         OR NEW."employee_id" IS DISTINCT FROM OLD."employee_id"
         OR NEW."timesheet_id" IS DISTINCT FROM OLD."timesheet_id" THEN
        RAISE EXCEPTION 'TIMESHEET_LOCKED: cannot change a session of a submitted or approved timesheet'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "project_time_entries_guard_locked"
  BEFORE INSERT OR UPDATE OR DELETE ON "projects"."project_time_entries"
  FOR EACH ROW EXECUTE FUNCTION "projects"."guard_locked_time_entry"();

CREATE OR REPLACE FUNCTION "hr"."guard_locked_timesheet"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_timesheet_correction', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'TIMESHEET_LOCKED: cannot delete a submitted, approved or rejected timesheet row'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  -- A past IST day's recorded status is history: it is never rewritten by a
  -- later action (e.g. completing the task days afterwards).
  IF NEW."daily_status" IS DISTINCT FROM OLD."daily_status"
     AND OLD."work_date" < timezone('Asia/Kolkata', now())::date THEN
    RAISE EXCEPTION 'TIMESHEET_DAY_CLOSED: the daily status of a past day cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  -- Submitted / approved rows: content is frozen; only the workflow columns
  -- (status, decision, version, audit stamps) may move.
  IF OLD."status" IN ('SUBMITTED', 'APPROVED') AND (
        NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
     OR NEW."employee_id" IS DISTINCT FROM OLD."employee_id"
     OR NEW."work_date" IS DISTINCT FROM OLD."work_date"
     OR NEW."category" IS DISTINCT FROM OLD."category"
     OR NEW."task_id" IS DISTINCT FROM OLD."task_id"
     OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
     OR NEW."title" IS DISTINCT FROM OLD."title"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."notes" IS DISTINCT FROM OLD."notes"
     OR NEW."daily_status" IS DISTINCT FROM OLD."daily_status"
     OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
     OR NEW."ended_at" IS DISTINCT FROM OLD."ended_at"
     OR NEW."duration_minutes" IS DISTINCT FROM OLD."duration_minutes") THEN
    RAISE EXCEPTION 'TIMESHEET_LOCKED: a submitted or approved timesheet row cannot be edited'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER "timesheets_guard_locked"
  BEFORE UPDATE OR DELETE ON "hr"."timesheets"
  FOR EACH ROW EXECUTE FUNCTION "hr"."guard_locked_timesheet"();
