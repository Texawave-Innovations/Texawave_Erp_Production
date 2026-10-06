# Attendance — Architecture

**Status: BACKEND IMPLEMENTED (no UI).** The backend described here is built: data model
(migration `20261005065109_add_hr_attendance`), calculation engine, self-service punches, HR view,
manual edit, correction workflow, two reports, and a dormant auto-checkout service. Sections 1–6
are the original design, kept for the reasoning. **§7 records what was actually built, every
deviation from this design, and every rule that is still unresolved.** Where §1–6 and §7 disagree,
§7 is correct.

Built on: `Docs/ATTENDANCE_LEGACY_PARITY.md` (legacy behavior), `Docs/ARCHITECTURE.md` and
`Docs/HOW_TO_ADD_A_MODULE.md` (this repo's existing conventions, verified against the live
`hr/leave-requests` and `hr/employees` modules).

---

## 1. Module boundary

Attendance is a submodule of HR, not a top-level module:

```
apps/api/src/modules/hr/attendance/
├── attendance.module.ts
├── attendance.controller.ts          # self-service: check-in/check-out, "my attendance"
├── attendance-records.controller.ts  # HR/manager: list/view/manual edit, team/own/all scope
├── attendance.service.ts             # check-in/out orchestration, duplicate-punch guard
├── attendance-calculation.service.ts # pure, unit-testable: status + hours + OT derivation
├── attendance.repository.ts          # the only place PrismaService is touched for attendance_records
├── attendance.service.spec.ts
├── attendance-calculation.service.spec.ts
├── corrections/
│   ├── attendance-corrections.controller.ts
│   ├── attendance-corrections.service.ts     # submit / approve / reject
│   ├── attendance-corrections.repository.ts
│   └── dto/
├── reports/
│   ├── attendance-reports.controller.ts
│   ├── attendance-reports.service.ts
│   └── attendance-reports.repository.ts
└── dto/
    ├── check-in.dto.ts
    ├── check-out.dto.ts
    ├── query-attendance.dto.ts
    └── manual-attendance.dto.ts
```

This follows the file-shape convention in `Docs/HOW_TO_ADD_A_MODULE.md` §2 (controller thin,
service holds business rules and resolves scope, repository is the only Prisma touchpoint,
`@OrgScoped()`/`@TeamScoped()` on every repository method). Two controllers, not one, because the
permission shape is genuinely different: self check-in/out needs no team-scope resolution at all
(an employee only ever acts on their own record, resolved the same way
`leave-requests.service.ts`'s `createForCurrentEmployee()` resolves the current employee), while
the HR/manager grid is `.own`/`.team`/`.all` scoped exactly like `leave-requests`/`employees`.

`attendance-calculation.service.ts` is split out deliberately: the legacy audit (§3-4 of
`ATTENDANCE_LEGACY_PARITY.md`) shows the single biggest source of legacy bugs was status/hours
logic duplicated and drifting across screens. Here it is one pure function module (date, shift,
sessions, holiday, leave, weekly-off → status + hours breakdown), unit-tested in isolation, called
identically by check-in/out, manual edit, correction approval, and reports. No caller is allowed
to hand-roll its own status derivation.

## 2. HR/platform entity reuse — no duplication

Attendance **reads, never owns**:

| Legacy concept                        | New platform/HR equivalent                                    | Notes                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hr/employees`                        | `Employee` (existing)                                         | via `EmployeeQueryService` (existing, used by leave-requests for `getCurrentEmployee()`)                                                                                              |
| shift start/end/target hours          | `Shift` (existing)                                            | existing model already has `startTime`/`endTime`/`isOvernight`/`workingMinutes` — a real, configurable shift definition, a strict improvement over legacy's hardcoded `SHIFT_CONFIGS` |
| which shift an employee works         | `ShiftAssignment` (existing)                                  | existing model already resolves effective shift per employee per date range                                                                                                           |
| `hr/holidays`                         | `Holiday` (existing)                                          |                                                                                                                                                                                       |
| weekly-off (legacy: hardcoded Sunday) | `WeeklyOffRule` (existing, `daysOfWeek: Int[]`)               | genuinely new capability vs. legacy — see §5 unresolved items                                                                                                                         |
| `hr/leaveApplications`                | `LeaveRequest` (existing)                                     | approved leave suppresses an expected-working-day exactly like legacy's `markLeaveDays`, but read live at status-derivation time instead of written back onto the attendance row      |
| users/orgs/roles/permissions          | platform layer (existing)                                     | no new auth system, no duplicated permission framework                                                                                                                                |
| audit trail                           | `AuditWriter` (existing, already used by every HR repository) | same pattern, not a new mechanism                                                                                                                                                     |

Attendance introduces net-new entities only for things that don't already exist: the day-level
attendance record itself, individual punch/session events, and the correction-request workflow.
See `Docs/ATTENDANCE_DATABASE_DESIGN.md`.

## 3. API/service boundaries

- **Self-service** (`attendance.controller.ts`): `POST /hr/attendance/check-in`,
  `POST /hr/attendance/check-out`, `GET /hr/attendance/mine` — mirrors the existing
  `apps/api/src/modules/employee-self-service/leave-requests/my-leave-requests.controller.ts`
  pattern (thin controller delegating to a service method that resolves "current employee" itself;
  client never supplies an employee id).
- **HR/manager view** (`attendance-records.controller.ts`): `GET /hr/attendance`,
  `GET /hr/attendance/:id`, `PATCH /hr/attendance/:id` (manual edit) —
  `@RequireScopedPermission("hr.attendance.read" | "hr.attendance.write")`, `.own`/`.team`/`.all`
  resolved in the service via `TeamContextService`, exactly like `employees`/`leave-requests`.
- **Corrections**: `POST /hr/attendance/corrections` (employee submits),
  `POST /hr/attendance/corrections/:id/approve|reject` (HR/manager decides) —
  `@RequireScopedPermission("hr.attendance_correction.approve")`, with the same self-approval
  block pattern already implemented in `leave-requests.service.ts`'s `decide()` (`.own` scope is
  seeded but denied in code, "exists only so the permission family is complete").
- **Reports**: `GET /hr/attendance/reports/daily-summary`,
  `GET /hr/attendance/reports/monthly-summary`, `GET /hr/attendance/reports/missing-punches`,
  `GET /hr/attendance/reports/overtime`, `GET /hr/attendance/reports/full-month-present` — read-only,
  `.own`/`.team`/`.all` scoped the same way as
  the records endpoint. (Monthly sign-off/lock — legacy §5.3 — is explicitly NOT included until
  the unresolved legacy behavior in `ATTENDANCE_LEGACY_PARITY.md` §1.3/§5.3 is confirmed; see §5.)

No controller calls Prisma directly, no service bypasses `attendance-calculation.service.ts` for
status/hours, no repository method lacks an `@OrgScoped()`/`@TeamScoped()` decorator — same rules
as every existing HR module.

## 4. Transaction boundaries

- Check-in/check-out: single transaction per call — read current open session state, validate,
  write the new/updated `attendance_record` + `attendance_session` rows, write the audit row. No
  cross-module transaction (shift/employee/holiday data is read-only input, not written).
- Correction approval: single transaction — update the correction-request row, upsert the
  affected `attendance_record`/sessions, write audit. Matches `leave-requests.repository.ts`'s
  `decide()` shape (one `$transaction` covering the request update and any side effect).
- No background job in this design writes across two employees' records in one transaction;
  processing endpoints (if any — see §5) operate one employee-day at a time, retried individually
  on failure, not as a single giant batch transaction, so a partial failure never requires a full
  rollback across unrelated employees.

## 5. Legacy compatibility decisions — resolved vs. deliberately NOT ported

**Resolved (will be reimplemented, mapped onto this platform's existing conventions):**

- Server-authoritative timestamps for check-in/out (DB `now()`, never trust a client-submitted
  instant) — legacy §2.4.
- Canonical single status/hours derivation function, no per-screen duplication — legacy §3, §4, §8.
- Correction approval must not fabricate a checkout from an unrelated session — legacy §5.2.
- Self-approval of one's own correction/approval request is blocked, mirroring
  `leave-requests.service.ts`'s existing `.own` pattern — legacy §5.1/§9 (legacy itself didn't
  clearly enforce this; this is adopting the platform's own established rule, not legacy's).
- Holiday precedence over Leave in status derivation — legacy §3.1, the one unambiguous
  precedence rule the audit found.

**Deliberately NOT ported as-is (flagged, not silently dropped):**

- **Face verification** (legacy §2.1) — client-side, browser-only face-api.js matching. Cannot
  exist as backend logic. Proposed: accept an optional photo/metadata field as an audit artifact
  only, with no server-side verification claim, OR omit entirely from the backend scope and leave
  it a pure frontend/UI concern for the later UI phase. **Needs a decision** — see §6.
- **Office Wi-Fi IP allowlist** (legacy §2.2) — hardcoded single IP in legacy. If ported, must
  become an organization-level configurable setting (list of allowed IPs/CIDRs, or dropped
  entirely in favor of a different location-verification strategy). **Needs a decision** — see §6.
- **Client-side-only late alerts** (legacy §7) — legacy has no real scheduled job; "porting" this
  faithfully would mean building the first real scheduled job for Attendance. Per the task's
  Phase 4-F instruction ("do not introduce new schedulers... without a verified requirement"),
  this is listed as a candidate, not committed. **Needs a decision** — see §6.
- **Two redundant auto-checkout implementations** (legacy §6) — which one, if either, is
  authoritative in production was not established by the audit. **Needs a decision** — see §6.
- **Monthly sign-off/lock workflow** (`Approved.tsx`, legacy §5.3) — not fully audited; unclear
  if anything downstream depends on it. Not included in this design until re-audited.
- **Weekly OT-vs-shortfall balancing report** (legacy §4.2) — confirmed display-only, not an
  authoritative ledger, in legacy. Can be reimplemented as a reporting view over the canonical
  hours data; not a stored/authoritative computation either way.

## 6. Unresolved decisions requiring sign-off before implementation

1. **Postgres schema-per-module** (`platform`/`hr`/...) — see `Docs/ATTENDANCE_DATABASE_DESIGN.md`
   §1. This is the primary reason this task stopped before writing code.
2. **Face verification** — drop from backend scope, or accept-and-store-only (no verification
   claim)?
3. **Location gating** — configurable IP allowlist, a different strategy, or dropped from backend
   scope for this phase (left as a UI/device concern)?
4. **Scheduled jobs** — is a real auto-checkout job and/or a real missing-punch alert job in scope
   for this phase, and if so, on what existing scheduling infrastructure (none was found to reuse
   yet in this repo — confirm whether one exists before any job is proposed)?
5. **Weekly-off vs. Holiday vs. Leave precedence when the new, richer `WeeklyOffRule` model is in
   play** (not just legacy's hardcoded Sunday) — the audit only confirms Holiday-beats-Leave;
   a three-way precedence involving a configurable weekly-off rule is new design, not legacy
   parity, and needs an explicit decision, per the task brief's own instruction not to invent a
   precedence rule.
6. **Monthly sign-off/lock** — in scope for this phase, pending a fuller `Approved.tsx` audit, or
   deferred entirely?
7. **Reports scope** — daily/monthly summary, missing-punch, and overtime reports are reasonably
   derivable from confirmed legacy behavior; confirm no additional report is expected before
   committing to this exact list.

---

## 7. As built (implementation status)

Code: `apps/api/src/modules/hr/attendance/`. Module: `AttendanceModule` (imported in `app.module.ts`).

### 7.1 Endpoints

| Method & path                                                             | Permission                                           | Notes                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /hr/attendance/check-in`                                            | `employee_self_service.attendance.punch`             | No body. Server time; IST business date. 409 `ALREADY_CHECKED_IN` if any session is open for the employee.                                                                              |
| `POST /hr/attendance/check-out`                                           | `employee_self_service.attendance.punch`             | No body. Closes the open session. 409 `NOT_CHECKED_IN` if none, or if a concurrent checkout won.                                                                                        |
| `GET /hr/attendance/mine?from&to`                                         | `employee_self_service.attendance.read`              | Own records only. Employee resolved from the JWT.                                                                                                                                       |
| `GET /hr/attendance?from&to&employeeId&status`                            | `hr.attendance.read` (scoped)                        | `from`/`to` required, max 62 days. `status` filters the stored status only.                                                                                                             |
| `GET /hr/attendance/:id`                                                  | `hr.attendance.read` (scoped)                        | 404 outside scope.                                                                                                                                                                      |
| `PATCH /hr/attendance/:id`                                                | `hr.attendance.write` (scoped)                       | HR manual edit: `status` and/or `sessions` (replaces the day's punches). `.own` is refused in code.                                                                                     |
| `POST /hr/attendance/corrections`                                         | `employee_self_service.attendance_correction.create` | Submit for own record. One request per date, whatever its status: a second one is 409 `CORRECTION_ALREADY_REQUESTED` (legacy rule; concurrent submits serialised by the employee lock). |
| `GET /hr/attendance/corrections` and `GET /hr/attendance/corrections/:id` | `hr.attendance_correction.read` (scoped)             | `.own` gives the employee's own list.                                                                                                                                                   |
| `POST /hr/attendance/corrections/:id/approve`                             | `hr.attendance_correction.approve` (scoped)          | Applies the correction in the same transaction. `.own` refused.                                                                                                                         |
| `POST /hr/attendance/corrections/:id/reject`                              | `hr.attendance_correction.approve` (scoped)          | `note` mandatory.                                                                                                                                                                       |
| `GET /hr/attendance/reports/daily?date`                                   | `hr.attendance_report.read` (scoped)                 | Every employee in scope employed on the date.                                                                                                                                           |
| `GET /hr/attendance/reports/monthly?month=YYYY-MM`                        | `hr.attendance_report.read` (scoped)                 | Per-employee counts by derived status, and totals.                                                                                                                                      |
| `GET /hr/attendance/reports/missing-punches?from&to`                      | `hr.attendance_report.read` (scoped)                 | New derived report. Open checkout on a past day, or stored PRESENT with no check-in.                                                                                                    |
| `GET /hr/attendance/reports/overtime?from&to`                             | `hr.attendance_report.read` (scoped)                 | New derived report. Overtime per employee and the days it was produced.                                                                                                                 |
| `GET /hr/attendance/reports/full-month-present?month=YYYY-MM`             | `hr.attendance_report.read` (scoped)                 | New derived report. Active employees; `fullMonthPresent` per the rule in the Full Month Present section. Read-only, nothing persisted.                                                  |

Route order matters: the corrections and reports controllers are registered before the attendance
controller, so `/hr/attendance/corrections` is never read as `:id`.

### 7.2 Permissions (18 added; catalogue 49 → 67)

Scoped (`.own`/`.team`/`.all`, always seeded together): `hr.attendance.read`, `hr.attendance.write`,
`hr.attendance_correction.read`, `hr.attendance_correction.approve`, `hr.attendance_report.read`.
Self-service (flat): `employee_self_service.attendance.punch`, `employee_self_service.attendance.read`,
`employee_self_service.attendance_correction.create`.

Default roles (`packages/database/prisma/permissions/default-roles.ts`):

- **HR Manager**: `.all` on all five scoped permissions.
- **Team Lead**: `.team` read-only (attendance, corrections, reports). No write, no approve.
- **Employee**: the three self-service permissions and `hr.attendance_correction.read.own`.

No role receives `.team` write or approve. This matches the open decision already taken for leave.

### 7.3 Scope and isolation

- Records are reached through the employee: `.team` uses `employee.teamId`, `.own` uses
  `employee.userId`, both through `teamWhere()`. Repository reads also carry `organizationId`.
- Every repository method is `@OrgScoped()` or `@TeamScoped()`. Write paths take a per-employee
  advisory lock (`pg_advisory_xact_lock(org, employee)`).
- Outside scope is 404, not 403. Cross-organization access is 404 (verified in E2E).
- Self-approval is refused in two ways: the requester is the decider, or the employee linked to the
  request is the decider. Both return 403 `SELF_APPROVAL_FORBIDDEN`.

### 7.4 Calculation (single source)

All derived status and hours come from `services/attendance-calculation.service.ts`
(`AttendanceCalculationService.calculate`). Calendar facts are resolved by the pure
`services/attendance-day-resolver.ts`, and turned into views by `services/attendance-day-view.service.ts`.
Controllers, repositories, reports and corrections never compute a figure themselves.

Precedence, decided: **Holiday > Weekly Off > Leave > stored status.**

- Holiday: organization-wide, or the employee's work location.
- Weekly off: the **most specific** applicable rule decides for the day: team, then location, then
  organization. The narrower rule overrides the broader one even if the broader one lists the weekday.
- Leave: APPROVED requests only.
- Stored ABSENT: zero worked minutes, shortfall = target. Stored HALF_DAY: worked = target ÷ 2, shortfall = the other half (legacy pendingHrs), no OT.
- Punched day: worked = min(actual, target); overtime = max(actual − target, 0);
  shortfall = max(target − actual, 0).
- No sessions and nothing stored: `NOT_MARKED`, shortfall = target. This is never persisted as absent.
- Holiday and leave days keep punched time; overtime and shortfall are 0.
- Weekly-off days cap worked at target and report no overtime (legacy Sunday rule, generalised).
- Target: an employee-level shift assignment overrides a team-level one. With neither, target is
  null, and only punched time is reported (no OT, no shortfall).
- An open session counts time up to the server's `asOf`.
- Timezone: Asia/Kolkata. A punch belongs to the IST date it starts on.

### 7.5 Corrections

States: `SUBMITTED` → `APPROVED` or `REJECTED`, both terminal. A decision is a conditional update
(`status = 'SUBMITTED'`), so only one decision can ever be written. Approval runs in one
transaction: decision row, punch change, audit row.

Applicability (`services/attendance-correction-planner.ts`). Requests that do not fit are refused, not guessed:

| Type             | Changes                              | Requires                  |
| ---------------- | ------------------------------------ | ------------------------- |
| MISSED_CHECK_IN  | creates the day's first session      | day has no punches        |
| MISSED_CHECK_OUT | closes the single open session       | exactly one open session  |
| INCORRECT_TIME   | first check-in and/or last check-out | the punch it moves exists |
| LATE_ARRIVAL     | first check-in only                  | a session exists          |
| EARLY_DEPARTURE  | last check-out only                  | a session exists          |

A correction never fabricates a checkout from an unrelated session. Times must fall on the requested
IST date, and the resulting day must be ordered and non-overlapping, or nothing is written.

### 7.6 Reports

All reports read the shared day views. Report rules (what a row means) live in
`reports/attendance-report-rules.ts`. No report computes a status or an hour.

- **Daily** (`/reports/daily?date`): every in-scope employee employed on the date. Each row is the
  shared derived view, so an unmarked day shows `NOT_MARKED`.
- **Monthly** (`/reports/monthly?month`): per in-scope employee employed during the month. Counts by
  derived status, and totals for worked, overtime and shortfall. Only days up to and including today
  (IST) are counted.
- **Missing punches** (`/reports/missing-punches?from&to&employeeId&teamId&type`). **New derived
  report, not legacy parity** (legacy defines no such report). Definition:
  - `MISSING_CHECKOUT`: the day has an OPEN session and its business date is before today (IST).
    Applies on any calendar state: a punch that exists is a punch problem even on a holiday.
  - `MISSING_CHECK_IN`: the derived status is PRESENT and there are no punches. That is only
    possible when HR stored PRESENT with no check-in.
  - Excluded: an unmarked day (`NOT_MARKED`) is never a missing punch. Holiday, weekly-off and leave
    days with no punches are excluded because their status is not PRESENT. Explicit ABSENT and
    HALF_DAY are excluded. Future dates are excluded.
  - "Checkout without check-in" is not representable: every session is created with a check-in.
  - Employee status is not filtered. Employment dates bound the population, and an exited
    employee's open session is exactly what must be found.
- **Overtime** (`/reports/overtime?from&to&employeeId&teamId`). **New derived report.** One row per
  employee in scope with the days on which the calculation produced overtime above zero. There is no
  second formula: the rows come from the calculation's `overtimeMinutes`. Holiday, weekly-off, leave,
  half-day and absent days produce 0 overtime and therefore no row. A monthly total is a range of
  one month.

- **Full Month Present** (`/reports/full-month-present?month=YYYY-MM&employeeId&teamId`). **New
  derived report, not legacy parity.** Legacy `src/modules/hr/FMP.tsx` shows a P/L/H/A grid and
  states no qualifying rule, so the rule below is production's. Definition
  (`reports/full-month-present-rules.ts`):
  - Population: ACTIVE employees in scope employed at any point in the month. Legacy also lists only
    active employees (`status` active or missing); RESIGNED, TERMINATED and INACTIVE are not listed.
  - `fullMonthPresent` requires all of: the month is complete (its last day is before today, IST);
    the employee was employed on the 1st and on the last day; and every working day is `PRESENT`.
    Working days are every counted day that is not `HOLIDAY` or `WEEKLY_OFF`. There must be at
    least one working day.
  - `ABSENT`, `HALF_DAY`, `ON_LEAVE` and `NOT_MARKED` each disqualify. A missing check-out on a past
    day keeps the derived status `PRESENT`, so it does not disqualify. The missing-punch report flags it.
  - Every status comes from the shared day views. The report adds no status or hour rule.
  - Deviations from legacy, taken on purpose: legacy counts `Half Day` as `P` (production keeps
    `HALF_DAY` separate and disqualifies it); legacy shows `A` for any unmarked day including future
    dates (production counts through today only); legacy `FMP.tsx` does not treat Sundays as off days,
    and marks `H` only for an explicit `Holiday` or `Week Off` status or a holiday-list date
    (production uses the weekly-off rules). The legacy Documents tab matrix (`hrComputations.ts`) does
    treat Sundays as `H`, so the two legacy views disagree.
  - Open business decisions: mid-month joiners and leavers are listed but never qualify, because the
    rule does not define a partial-month qualification. Whether `HALF_DAY` should qualify, and whether
    a missing check-out should disqualify, are unresolved. Current behavior follows the production
    status rules.
  - Pagination is over employees. `fullMonthPresent` is decided per row, so it does not depend on the
    page.

All the new reports (missing-punch, overtime, full-month-present) use the existing
`hr.attendance_report.read` permission (`.own`/`.team`/`.all`). A
separate permission would be redundant with the daily and monthly reports. Pagination is over
employees. The missing-punch `type` filter is applied to the rows of the page, so a page can hold
fewer than `limit` rows when a type is requested.

### 7.7 Auto-checkout: scheduled in the ERP API

**Mechanism.** `services/attendance-auto-checkout.scheduler.ts` is the ERP's single scheduler for this
job: one in-process `setInterval`, every 5 minutes (`AUTO_CHECKOUT_INTERVAL_MS`), started in
`onModuleInit`, cleared in `onModuleDestroy`, unref'd so it never holds the process open, and guarded
against overlapping runs. A failed run is logged and retried on the next tick.

**Why this mechanism.** `apps/api` is a long-running NestJS server (`app.listen`), deployed by AWS
CodeBuild (`deployment/api/codebuild`) and run locally by docker-compose. Vercel cron
(`vercel.json`) and Firebase scheduled functions run only in their own platforms, so neither can run
here. The repo had no scheduler dependency, so the smallest production-safe option is a timer in the
process that already owns the database connection. No new package was added.

**Multiple instances.** Each instance may run the job. That is safe: every write is conditional on
`check_out_at IS NULL`, so one instance wins each session, and only the winner writes its audit row.

**Authoritative rule (the ERP's own).** `closeAt = checkInAt + targetMinutes`, where the target is the
shift for the record's IST business date (employee assignment over team assignment, §7.4). A session is
closed AT `closeAt` (the instant it became due), not at the time the job happened to run.

Eligibility and outcomes:

- Only sessions with no check-out are considered.
- A session whose target has not elapsed by `asOf` stays open (`notDue`).
- A session with no resolvable shift target stays open (`noTarget`). Closing it would mean inventing a
  duration.
- A close time at or before check-in is refused, never written.
- At most 500 open sessions per organization per run. The rest are picked up on later runs, which is
  safe because the rule is idempotent.

**Legacy evidence, and why this rule.** Legacy has two implementations that DISAGREE:

- Firebase `autoCheckoutAt7pm` (`functions/src/index.ts`): a fixed 19:00 IST.
- Vercel `api/auto-checkout.ts`: each session closed after its own shift target. Its header says this
  replaced the fixed cutoff because the fixed cutoff "silently truncated any late-starting shift".

The Vercel comment is the later, more specific decision, and the ERP has real shift targets, so the
shift-relative rule is used. This is a choice made for the new ERP, not a resolution of legacy
production authority. Legacy's duplication is recorded, not silently resolved. Legacy's Vercel
caveat (runs once a day, so detection lag up to 24 h) does not apply here: the ERP runs every 5 minutes.

**Audit.** Each close writes one `attendance_session` / `auto_checkout` row as a SYSTEM actor
(`actorType = system`, no user), in the same transaction as the change. Its reason is "Closed
automatically at check-in plus the shift target". Already-closed sessions are never audited.

**Deviation from legacy.** Legacy's Firebase job closed at a fixed time, and the Vercel job closed at
shift target but only once a day. The ERP closes at shift target, checked every 5 minutes.

### 7.8 Unresolved business rules (not implemented; evidence recorded)

Each item was searched in the legacy repo, the current HR and Attendance code, and the docs.

- **Monthly sign-off / lock.** Legacy `src/modules/hr/Approved.tsx` writes `hr/attendanceApprovals`
  with status `pending` / `approved` / `rejected`. Nothing reads that node to lock attendance, so there
  is no lock effect. The stored payload is the monthly row, which includes payroll-coupled fields
  (pay totals, super-save state). A backend workflow would need a payroll decision first. **Not
  implemented.**
- **Late alerts.** Legacy `src/modules/hr/useLateAttendanceAlerts.ts` raises check-in alerts at
  10:30 IST and check-out alerts at 20:30 IST. It runs client-side and sends notifications. The ERP has
  no notification delivery. **Not implemented** (requires notification infrastructure, which is out of
  scope).
- **Face verification.** Legacy `src/utils/faceVerification.ts` (client-side face-api models). Requires
  biometric infrastructure. **Not implemented, out of scope.**
- **Office IP gating.** Legacy `src/services/attendanceService.ts` compares the caller's public IP, fetched
  from third-party echo services, with a hard-coded office IP. Requires network infrastructure. **Not
  implemented, out of scope.**
- **Grace period.** No grace, late-threshold or tolerance constant exists in legacy calculation or
  attendance code. **No rule exists; none implemented.**
- **Break rules.** No break deduction exists in legacy (lunch is explicitly not deducted, §2 of the
  parity doc). **No rule exists; none implemented.**
- **Overtime thresholds.** Legacy overtime is `max(actual − target, 0)`, with no threshold. **No
  threshold rule exists; none implemented.**
- **Overnight shifts.** The HR `Shift` model supports `is_overnight`, and legacy computes overnight
  sessions by time-of-day (`functions/src/attendanceMath.ts`). Punches are attributed to their check-in
  IST date. Manual edit and corrections still require every punch on the record's date. **Partially
  supported; the cross-midnight edit and correction rules are open.**
- **Overtime on holiday, weekly-off and leave days.** Legacy sets pending to 0 and does not state
  overtime. The ERP reports 0. **Decided by the user; not legacy-verified.**
- **Half-day shortfall.** **Resolved from evidence in this round.** Legacy sets `pendingHrs = target ÷ 2`
  for Half Day (`functions/src/attendanceMath.ts`). The ERP previously reported 0; it now reports
  target − worked, which is the same half.
- **Team-level write and approve grants.** Granted to no role, pending a decision (same as leave).

### 7.9 Deviations from §1–§6 and from legacy

- Derived hours (worked, overtime, shortfall) are **not persisted**. §2.1 proposed storing them. They
  are computed on read by one service, so nothing can drift.
- `attendance_records` has no first/last punch, hours, or `is_regularized` columns (a consequence of the above).
- `attendance_records.status` stores only explicit PRESENT / ABSENT / HALF_DAY (NULL otherwise).
  Holiday, weekly-off, leave and not-marked are derived. Legacy stored `Week Off` and `Leave` as statuses.
- Correction state is `SUBMITTED`, not leave's `PENDING`, as the brief specified.
- HR manual edit **hard-deletes** the replaced punches and writes their full before-state to the audit
  row. §2.2 said "no delete". The user confirmed this decision.
- The "at most one open session per employee" guard is a per-employee advisory lock plus a service
  check, not a DB constraint. The DB enforces one open session per record (partial unique index).
- Hard-coded Sunday is replaced by weekly-off rules. A day is off only if a rule says so.
- Half Day shortfall now equals legacy `pendingHrs` (target − worked). An earlier round reported 0.
- Auto-checkout closes at shift target, every 5 minutes. Legacy used a fixed 19:00 IST (Firebase) or
  a once-a-day shift-relative job (Vercel).
- Self check-in and check-out are **not** audited (not in the brief's audit list). Manual edit,
  correction submit, approve, reject and auto-checkout are.
- Attendance reads Holiday, WeeklyOffRule, LeaveRequest and ShiftAssignment through Prisma directly
  (read-only, org-scoped), because those modules export no read service. This is a module-boundary
  exception to review.

### 7.10 Known limitations

- List endpoints return only days that have a record. Calendar-only days (holiday, weekly off, leave)
  appear in the daily report, not in the list or in `mine`.
- The `status` filter applies to the stored status only. Derived statuses are not filterable.
- Maximum range is 62 days for lists and reports.
- Sessions crossing IST midnight are rejected by manual edit and by corrections.
- Auto-checkout processes 500 open sessions per organization per run.
- Each process runs its own timer; with several instances, runs overlap harmlessly.

### 7.11 Test coverage (actual, this round)

- Unit: attendance 89 across 5 files. Calculation, resolver, correction planner, auto-checkout (pure
  rule, service, scheduler), report rules (missing-punch definition and overtime through the real
  calculation). Whole API unit suite: 459/459.
- E2E, punches and corrections: `hr-attendance.e2e-spec.ts`, 25.
- E2E, reports: `hr-attendance-reports.e2e-spec.ts`, missing punches and overtime, including
  authorization, scope, cross-org denial, and holiday, weekly-off, leave and half-day exclusions.
- E2E, auto-checkout: `hr-attendance-auto-checkout.e2e-spec.ts`, open session closed, closed session
  unchanged, idempotency, multiple employees, not-due, no shift target, audit as system actor, no HTTP
  endpoint, multiple organizations.
- Whole backend E2E: 620/620 (567 baseline + 53 Attendance).
- No separate integration suite. DB CHECKs, the partial unique index and FK behaviour are covered
  only indirectly through E2E.
