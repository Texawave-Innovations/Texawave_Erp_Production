-- Timesheets backfill (PR1, migration 2 of 3 — data only, idempotent).
--
-- Links EVERY existing projects.project_time_entries row to a timesheet row and
-- repairs the work date. Nothing is deleted and no time is invented:
--   * started_at / ended_at / duration_minutes are preserved (a row that crosses
--     IST midnight is split into per-day rows whose minutes sum to the original);
--   * the original entry_date is kept in legacy_entry_date when it is moved;
--   * duplicate open timers are closed with ZERO minutes (real end unknown) and
--     flagged STALE_UNRESOLVED instead of being given a guessed end time.
-- The closing DO block RAISEs (aborting the deploy before the constraints
-- migration) if any invariant does not hold.
--
-- Run it in ONE transaction (`psql -1` in rehearsals; Prisma executes the file
-- as a single batch). Re-running is safe: every step only touches rows that
-- still need it.
--
-- The business day is the IST calendar date (Asia/Kolkata), the documented HR
-- policy (Docs/ATTENDANCE_ARCHITECTURE.md §7.4).

-- Verification baseline: total minutes per employee/task BEFORE any change.
DROP TABLE IF EXISTS _ts_before;
CREATE TEMP TABLE _ts_before AS
SELECT "employee_id", "task_id",
       count(*)::bigint AS n,
       COALESCE(sum("duration_minutes"), 0)::bigint AS minutes
FROM "projects"."project_time_entries"
GROUP BY "employee_id", "task_id";

-- (a) Classify manual duration-only rows. The old manual-entry code stored the
-- date at UTC midnight as started_at (a convention, not a real clock time).
-- Heuristic by that exact signature; they are excluded from midnight splitting
-- and from overlap checks later.
UPDATE "projects"."project_time_entries"
SET "source" = 'MANUAL', "time_precision" = 'DURATION_ONLY', "updated_at" = now()
WHERE "ended_at" IS NOT NULL
  AND "source" = 'TIMER' AND "time_precision" = 'EXACT'
  AND "started_at" = ("entry_date"::timestamp AT TIME ZONE 'UTC');

-- (b) entry_date := IST date of started_at. The old timer wrote the UTC date,
-- so a session started 00:00-05:30 IST sat on the previous day.
UPDATE "projects"."project_time_entries"
SET "legacy_entry_date" = COALESCE("legacy_entry_date", "entry_date"),
    "entry_date" = (("started_at" AT TIME ZONE 'Asia/Kolkata')::date),
    "updated_at" = now()
WHERE "entry_date" <> (("started_at" AT TIME ZONE 'Asia/Kolkata')::date);

-- (c) Split closed EXACT sessions that cross IST midnight into one row per IST
-- day. Minutes: every segment but the last is its rounded elapsed time, the last
-- takes the remainder, so the per-session total is preserved exactly.
DROP TABLE IF EXISTS _ts_splits;
CREATE TEMP TABLE _ts_splits AS
WITH crossing AS (
  SELECT e."id", e."started_at", e."ended_at", e."duration_minutes",
         ((e."started_at" AT TIME ZONE 'Asia/Kolkata')::date) AS d0,
         (((e."ended_at" - interval '1 microsecond') AT TIME ZONE 'Asia/Kolkata')::date) AS d1
  FROM "projects"."project_time_entries" e
  WHERE e."ended_at" IS NOT NULL
    AND e."ended_at" > e."started_at"
    AND e."time_precision" = 'EXACT'
    -- The day of the LAST instant of the session (end minus 1µs): a session that
    -- ends exactly at IST midnight belongs to the day it started on, so a row
    -- that was already split is never split again (idempotent).
    AND ((e."started_at" AT TIME ZONE 'Asia/Kolkata')::date)
        <> (((e."ended_at" - interval '1 microsecond') AT TIME ZONE 'Asia/Kolkata')::date)
), segs AS (
  SELECT c."id", c."duration_minutes" AS total_minutes, d::date AS day,
         row_number() OVER (PARTITION BY c."id" ORDER BY d) AS rn,
         count(*) OVER (PARTITION BY c."id") AS cnt,
         GREATEST(c."started_at", (d AT TIME ZONE 'Asia/Kolkata')) AS seg_start,
         LEAST(c."ended_at", ((d + interval '1 day') AT TIME ZONE 'Asia/Kolkata')) AS seg_end
  FROM crossing c
  CROSS JOIN LATERAL generate_series(c.d0::timestamp, c.d1::timestamp, interval '1 day') AS d
), sized AS (
  SELECT s.*, round(extract(epoch FROM (seg_end - seg_start)) / 60)::int AS rounded
  FROM segs s
)
SELECT z."id", z.day, z.rn, z.cnt, z.seg_start, z.seg_end,
       CASE WHEN z.rn < z.cnt THEN z.rounded
            ELSE z.total_minutes - COALESCE(
                   sum(z.rounded) OVER (PARTITION BY z."id" ORDER BY z.rn
                                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
       END::int AS minutes
FROM sized z;

INSERT INTO "projects"."project_time_entries"
  ("organization_id", "task_id", "employee_id", "started_at", "ended_at",
   "duration_minutes", "entry_date", "notes", "created_at", "updated_at",
   "created_by", "source", "time_precision", "closed_reason", "review_state")
SELECT e."organization_id", e."task_id", e."employee_id", f.seg_start, f.seg_end,
       f.minutes, f.day, e."notes", e."created_at", now(),
       e."created_by", e."source", e."time_precision", 'MIDNIGHT_SPLIT', e."review_state"
FROM _ts_splits f
JOIN "projects"."project_time_entries" e ON e."id" = f."id"
WHERE f.rn > 1;

UPDATE "projects"."project_time_entries" e
SET "ended_at" = f.seg_end, "duration_minutes" = f.minutes,
    "closed_reason" = 'MIDNIGHT_SPLIT', "updated_at" = now()
FROM _ts_splits f
WHERE f."id" = e."id" AND f.rn = 1;

-- (d) More than one open timer per employee would violate the one-open-session
-- index of the next migration. Keep the newest; close the older ones at their
-- own start with 0 minutes (the real end is unknown — never guessed).
UPDATE "projects"."project_time_entries" e
SET "ended_at" = e."started_at", "duration_minutes" = 0,
    "review_state" = 'STALE_UNRESOLVED', "closed_reason" = 'MIGRATED_DUPLICATE',
    "notes" = COALESCE(e."notes" || E'\n', '')
              || 'Migrated: duplicate open timer; real end time unknown, 0 minutes counted.',
    "updated_at" = now()
FROM (
  SELECT "id", row_number() OVER (
           PARTITION BY "organization_id", "employee_id"
           ORDER BY "started_at" DESC, "id" DESC) AS rn
  FROM "projects"."project_time_entries"
  WHERE "ended_at" IS NULL
) r
WHERE r."id" = e."id" AND r.rn > 1;

-- (e) One hr.timesheets row per (employee, IST day, task) that has sessions.
-- daily_status is INFERRED (no history exists): COMPLETED only on the task's
-- last worked day when the task is completed, otherwise IN_PROGRESS — the same
-- "any worked day is In Progress" rule used for new data.
INSERT INTO "hr"."timesheets"
  ("organization_id", "employee_id", "work_date", "category", "task_id",
   "project_id", "title", "daily_status", "daily_status_source", "status",
   "origin", "entered_at", "created_at", "updated_at")
SELECT e."organization_id", e."employee_id", e."entry_date", 'TASK', e."task_id",
       t."project_id", t."title",
       CASE WHEN t."status" = 'completed' AND e."entry_date" = last_day.d
            THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
       'INFERRED', 'DRAFT', 'MIGRATED',
       min(e."created_at"), min(e."created_at"), now()
FROM "projects"."project_time_entries" e
JOIN "projects"."project_tasks" t ON t."id" = e."task_id"
JOIN (
  SELECT "task_id", max("entry_date") AS d
  FROM "projects"."project_time_entries" GROUP BY "task_id"
) last_day ON last_day."task_id" = e."task_id"
WHERE e."timesheet_id" IS NULL
GROUP BY e."organization_id", e."employee_id", e."entry_date", e."task_id",
         t."project_id", t."title", t."status", last_day.d
ON CONFLICT ("organization_id", "employee_id", "work_date", "task_id")
  WHERE "task_id" IS NOT NULL AND "deleted_at" IS NULL
DO NOTHING;

-- (f) Link every session to its timesheet row.
UPDATE "projects"."project_time_entries" e
SET "timesheet_id" = ts."id"
FROM "hr"."timesheets" ts
WHERE e."timesheet_id" IS NULL
  AND ts."organization_id" = e."organization_id"
  AND ts."employee_id" = e."employee_id"
  AND ts."work_date" = e."entry_date"
  AND ts."task_id" = e."task_id"
  AND ts."deleted_at" IS NULL;

-- (g) Verification — abort the whole deploy on any violated invariant.
DO $$
DECLARE
  bad bigint;
  n_before bigint;
  n_after bigint;
BEGIN
  -- Total minutes per employee/task must be unchanged.
  SELECT count(*) INTO bad
  FROM _ts_before b
  LEFT JOIN (
    SELECT "employee_id", "task_id", COALESCE(sum("duration_minutes"), 0) AS m
    FROM "projects"."project_time_entries" GROUP BY "employee_id", "task_id"
  ) a ON a."employee_id" = b."employee_id" AND a."task_id" = b."task_id"
  WHERE COALESCE(a.m, 0) <> b.minutes;
  IF bad > 0 THEN
    RAISE EXCEPTION 'timesheet backfill aborted: % employee/task group(s) changed total minutes', bad;
  END IF;

  -- No row may be lost (splits only add rows).
  SELECT COALESCE(sum(n), 0) INTO n_before FROM _ts_before;
  SELECT count(*) INTO n_after FROM "projects"."project_time_entries";
  IF n_after < n_before THEN
    RAISE EXCEPTION 'timesheet backfill aborted: row count fell from % to %', n_before, n_after;
  END IF;

  -- Every session is linked.
  SELECT count(*) INTO bad FROM "projects"."project_time_entries" WHERE "timesheet_id" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'timesheet backfill aborted: % session(s) left unlinked', bad;
  END IF;

  -- At most one open timer per employee.
  SELECT count(*) INTO bad FROM (
    SELECT 1 FROM "projects"."project_time_entries" WHERE "ended_at" IS NULL
    GROUP BY "organization_id", "employee_id" HAVING count(*) > 1) d;
  IF bad > 0 THEN
    RAISE EXCEPTION 'timesheet backfill aborted: % employee(s) still have several open timers', bad;
  END IF;

  -- entry_date is the IST date of started_at everywhere.
  SELECT count(*) INTO bad FROM "projects"."project_time_entries"
  WHERE "entry_date" <> (("started_at" AT TIME ZONE 'Asia/Kolkata')::date);
  IF bad > 0 THEN
    RAISE EXCEPTION 'timesheet backfill aborted: % session(s) have a non-IST entry_date', bad;
  END IF;

  -- No EXACT closed session may still cross IST midnight (all were split).
  SELECT count(*) INTO bad FROM "projects"."project_time_entries" e
  WHERE e."ended_at" IS NOT NULL AND e."ended_at" > e."started_at"
    AND e."time_precision" = 'EXACT'
    AND ((e."started_at" AT TIME ZONE 'Asia/Kolkata')::date)
        <> (((e."ended_at" - interval '1 microsecond') AT TIME ZONE 'Asia/Kolkata')::date);
  IF bad > 0 THEN
    RAISE EXCEPTION 'timesheet backfill aborted: % session(s) still cross IST midnight', bad;
  END IF;

  -- Informational only (never fixed here): denormalised task.logged_hours that
  -- disagrees with the sum of sessions.
  SELECT count(*) INTO bad FROM "projects"."project_tasks" t
  WHERE abs(t."logged_hours" - COALESCE((
    SELECT sum(e."duration_minutes") / 60.0 FROM "projects"."project_time_entries" e
    WHERE e."task_id" = t."id"), 0)) > 0.05;
  RAISE NOTICE 'timesheet backfill ok: % session row(s) before, % after; % task(s) have logged_hours differing from their sessions (left untouched)',
    n_before, n_after, bad;
END $$;
