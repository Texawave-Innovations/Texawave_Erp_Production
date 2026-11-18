-- Timesheets session constraints (PR2) — the constraints PR1 deliberately held back,
-- because the pre-PR2 timer code would have violated them. They ship WITH the
-- application change that satisfies them: every code path that creates a session
-- now links it to its timesheet row, writes the IST work date, and splits a
-- session at IST midnight.
--
-- Deploy order: 20261116100000..100200 (PR1) then this one, in the same release.
-- If sessions were created between the two (PR1 deployed alone for a while), the
-- guard below stops the deploy with instructions instead of failing obscurely.

DO $$
DECLARE
  unlinked bigint;
BEGIN
  SELECT count(*) INTO unlinked
  FROM "projects"."project_time_entries" WHERE "timesheet_id" IS NULL;
  IF unlinked > 0 THEN
    RAISE EXCEPTION
      '% session(s) have no timesheet row. Re-run the (idempotent) backfill '
      '20261116100100_timesheets_backfill/migration.sql, then re-run this migration.',
      unlinked;
  END IF;
END $$;

-- No session without its day row.
ALTER TABLE "projects"."project_time_entries"
  ALTER COLUMN "timesheet_id" SET NOT NULL;

-- entry_date is always the IST date of started_at (the old timer wrote the UTC
-- date, putting 00:00-05:30 IST sessions on the previous day).
ALTER TABLE "projects"."project_time_entries"
  ADD CONSTRAINT "project_time_entries_entry_date_ist_check"
  CHECK ("entry_date" = timezone('Asia/Kolkata', "started_at")::date);

-- A closed session lies inside one IST day (the application splits at midnight).
-- Exempt: duration-only manual rows (their instants are a day-start convention,
-- not a real clock interval) and zero-length rows (stale/duplicate timers closed
-- at their own start). A session ending exactly at midnight stays on its day.
ALTER TABLE "projects"."project_time_entries"
  ADD CONSTRAINT "project_time_entries_one_ist_day_check"
  CHECK (
    "ended_at" IS NULL
    OR "time_precision" = 'DURATION_ONLY'
    OR "ended_at" = "started_at"
    OR timezone('Asia/Kolkata', "started_at")::date
       = timezone('Asia/Kolkata', "ended_at" - interval '1 microsecond')::date
  );
