# Timesheets

**Status:** PR1 (foundation), PR2 (task timer integration, read side, forgotten-timer sweep, My Timesheet
screen), PR3 (custom activities), PR4 (HR attendance on the day, mismatch flags), PR5 (submit, two-level
review), PR5b (reopen, HR correction of a flagged timer, counts, reports and CSV) and PR6 (independent review,
hardening) are implemented. Approval delegation is the one planned item left — see "Delivery status". To test it by
hand, follow `TIMESHEET_TESTING.md`.
**Owner:** repository maintainers — assign a named owner before PR3.
**Canonical rules this builds on:** `ARCHITECTURE.md` §11 (changelog), `CODING_STANDARDS.md` ("Business
date"), `ATTENDANCE_ARCHITECTURE.md` §7.4 (IST business day).

## What it is

A per-day record of what an employee worked on, with attendance shown beside it, an immutable multi-day
history, custom activities (meetings, discussions) and a submit → review → approve workflow. It sits
**on top of** the existing Projects stopwatch — it does not replace it.

## Data model — one table

| Table                           | Role                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hr.timesheets`                 | One row per **activity per IST work date**, split by `category`: `TASK` (an assigned project task) or a custom-activity code (`INTERNAL_MEETING`, `TEAM_DISCUSSION`, `RESEARCH`, …). Also holds the day's approval state (`status`, `submitted_*`, `decided_*`, `approver_*`). |
| `projects.project_time_entries` | **Unchanged role: the single source of actual task work sessions.** Gains `timesheet_id` (link, NOT NULL), `source`, `time_precision`, `closed_reason`, `review_state`, `updated_at`, `created_by`, `legacy_entry_date`.                                                       |

There is deliberately **no** separate entries, events, categories or task-history table. History of task
status changes and of submit/approve/reject/correct goes to the audit log (`AuditWriter`); the category list
is one constant (`apps/api/src/modules/timesheets/timesheets.rules.ts` `TIMESHEET_CATEGORIES`).

Key rules (DB-enforced in the migrations, pure logic in `timesheets.rules.ts`):

- A `TASK` row has a `task_id` and no interval (its time is in `project_time_entries`); a custom row has no
  `task_id` and one real interval inside one IST day. A task has at most **one row per day** but many rows
  across days (`timesheets_one_task_per_day_key`).
- A day's recorded status: any worked day is `IN_PROGRESS`; only completing the task makes that day
  `COMPLETED`. A pause is task history, not a daily status. Days with no work have **no row** — task-day
  history for them (status carried forward, attendance from HR, 0 hours) is derived on read, never stored.
- A past day's `daily_status` is immutable, and a SUBMITTED/APPROVED day (row **and** its sessions) is frozen
  by database triggers. The only bypass is the audited correction path (`SET LOCAL
app.allow_timesheet_correction = 'on'`).
- One running timer per employee (`project_time_entries_one_open_per_employee_key`).
- A closed session lies inside one IST day (`project_time_entries_one_ist_day_check`); the application splits a
  session at IST midnight.
- Custom activities of one employee never overlap (`btree_gist` exclusion constraint).

## Working a task — the existing stopwatch endpoints

There are **no separate task-action routes**. Employees work through the Projects stopwatch (permission
`employee_self_service.work.write`, or the older `projects.timer.write` — either is enough), which now also
writes the day row:

| Call                                            | Effect                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /projects/tasks/:id/timer/start`          | Opens a session on today's IST day (creates or reuses the day's row) and puts the task in progress. Starting a task that is on hold resumes it. Refused if a timer is already running, the employee is not checked in, or the day is already submitted. |
| `POST /projects/tasks/:id/timer/stop`           | Closes the session (split at IST midnight if needed). Unchanged for a plain stop.                                                                                                                                                                       |
| `POST /projects/tasks/:id/timer/stop` `{pause}` | Also puts the task on hold (strict rule: only from in progress; assignee only).                                                                                                                                                                         |
| `POST …/timer/stop` `{complete}`                | Also completes the task (from in progress or hold; assignee only), records the completion day, pays points once. Completing from hold records 0 new minutes — no session is invented.                                                                   |
| `POST /projects/tasks/:id/time-entries`         | Legacy manual entry (date + duration): stored as a `DURATION_ONLY` session on that day's row; a future date is refused.                                                                                                                                 |
| `PATCH /projects/tasks/:id`                     | Manager status changes are audited too. Leaving `completed` (a reopen) requires `statusChangeReason`. A task with a running timer cannot be reassigned or deleted; a project with one cannot be deleted.                                                |

Every status change — from any of these paths — writes one `project_task` `status_change` audit row, which is
the task's status history. Points are paid once per task and employee, ever.

## Reading it back

| Call                                            | Permission                             | Returns                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /timesheets/my/:date`                      | `employee_self_service.timesheet.read` | The signed-in employee's rows for the day with their sessions, totals (closed sessions only), HR's effective attendance status for the day, its worked time and the day's first check-in / last verified check-out, the day's **flags** (below), and — for today only — open tasks with no work yet.         |
| `GET /timesheets/my-month?month=YYYY-MM`        | same                                   | The employee's **month**: one line per day with HR's status, check-in/out, hours HR counts, the day's target (after approved permissions) and the permission window, the logged timesheet minutes and the day's review state; plus the month's counts (present, absent, leave, holiday, logged, permission). |
| `GET /timesheets/tasks/:taskId/history?from&to` | same                                   | One task day by day (≤ 62 days): worked days from stored rows; the days in between **derived** (0 minutes) with the task status at the end of that day and HR's status for it.                                                                                                                               |

The employee always comes from the signed-in user; another employee's task is a 404. Example, the spec's
scenario: Mon 2h → `In Progress`; Tue `On Hold (no work)` 0h; Wed (HR: absent) `Not worked` 0h; Thu 3h →
`Completed`; task total 5h — and Monday's record is never touched by Thursday's completion.

## Attendance on the day and mismatch flags (PR4)

Attendance is read through `AttendanceLookupService.dayStatuses()` (exported by the HR attendance module). It
reuses HR's own day-context loader, day view and calculation, so the timesheet can never show a status the
attendance screens would not. **Every** date has a status — Present, Absent, Half day, On leave, Holiday,
Weekly off, or Not marked when HR has nothing for it (a holiday, weekly off or approved leave is known without an
attendance row). A day with no record is never read as an absence.

`GET /timesheets/my/:date` also returns `attendance` (status, worked/overtime/target minutes, plus the
shift's `baseTargetMinutes` and the day's approved `permissions`) and `flags`.

**Approved permissions.** A short-time permission (`WorkPermission`, up to 2 h inside 10:00–19:00, approved by
HR) is taken off the day's target — an 8 h shift with a 2 h permission has a 6 h target — so the day is not
short-hours for time the company excused. This happens in HR attendance's one calculation (see
`ATTENDANCE_ARCHITECTURE.md` §7), and the timesheet only shows it: the day view lists the permission window and
"target 6h (8h shift minus 2h permission)", the month table has a Permission column, and a reviewer sees the same.
Pending and rejected permissions change nothing.
Flags compare the recorded work with HR's status, are **derived on every read** (nothing is stored, so nothing can
go stale when HR edits attendance later), and never change hours or attendance or block recording work:

| Flag                              | Severity | When                                                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `WORK_ON_ABSENT_DAY`              | warning  | work recorded on a day HR marked absent                                               |
| `WORK_ON_LEAVE`                   | warning  | work recorded on a day of approved leave                                              |
| `WORK_WITHOUT_ATTENDANCE`         | warning  | work on a **past** day HR has nothing for (today is never flagged — HR may not be up) |
| `WORK_ON_HOLIDAY`                 | info     | work recorded on a holiday                                                            |
| `WORK_ON_WEEKLY_OFF`              | info     | work recorded on a weekly off                                                         |
| `STALE_SESSION`                   | warning  | a forgotten timer was closed with no time counted (`STALE_UNRESOLVED`)                |
| `SESSION_NEEDS_REVIEW`            | warning  | a session is marked `REVIEW_REQUIRED`                                                 |
| `ATTENDANCE_CHANGED_AFTER_SUBMIT` | warning  | HR's status for the day is not what it was when the day was submitted (PR5)           |

Task history now carries HR's status for every in-between day, so the weekly-off / holiday / leave days read
"Not worked". The rules are pure (`timesheet-flags.ts`, unit-tested). No new table was added.

## Submit and review (PR5)

The unit of review is **one employee-day**: submit and every decision act on all of that day's rows together.
The design copies leave's two-level approval (`hr.leave.approve.*`, `approvalVerdict`) so the two workflows behave
alike. No new table — three columns and two CHECKs on `hr.timesheets` (migration
`20261117100000_timesheets_review_levels`): `approval_levels` (1 or 2), `first_decided_by/_at/_note`.

**Flow (team lead first, then HR — decided 2026-11-20, same as leave).** Employee submits a day → the **team lead**
of their team gives the **first approval** → **HR** (`hr.timesheet.approve.all`) gives the **second**, which is final.
A team lead is a user who holds `hr.timesheet.approve.team` (the default Team Lead role grants it) and is assigned to
the employee's team. A **team lead's own day**, or a day from a **team with no lead**, goes to **HR alone**
(`approval_levels = 1`, `approver_basis = 'HR'`); others are stored with `approver_basis = 'TEAM'`. Routing is fixed
at submit. `Employee.reportsTo` no longer routes timesheets; a day submitted before this change
(`approver_basis = 'REPORTING_MANAGER'`) can still take its first approval from that reporting manager. The status stays `SUBMITTED`
between the two approvals (like leave), so the status CHECK and the submitted-row immutability triggers are unchanged.
Either approver may **return** a day with a required reason; it goes back to the employee as `REJECTED`, the first
approval is void, and a resubmit starts the review over.

| Rule (pure, `timesheet-approval.ts`)                                                             | Result                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Not in the caller's team/all scope (and not the reporting manager of a pre-change day)           | 404 (the day is never revealed)       |
| Deciding your own day, or one you submitted                                                      | 403                                   |
| One-level day and the caller is not HR                                                           | 403 "only HR can decide it"           |
| Two-level, first approval pending: team lead / team approver → first approval; HR → **override** | first approval, or final (`override`) |
| Two-level, first approval done: only HR; not the person who gave the first approval              | 403 `AWAITING_HR` / `SAME_APPROVER`   |
| A day already decided                                                                            | 422                                   |

| Call                                                | Permission                               | Effect                                                                                                         |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /timesheets/my/:date/submit`                  | `employee_self_service.timesheet.submit` | Submits the day's draft/returned rows. Refused: no work, future day, a timer still running, already submitted. |
| `POST /timesheets/my/submit-week` `{weekStart}`     | same                                     | Submits every day of that ISO week up to today that has work; reports the days it skipped.                     |
| `GET /timesheets/review/awaiting`                   | `hr.timesheet.approve.*`                 | Days the caller can decide **now**.                                                                            |
| `GET /timesheets/review?status&from&to&employeeId`  | `hr.timesheet.read.*`                    | Submitted, approved and returned days in the caller's reach.                                                   |
| `GET /timesheets/review/:employeeId/:date`          | `hr.timesheet.read.*`                    | One day: rows, sessions, HR attendance now and at submit, flags, `canDecide`.                                  |
| `POST /timesheets/review/:employeeId/:date/approve` | `hr.timesheet.approve.*`                 | First or final approval, optional note.                                                                        |
| `POST /timesheets/review/:employeeId/:date/reject`  | `hr.timesheet.approve.*`                 | Returns the day; the reason is required.                                                                       |

`GET /timesheets/my/:date` now carries `review` (status, who it waits for, the decision note, `canSubmit`).

**Permissions.** `hr.timesheet.read.{own,team,all}` lists and opens a day; `hr.timesheet.approve.{team,all}`
decides (`.own` only reaches pre-change days routed to a reporting manager). **An approver also holds `read` at the
same scope.** Defaults: Employee gets `submit`; **Team Lead gets `read.team` + `approve.team`** (its one approval
exception to "read-only", with `hr.leave.approve.team`, pinned in `default-roles.test.ts`); HR Manager gets
`read.all` + `approve.all`. Production roles are org data and `permissions:sync` never grants: after deploying, grant
`hr.timesheet.approve.team` and `hr.leave.approve.team` to the Team Lead role in Settings → Roles, and make sure each
team lead is assigned to their team.

**Attendance drift.** The day's HR status is stored on the rows at submit (`attendance_status_at_submit`). If HR
later edits attendance, the reviewer sees `ATTENDANCE_CHANGED_AFTER_SUBMIT`; the submitted hours are never rewritten.

**Notifications** (best effort, after commit, never the person who acted): submit → the team lead(s) (or HR when
one-level); first approval → the employee and HR; approved / returned → the employee, with the reason.

## Reopen, correction, counts and reports (PR5b)

| Call                                                   | Permission                      | Effect                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /timesheets/review/:employeeId/:date/reopen`     | `hr.timesheet.approve.all` (HR) | An approved day goes back to the employee as `REJECTED` with a required reason; review restarts. Never your own.                                                                    |
| `POST /timesheets/sessions/:sessionId/correct`         | `hr.timesheet.approve.all` (HR) | HR confirms the real end (IST `HH:mm`) of a flagged timer; minutes, task hours and audit follow.                                                                                    |
| `GET /timesheets/review/summary`                       | `hr.timesheet.read.*`           | Counts for the review screen: awaiting me, submitted, needs a look, returned, approved this month.                                                                                  |
| `GET /timesheets/reports/employees?from&to`            | `hr.timesheet.read.*`           | Per employee: hours and days in each review state, plus the shift target **after permissions**, the permission minutes and the attendance minutes (range ≤ 62 days, ≤ 50,000 rows). |
| `GET /timesheets/employees/:employeeId/month?month`    | `hr.timesheet.read.*`           | One employee's month for a reviewer (same body as `my-month`, plus the employee). Only people in the caller's reach; anyone else is a 404.                                          |
| `GET /timesheets/review/:employeeId/:date?drafts=true` | `hr.timesheet.read.*`           | `drafts=true` also opens a day the employee has not submitted (read-only: `canDecide` is false). Without it a draft day is a 404, as before.                                        |
| `GET /timesheets/reports/days?from&to`                 | `hr.timesheet.read.*`           | One line per employee per day with work, **drafts included** (hours, task/other split, review state); feeds the Week grid. Same reach, range and row cap.                           |
| `GET /timesheets/reports/employees.csv`, `days.csv`    | `hr.timesheet.export.*`         | The same, as CSV (spreadsheet formulas in names or notes are neutralised).                                                                                                          |

**Correcting a timer.** The employee never edits a task session, so this is the only way hours are added to one after
the fact. Only a session flagged for review (`STALE_UNRESOLVED`, or `REVIEW_REQUIRED`) and already closed can be
corrected. The end must be after the start, on the session's own IST day, not in the future, within the 12-hour
open-session cap, and clear of the employee's other work (a logged _duration_ has no real clock interval and never
counts as overlap). It works on a submitted or approved day: the immutability triggers allow the change only inside
that one transaction (`app.allow_timesheet_correction`), the day's status is unchanged, and the audit row
(`project_time_entry` / `correct`) keeps before, after and the reason. The employee is notified.

**Reopen.** HR only, approved days only, never one's own. A non-HR caller gets a 404 so the day's existence is not
revealed.

**Screen.** Team Timesheets gains four count cards, a **Week** tab, a **Report** tab (date range, table, CSV buttons
for those with export), and — inside the review dialog, only when the server says the caller may — **Reopen this
day** and **Set the real end time**.

**Week tab.** People down the side, Monday to Sunday across; each cell is the day's hours, coloured by where the day
is in review (Draft, Submitted — waiting for the manager or for HR —, Approved, Returned) with a marker for a day that
needs a look and "incl. … other" when activities besides tasks are in it. Row totals, a team-total row, a legend with
day counts, previous/next week, "This week" and a jump-to-date field. A day with no work has no cell (a dash); days
after today stay blank because time can only be recorded for today or the past. A submitted, approved or returned day
opens the review dialog; a draft has nothing to review yet, so it is not clickable. The rules (which Monday, totals,
counts, labels) are pure and unit-tested in `features/timesheets/week-grid.test.ts` (run with
`tsx --test`; the UI has no test script yet).

## Hardening (PR6)

An independent, read-only review of this module found one real integrity hole and three smaller issues; all were
fixed and each has a regression test (`timesheets-review.e2e-spec.ts`, "regressions from the independent review"):

- **A submitted or approved day could gain a draft row through a _different_ task** (timer start or a manual entry),
  leaving a day that could never be fully submitted or reopened. `ensureTaskRow` now refuses new work when **any** row
  of the day is submitted or approved. The one deliberate exception is the midnight split of a timer being closed,
  which must always succeed.
- A manual time entry has a ceiling (16 hours); an absurd value used to crash with a 500.
- HR's timer correction no longer reports a false overlap with a logged _duration_ (placeholder instants).
- Review lists default to the last 92 days, and every review/report load has a row cap, so a list cannot load the
  whole history.

Also checked: another organization's days, sessions and reports are never reachable (404 / empty); unknown request
fields are refused; paging and date inputs are bounded; the new migration was rehearsed on a populated database.
Left as they are, on purpose: the legacy manual-entry endpoint's lack of an assignee check, and the
two-step logged-hours rollup on that legacy path (both pre-date this module; see `TIMESHEET_TESTING.md` §5).

## Custom activities (PR3)

Work that is **not** an assigned task — a meeting, a discussion, research... — is recorded as a custom row in the
same table (`category` = the activity type). It never creates or changes a project task.

| Call                                       | Permission                              | Effect                                                                                                                             |
| ------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /timesheets/activity-categories`      | `employee_self_service.timesheet.read`  | The category list for the form, served from one constant (never hard-coded in the UI).                                             |
| `GET /timesheets/linkable-projects`        | same                                    | Projects the employee may attach an activity to: live projects they are a member of or hold a task in.                             |
| `POST /timesheets/custom-activities`       | `employee_self_service.timesheet.write` | Records an activity. Body: category, title, `workDate`, `startTime`/`endTime` (IST `HH:mm`), optional project/description/remarks. |
| `PATCH /timesheets/custom-activities/:id`  | same                                    | Edits your own activity while it is a draft (or was returned). `projectId: null` removes the link.                                 |
| `DELETE /timesheets/custom-activities/:id` | same                                    | Soft-deletes your own draft activity.                                                                                              |

Rules (unit-tested in `timesheets.rules.ts`, enforced in `custom-activities.repository.ts` and by database
constraints):

- **The server builds the times.** The browser sends a date and IST `HH:mm`; the server makes the instants and
  calculates the duration. An activity must end after it starts, may not end in the future, and must stay inside
  one IST day (record a separate entry for each day). An activity that ends exactly at midnight is entered as
  `23:59`.
- **No overlaps.** An activity may not overlap another activity or a work session of the same employee (a running
  timer counts as running from its start). Checked under the employee's timesheet lock, with the database's
  `timesheets_custom_no_overlap` exclusion constraint as a backstop. Touching ends are fine.
- **Late entries.** A work date before today is a late entry: a reason is required, and the row is flagged
  `is_backdated` with `late_entry_reason`.
- **Protected days.** No new or moved activity lands on a day that already has a submitted or approved row, and a
  submitted/approved activity cannot be edited or deleted — it goes through the correction workflow (PR5).
- **Ownership.** Only the owner edits or deletes (another employee gets a 404); task rows and imported history are
  never touched through these endpoints.
- **Audit.** Create, update and delete each write a `timesheet_activity` audit row.

## Business day

IST (Asia/Kolkata), one definition: `apps/api/src/common/dates/business-date.ts` (and
`packages/core` `businessToday()` for the browser, which therefore no longer depends on the machine's time
zone). HR's `istDateOf` / `istToday` delegate to it (same output, pinned by `business-date.spec.ts`). A session
that ends exactly at midnight belongs to the day it started on. `OrganizationSetting.timezone` is display-only.

## Forgotten timers — never fabricate hours

`OpenSessionSweepService` (run by `OpenSessionSweepScheduler` every 5 minutes, and lazily for one employee
when they start a timer) applies `resolveOpenSession`:

1. A real attendance check-out after the session start closes it at that instant (split at IST midnight if the
   check-out is on a later day), hours rolled up.
2. No check-out and the session crossed IST midnight or exceeded `MAX_OPEN_SESSION_HOURS` (12): it is closed at
   its own start with **0 minutes**, flagged `STALE_UNRESOLVED`, and the employee is notified once
   (`timesheet.stale_session`). The real end can only come from an authorized correction (PR5).
3. Otherwise it is still running.

The existing behavior that stops a timer when the employee checks out still works (the first rule above also
covers it when nobody has My Work open).

## Migrations

| #   | Name                                            | Content                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261116100000_timesheets_foundation`          | Additive: `hr.timesheets`, new columns on `project_time_entries`, CHECKs, partial unique index, overlap exclusion.                                                                                                                                                                                                                                         |
| 2   | `20261116100100_timesheets_backfill`            | Data, idempotent, one transaction. Links **every** existing session to a `TASK` row, moves `entry_date` to the IST date (original kept in `legacy_entry_date`), splits sessions crossing IST midnight (minutes sum exactly), closes duplicate open timers at 0 minutes. Ends with a verification block that **aborts the deploy** if any invariant breaks. |
| 3   | `20261116100200_timesheets_constraints`         | One-open-session unique index, `ended_at >= started_at`, immutability triggers.                                                                                                                                                                                                                                                                            |
| 4   | `20261116110000_timesheets_session_constraints` | `timesheet_id SET NOT NULL`, `entry_date` = IST date of `started_at`, a session stays inside one IST day. Refuses to run (with instructions) if any session is unlinked. Ships with the application code that satisfies it.                                                                                                                                |

**Release all four migrations together with the PR2 application code.** Migration 4 is only safe once every
code path writes the link and the IST work date.

**Rehearsal (required before deploying):** restore a dump into a throwaway database, load an adversarial
fixture (UTC-day bug rows, sessions crossing one and three IST midnights, duplicate open timers, manual
duration-only rows, rows on soft-deleted/reassigned tasks), run migrations 1→4, re-run 2, then assert totals,
links, constraints and triggers. Never against a shared database. **Run a read-only profile of the real
`project_time_entries` first** (row count, duplicate opens, midnight-crossers, UTC-bug rows).
**Rollback:** migration 1 is additive; migration 2 is not reversible in SQL — restore the pre-migration dump.

## Screens

- **My Timesheet** (`/portal/timesheet`, menu `portal-timesheet`, `employee_self_service.timesheet.read`): two
  tabs. **Log Work** is the day view: day navigation, totals, each row with its sessions (IST clock times),
  HR's attendance status, the approved permission window and the reduced target, and today's open tasks.
  A **Timeline** card draws the day as one horizontal bar in IST (at least the shift plus an hour): check-in and
  check-out markers, each task's or activity's work in its own colour, the approved permission window in amber, and
  the gaps while checked in, striped: **Paused** (light blue) right after a task was paused, otherwise **No active
  task** (grey, no task timer and no permission running). Tasks are labelled by title (the code is in the tooltip);
  today has a dashed **Now** line with the rest of the day faded. HR's status for the day is a band across the
  whole bar (**Holiday**, **Weekly off**, **On leave**, **Absent**; work recorded on it is drawn on top) or a
  **Half day** chip; the week also loads future days so a planned holiday, weekly off or leave shows ahead (the
  same rule as the month table — no other status is shown before the day). Its **Week** switch shows
  the week as a worksheet, one bar per day on a shared time scale, with day and week totals; a day opens in the day
  view. Durations logged without clock times and timers left running (0 min counted) are not drawn. Each task row
  has a **History** button: that task's minutes for the 14 days up to the selected day against an 8-hour day, with
  the task's progress and HR's status on days with no work (`GET /timesheets/tasks/:taskId/history`). The bar rules
  are pure and unit-tested in `features/timesheets/day-timeline.test.ts` (`tsx --test`).
  **Attendance** is the month: Present / Absent / Leave / Holiday / Permission / Hrs Logged cards and a table
  (Date, Day, Status, Check In, Check Out, Hours, Target, Permission, Logged, Timesheet); a day with work has an
  Open link back to Log Work. A future day's Status shows only what HR's calendar already knows (Holiday, Weekly
  Off, On Leave); any other future status is a dash, since the day has no verdict yet. The rule is in
  `features/timesheets/month-status.ts` (unit-tested in `month-status.test.ts`, run with `tsx --test`). Work is started and stopped in **My Work**.
- **Team Timesheets / HR Timesheets** (`/portal/team-timesheets`, `/hr/timesheets`) **Report** tab: team filter
  with a totals row, the Target / Permission / Attendance columns, and an employee drill-down (click a name or
  use the Employee picker) that shows that person's month exactly as they see it; a day opens the day review,
  including days not yet submitted (read-only). The report lists people with recorded work in the range.
- **Add custom activity** (on My Timesheet, `employee_self_service.timesheet.write`): a dialog with category,
  title, date, IST start/end (live duration preview), optional project, description and remarks, and a required
  reason for a late entry. Draft activities show Edit and Delete.
- **My Work** (`/portal/work`): gains **Pause**, a one-call **Finish**, and "Resume" wording for a task on hold.
  Reopening a completed task (employee modal, manager modal, project page dropdown) asks for a reason.

## Known limits and decisions

- **Attendance** is HR's full derived status for every day (PR4); a day HR has nothing for is "Not marked", never an
  absence, and a status is never inferred from missing work.
- Flags are derived, not stored: there is no flag history.
- **Leave-style delegation** (a manager delegating approval while away) is not built; HR's override covers an absent
  manager. Reusing leave's delegations would silently widen what those delegates may approve, so it needs a decision.
- Review lists are in-memory over a capped, date-windowed set of rows rather than paged in SQL; fine at this scale,
  revisit if one reviewer's reach grows to many thousands of days.
- Approving a day does not lock attendance; HR editing attendance afterwards only raises a flag.
- An **auto-checkout** is now distinguishable (`auto_closed`, ATTENDANCE_ARCHITECTURE.md §7.7): the attendance
  the timesheet reads already counts no worked time or overtime from it and reports its check-out as null
  (not recorded) until HR regularizes it. A timesheet `AUTO_CHECKOUT` / `REVIEW_REQUIRED` flag for it is still
  not applied.
- Custom activities are **not** gated by attendance: a meeting can be recorded whether or not the employee has
  checked in (attendance is shown beside the day, never used to block work).
- **My Work** is an employee self-service feature: the portal tab (`portal-work`) and the My Work routes use
  `employee_self_service.work.write`, which the default Employee role holds. The routes use
  `@RequireAnyPermission("employee_self_service.work.write", "projects.timer.write")`, so a role that already
  held `projects.timer.write` keeps working (the Projects workspace entry `projects-my-work` still uses it).
  Production roles are org data and `permissions:sync` never grants: after deploying, run
  `permissions:sync` and `menu:sync`, then grant `employee_self_service.work.write` to the Employee role **and
  to Super Admin** (which holds permissions as explicit grants) in Settings → Roles — until then the portal tab
  is hidden for anyone who does not hold it.
- An employee with timesheet history cannot be hard-deleted (409, "deactivate instead"); HR's code documents
  hard delete as "must always work" — this is a deliberate, reviewed exception.

## Delivery status

| PR  | Scope                                                                                                                                                        | Status          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | Foundation: schema + 3 migrations, `business-date`, `timesheets.rules`, `TimesheetDayService` (find-or-create + lock), docs                                  | **Implemented** |
| 2   | Task timer integration (pause/complete on `timer/stop`), status history, read endpoints, permission + menu, forgotten-timer sweep, My Timesheet, migration 4 | **Implemented** |
| 3   | Custom activities (categories, overlap, backdating, add/edit/delete screen)                                                                                  | **Implemented** |
| 4   | HR attendance on the day (every date), mismatch flags derived on read (no new table); reconciliation after approval moves to PR5                             | **Implemented** |
| 5   | Submit (day/week), two-level review (manager then HR, HR alone, HR override), return with reason, notifications, drift flag, review screens                  | **Implemented** |
| 5b  | Reopen an approved day, HR correction of a flagged timer, counts, per-employee report and CSV (employee and day)                                             | **Implemented** |
| 6   | Independent security/performance review and fixes, cross-organization and input tests, migration rehearsal, test guide                                       | **Implemented** |
| 7   | Approval delegation (needs a policy decision: reuse leave's delegations or a separate one)                                                                   | Not started     |
