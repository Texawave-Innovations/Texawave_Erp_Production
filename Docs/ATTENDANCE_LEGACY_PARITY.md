# Attendance Module — Legacy Behavior Reference (TexaWave_ERP)

**Source repo**: `D:\New folder\TexaWave_ERP` (React/Vite/Firebase, read-only audit)
**Status**: Phase 1 audit complete. This document records only behavior directly observed in
code, with file:line citations. Anything not traceable is flagged **"unresolved/ambiguous."**
No Attendance backend code has been written against this yet — see `Docs/ATTENDANCE_ARCHITECTURE.md`
and `Docs/ATTENDANCE_DATABASE_DESIGN.md` for the design built on top of it, both currently pending
architectural sign-off before implementation starts.

**Correction to the original brief**: this app does not use Firestore for attendance. All
attendance data lives in the **Firebase Realtime Database (RTDB)**, read/written via
`firebase/database` (`ref`, `get`, `set`, `update`, `onValue`, `serverTimestamp`). Every path
below (`hr/attendance/...`, `hr/holidays/...`, etc.) is an RTDB path, not a Firestore collection.
This has structural implications for a SQL port: the legacy schema is a tree keyed by date and by
employee, with no real relational integrity — the new Postgres schema must be reverse-engineered
from write-site shapes, not read off a Firestore schema.

---

## 1. Data Model / Storage Structure (RTDB)

### 1.1 Attendance record path and dual-key problem

- Path: `hr/attendance/{date:YYYY-MM-DD}/{key}` where `{key}` is **either** the employee's
  Firebase push key (`hr/employees` node id, aka `user.firebaseKey`) **or** the employee's human
  code (e.g. `"EMP0001"`). Both can exist for the same employee/day simultaneously — this is a
  known, explicitly-handled legacy defect.
  - `src/services/attendanceService.ts:1-18` — module header explains the dual-key history and
    why `attendanceKeysFor`/`writeAttendance`/`readAttendance` were introduced as the single
    write/read chokepoint.
  - `attendanceKeysFor()` (`attendanceService.ts:48-53`) returns the de-duplicated key set
    `[employeeId, id]` for a given employee.
  - `writeAttendance()` (`attendanceService.ts:61-71`) always fans a payload out to **every** key
    via `batchUpdate`, as a per-field merge (never a destructive `set()`), so unrelated fields and
    the "other" key's session history are preserved.
  - `readAttendance()` (`attendanceService.ts:74-83`) reads both keys in parallel; first existing
    one wins (id/push-key takes precedence when both exist).
  - `pickRealRecord()` in `src/modules/hr/Attendance.tsx:109-117` is the HR-grid-side version of
    this same dedup logic, with an extra defense: a stub object like `{ lateCheckinNotified: true
}` (written by the late-alert hook, §7) is "truthy" but must not be mistaken for a real
    attendance record — `hasData()` checks for `status`/`checkIn`/`sessions` before treating an
    object as real.
  - Not every write path goes through `writeAttendance()` — Holiday auto-apply
    (`Attendance.tsx:416`, `Holiday.tsx:99`) uses a raw `set()` to a single key (`emp.id`, the
    push key) only. Holiday auto-marking does NOT dual-write, unlike check-in/out/regularization/
    admin-edit.

### 1.2 Attendance record field shape (as actually written)

Observed fields across all writers (`attendanceService.ts`, `Attendance.tsx`,
`Regularization.tsx`, `Holiday.tsx`, `functions/src/index.ts`, `api/auto-checkout.ts`):

| Field                                                           | Type                                                                                                                                                                                                 | Meaning                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `employeeId`                                                    | string                                                                                                                                                                                               | human code, e.g. "EMP0001" — stamped on every write                                                  |
| `employeeName`                                                  | string                                                                                                                                                                                               | denormalized display name                                                                            |
| `date`                                                          | string YYYY-MM-DD                                                                                                                                                                                    | stamped on every write                                                                               |
| `status`                                                        | `'Present'\|'Absent'\|'Half Day'\|'Leave'\|'Holiday'\|'Week Off'`                                                                                                                                    | authoritative status (§3)                                                                            |
| `shiftType`                                                     | `'day'\|'sunday'` (UI type also lists `'night'`, never actually produced)                                                                                                                            | §4                                                                                                   |
| `checkIn` / `checkOut`                                          | string, 12h label e.g. `"9:15 AM"`                                                                                                                                                                   | legacy/top-level copy of first/last session times                                                    |
| `sessions`                                                      | array of `{checkIn, checkInMs, checkOut?, checkOutMs?, deviceCheckInMs?, deviceCheckOutMs?, lat?, lng?, checkOutLat?, checkOutLng?, locationMode?, regularized?, regularizationId?, source?, type?}` | **the real source of truth** for multiple check-in/out pairs per day (e.g. lunch breaks)             |
| `totalWorkedMs`                                                 | number                                                                                                                                                                                               | running sum of worked milliseconds                                                                   |
| `workHrs`, `otHrs`, `pendingHrs`, `actualWorkHrs`, `totalHours` | numbers (decimal hours)                                                                                                                                                                              | §4 formulas; `totalHours` always mirrors `workHrs`                                                   |
| `lunchIn`, `lunchOut`                                           | string 12h label                                                                                                                                                                                     | only used by the HR manual-edit UI; not written by self check-in                                     |
| `createdAt`, `updatedAt`, `checkOutAt`                          | number (ms) or `serverTimestamp()`                                                                                                                                                                   | audit timestamps                                                                                     |
| `clockAnomaly`, `clockSkewMs`                                   | bool / number                                                                                                                                                                                        | device-vs-server clock mismatch flag (§2.4)                                                          |
| `autoCheckedOut`                                                | bool                                                                                                                                                                                                 | set by the auto-checkout job/endpoint (§6)                                                           |
| `adminEdited`                                                   | bool                                                                                                                                                                                                 | set when HR edits a record via `Attendance.tsx`                                                      |
| `regularized`, `regularizedBy`, `regularizedAt`                 | bool/string/number                                                                                                                                                                                   | set on approved regularization (§5); reset to `false`/`null` if HR later manually edits the same day |
| `notes`                                                         | string                                                                                                                                                                                               | holiday name, or "Worked Xh Ym on <status>" annotation                                               |

### 1.3 Other RTDB paths referenced

- `hr/employees` — employee master (push key = node id; `employeeId` field = human code;
  `status` field `'active'|'inactive'` gates most queries).
- `hr/leaveApplications` — the **live** leave-request path (status `'pending'|'approved'|
'rejected'`, fields `fromDate`/`toDate`/`employeeId`/`employeeFirebaseKey`/`type`/`days`).
  `Attendance.tsx:344-348` explicitly notes `hr/leaves` is a **dead/legacy path nothing writes to
  anymore** — the new implementation's analog is the existing `LeaveRequest` model, not a new
  concept.
- `hr/holidays/{YYYY-MM}/{id}` — holiday definitions: `{id, date, name, departments:
string[] | ['All'], isRecurring}`. `departments` scoping is dead in the UI (always `['All']`);
  the existing `Holiday` model's `workLocationId` scoping is a reasonable equivalent, not a direct
  port.
- `hr/locationPrivilege/{pushKey}` → `'office'|'remote'` — per-employee override of the
  office-Wi-Fi check (§2.2). Default when unset is `'office'`. Note: `src/modules/hr/Shifts.tsx`
  is actually this Location Privilege screen, not a shift-definition screen — there is no
  shift-configuration UI anywhere in the legacy app; shift parameters are hardcoded (§4).
- `hr/regularizationRequests/{id}` — regularization workflow records (§5).
- `hr/attendanceAlerts/{date}/{empId}` — dedup flags for the late-attendance notifier
  (`lateCheckinNotified`, `checkoutNotified`); deliberately **not** under `hr/attendance` so it can
  never pollute real attendance data.
- `hr/attendanceApprovals/{employeeFirebaseKey}/{month}` — a **separate, monthly, per-employee
  sign-off** workflow (`src/modules/hr/Approved.tsx`), distinct from day-level Regularization.
  Status values `'pending'|'accepted'|'declined'`, gated to `isAdmin`. **Unresolved/ambiguous**:
  downstream effect of "accepted"/"declined" (e.g. payroll gating) not fully traced — needs a
  dedicated follow-up read of `Approved.tsx` in full before this is ported.
- `users/{key}` — maps a Firebase auth/user key to `employeeId`, used for notification targeting.

---

## 2. Check-In / Check-Out Flow

Canonical implementation: `src/services/attendanceService.ts` `checkIn()` (241-323) and
`checkOut()` (333-428). Three screens call into these same functions, not independent logic.

### 2.1 Trigger

- Employee clicks Check-In/Check-Out, which opens `CameraVerifyModal` for **face verification**
  (`src/utils/faceVerification.ts`, not fully traced) and GPS capture, then calls `onVerified(loc)`.
- GPS (`lat`/`lng`) is captured and stored but is **informational only** — no geofence radius
  check exists. The real location gate is the office-Wi-Fi IP check (§2.2).
- Face verification is a client-side gate before `onVerified` fires. **Unresolved**: exact
  algorithm/threshold not verified in this pass — a Node backend cannot replicate client-side
  face-api.js matching; this will likely need to be dropped or re-architected as a
  photo-capture-only audit trail, not ported as-is. Flagged as an open decision in
  `ATTENDANCE_ARCHITECTURE.md`.

### 2.2 Office Wi-Fi / network gate

- `assertOnOfficeWifi()` (`attendanceService.ts:146-154`): fetches the caller's public IP via
  ipify, rejects unless it matches a hardcoded allowlist `OFFICE_PUBLIC_IPS = ['115.96.5.24']`
  (line 116). GPS geofencing was explicitly tried and abandoned (comment 99-108: browsers can't
  read Wi-Fi SSID, GPS accuracy unreliable).
- Skipped entirely if `hr/locationPrivilege/{pushKey}` is `'remote'`; default is `'office'`
  (strict) when unset.
- Explicitly documented in legacy code as fragile (a single hardcoded IP). The new backend should
  make this an organization-level setting, not a hardcoded constant.

### 2.3 Duplicate-punch prevention

- `enforceCheckGuards()` (180-216) re-reads the **live** record immediately before writing (not
  possibly-stale client state) to avoid a race from double-tap/retry.
- `MIN_ACTION_INTERVAL_MS = 10_000` (10s, line 233): same action repeated within 10s throws
  `DuplicateActionError`.
- Checking in again while already checked in (open session, no `checkOutMs`) is **not** blocked
  beyond the 10s window — the legacy app does not enforce "must check out before checking in
  again" as a hard rule. New implementation should confirm this is still the intended behavior
  before tightening it.
- Checking out with no open session throws a plain error.

### 2.4 Server-authoritative time / clock-skew detection

- `checkInMs`/`checkOutMs` always come from Firebase's `serverTimestamp()`, never device time.
  Device time is stored separately (`deviceCheckInMs`/`deviceCheckOutMs`) for audit only, never
  used in hours/OT math.
- If server-vs-device skew exceeds `CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000` (5 min), the record
  is flagged (`clockAnomaly: true`, `clockSkewMs`) and hours are re-derived from the corrected
  instant — the check-in itself is **never rejected** for clock skew, only flagged.

### 2.5 What gets written

- First check-in of the day: creates the record with `status: 'Present'`, `sessions: [newSession]`.
- Subsequent check-ins same day (e.g. after lunch): appends to `sessions[]`.
- Check-out: closes the last open session, recomputes hours via `computeAttendanceHours` (§4.1).
- All writes are merges via `writeAttendance()`, fanned out to both dual keys.

### 2.6 `markLeaveDays` — leave-approval side effect on attendance

- `attendanceService.ts:443-476`. Called only on leave **approval** (never rejection).
- For every date in `[fromDate, toDate]`, if the day does NOT already have a real check-in, writes
  `status: 'Leave'`. A day the employee actually worked is never overwritten.

---

## 3. Attendance Status Calculation & Precedence

There is **no single server-side "compute status" function** in the legacy app — status is a mix
of a stored `status` field plus client-side derivation, and **different screens compute precedence
slightly differently**. Recommendation: the new backend should implement exactly ONE canonical
precedence function server-side (below), not reproduce every screen's drift.

### 3.1 HR grid's precedence (`Attendance.tsx:922-940`, `getEmployeeAttendanceStatus`)

1. Record's own `date` mismatch with the viewed date → `'Not Marked'`.
2. **Holiday wins outright** — checked before leave.
3. **Leave checked next** (approved range covering the date, from `hr/leaveApplications`).
4. Otherwise `getDayPresenceStatus()` (`otBalancing.ts:519-534`) decides Present/Absent/None:
   real check-in required for Present; explicit `Absent` or (no status + past date) → Absent.
   5/6/7. Present/Absent short-circuit; a `Present` status with no real check-in falls through to
   `'Not Marked'` rather than a false Present; otherwise raw stored `status` (where `'Half Day'`
   and `'Week Off'` surface) or `'Not Marked'`.

**Answer to "weekly-off + leave + holiday same day — which wins"**: **Holiday wins over Leave**
in this precedence chain. There is no separate automatic "Week Off" _detection_ competing in this
chain — see §3.2: weekly-off (Sunday) is realized by auto-writing a `status: 'Holiday'` record,
not a distinct `'Week Off'` status. `'Week Off'` as a status value exists only as a manual
admin-picked option.

### 3.2 Weekly-off is auto-generated Holiday records, not a computed flag

- `Holiday.tsx:58-121` and `Attendance.tsx:387-421` both auto-write `status: 'Holiday'` for every
  active employee on every Sunday (local-date Sunday check, not UTC — see §10.7), and for any
  custom `hr/holidays` entry.
- Only writes if no attendance record already exists for that employee/date — a real Sunday
  check-in (voluntary OT) is never clobbered.
- This auto-write is single-key only (`emp.id` push key) — does NOT dual-write like
  `writeAttendance()` does.
- **Unresolved/ambiguous**: the entire legacy app hardcodes Sunday as the only weekly-off day.
  There is no per-org/per-shift configurable weekly-off pattern in the legacy system — the
  existing `WeeklyOffRule` model in the new platform (with `daysOfWeek: Int[]`) is **new,
  intentional capability beyond legacy parity**, not a port. Document this explicitly as "new
  behavior" when implementing, and decide the holiday-vs-leave-vs-weekly-off precedence using the
  new richer model (holiday wins is the only directly verified legacy rule; its interaction with a
  true multi-day weekly-off rule is not something legacy code had to resolve, since legacy only had
  Sunday-as-holiday).

### 3.3 `getDayPresenceStatus` — canonical Present/Absent rule (`otBalancing.ts:499-534`)

Introduced to fix a real bug (HR showed Present, employee portal showed Absent, same day).
Key rule: **`status` is authoritative** — a record marked `'Present'` stays `'Present'` even if
computed hours are 0. Hours drive Full/Half/Short/OT breakdown but never override Present/Absent.

### 3.4 `Absent` semantics

- Explicit `status: 'Absent'` always forces zero hours regardless of any stray punch data.
- Admin manually marking Absent clears `checkIn/checkOut/lunchIn/lunchOut` (intentional, per
  inline comment).
- An unmarked past working day is classified Absent **for display only** — no cron/background job
  was found that persists `status: 'Absent'` for missed days. This is purely a UI-computed
  inference at read time in the legacy app.

---

## 4. Working Hours / Overtime / Shift Constants

**All shift parameters are hardcoded in source**, not configurable per-org or per-shift via any
admin UI in the legacy app. Source of truth: `otBalancing.ts:15-28`:

```
SHIFT_CONFIGS = {
  day:    { name: 'Day Shift',    start: 10.0, end: 18.5, targetHours: 8.0 },
  sunday: { name: 'Sunday Shift', start: 9.0,  end: 13.0, targetHours: 4.0 },
}
```

Mirrored independently (manually kept in sync, by the legacy team's own admission) in
`functions/src/attendanceMath.ts:12-15` and `api/auto-checkout.ts:109`.

- **Shift type derivation**: stored `shiftType` wins; else `date.getDay() === 0 ? 'sunday' :
'day'`. No "night shift" logic is actually implemented despite a `'night'` type existing in a
  TS union — it's dead code.
- **No grace period / late-arrival penalty logic in the core hours calculator.** The only "late"
  computation is a cosmetic, display-only label vs a hardcoded 10:00 AM reference
  (`Attendance.tsx:1362-1370`) — never written back, never affects status or pay. **No grace
  period tolerance constant exists anywhere in legacy code.**
- **No explicit break/lunch deduction formula.** `lunchIn`/`lunchOut` fields exist on a legacy
  single-session calculator but are accepted and never subtracted. The real break mechanism is the
  `sessions[]` array: checking out for lunch and back in creates two sessions, and
  `computeAttendanceHours` sums only session durations, naturally excluding the gap.

### 4.1 Canonical hours formula — `computeAttendanceHours()` (`otBalancing.ts:383-497`)

Precedence for `actualWorkHrs` (first that applies):

1. `status === 'Absent'` → everything 0.
2. `sessions[]` present → sum each `(checkOutMs - checkInMs)` (or parsed-decimal fallback,
   handling overnight by +24h if `checkOut < checkIn`). An open session on today/a past date
   accrues live elapsed time by default (`includeLiveSession`).
3. Else legacy top-level `checkIn`+`checkOut` strings → `calculateWorkHours()`.
4. Else stored `totalWorkedMs` → hours = ms/3.6e6.
5. Else a stored legacy scalar hours field (only if `0 < value < 24`) — last resort.

From `actualWorkHrs`, derive the rest **by status**:

- `Half Day` → `workHrs = pendingHrs = target/2` fixed; `otHrs = 0` always.
- `Leave`/`Holiday`/`Week Off` (non-working) → `pendingHrs = 0` always; hours actually clocked
  still count toward `workHrs`/`otHrs`.
- `sunday` shift → `workHrs = min(actual, target)`, `otHrs = 0` **always** (Sunday never earns
  OT), `pendingHrs = max(0, target - actual)` unless non-working.
- `day` shift (default) → `workHrs = min(actual, target)`, `otHrs = max(0, actual - target)`,
  `pendingHrs = max(0, target - actual)` unless non-working.

### 4.2 Weekly OT-vs-shortfall balancing (`getWeeklyOtBalance`, `otBalancing.ts:563-676`)

Pure display-only, not persisted: matches each day's shortfall against earlier-day OT pool
(oldest-first). Shortfall only applies to `Present`/`Half Day`. Sunday days always zero both
`otHrs`/`pendingHrs`. **Not an authoritative ledger** — if payroll needs "OT offsets shortfall,"
that logic needs fresh design in the new backend, this is reporting only.

### 4.3 Overnight shift / date-boundary handling

- Within a session: `checkOut < checkIn` (decimal hours) → treat as crossing midnight, +24h.
- `getEpochMs()` supports an explicit `rolloverFrom` reference hour for Regularization's
  next-day checkout placement.
- All time comparisons are anchored to **Asia/Kolkata (IST)** explicitly, never device-local time
  — called out repeatedly as a deliberate fix for misconfigured device timezones. **This is a
  single-country, single-timezone app with no multi-timezone support anywhere.**
- **No true overnight _shift definition_ is supported** — only the single-session midnight
  rollover exists; `SHIFT_CONFIGS` has no shift whose scheduled start/end crosses midnight.
  **Unresolved/ambiguous**: genuine night-shift definitions are new design, not legacy parity.

---

## 5. Manual Entry / Regularization / Correction Workflow

### 5.1 HR direct edit (`Attendance.tsx`, `markAttendance`/`saveEdit`, 618-912)

- Any HR/admin viewing the daily grid can edit any employee's record for the selected date:
  status dropdown (`Present/Absent/Half Day/Leave/Holiday/Week Off`), check-in/out/lunch via
  Hour/Minute/AM-PM dropdowns.
- `Present`/`Half Day` require both check-in and check-out filled before Save is allowed; other
  statuses have no time requirement.
- On save: recomputes times per status rule (Absent clears all punch fields — §3.4), re-derives
  `sessions[]` (patches only first/last if more than one exists, to avoid destroying a
  multi-session day), recomputes hours via the canonical formula, writes `adminEdited: true`, and
  explicitly **clears** any prior `regularized`/`regularizedBy`/`regularizedAt` — an admin edit
  supersedes a prior employee regularization.
- **Unresolved/ambiguous**: no finer per-role (HR vs Admin vs Manager) distinction was found for
  the edit action itself beyond the outer route-level `module="hr"` gate — needs confirmation from
  `AuthContext`/role source before assuming the new backend's scope rules (`.own`/`.team`/`.all`)
  map cleanly onto legacy behavior.

### 5.2 Employee-submitted Regularization Requests

(`MyAttendance.tsx` submission, `Regularization.tsx` approval)

- Employee submits: `date`, `type` (`missed-checkin`/`missed-checkout`/`incorrect-time`/
  `late-arrival`/`early-departure`), optional `requestedCheckIn`/`requestedCheckOut`, free-text
  `reason`. Written as `status: 'pending'`.
- HR reviews (`handleReview`, 89-304): sets `status: 'approved'|'rejected'`, `reviewedBy`,
  `reviewedAt`, optional `reviewNote` — this is the audit trail.
- **On approval only** (rejection never touches attendance):
  - For `missed-checkin`: finds the **next session chronologically** at/after the requested time
    and borrows its check-in as the synthesized checkout — explicitly avoids fabricating a bogus
    checkout from an unrelated earlier session (a real historical bug this fixed: a bogus ~16h
    overnight session).
  - For `missed-checkout`: symmetric, using the preceding session.
  - Filters out stray unclosed/invalid sessions before appending the new regularized session,
    re-sorts by check-in time, recomputes hours, writes `status: 'Present'`, `regularized: true`,
    `regularizedBy`, `regularizedAt`.
  - If no record exists for that date: creates one with a single session, defaulting a missing
    side to hardcoded `'10:00 AM'`/`'06:30 PM'` (interesting inconsistency: hardcoded, not read
    from `SHIFT_CONFIGS.day`).
  - Employee is notified regardless of approve/reject outcome.

### 5.3 Monthly attendance approval (`Approved.tsx`)

A separate, coarser-grained sign-off keyed by month per employee, distinct from day-level
Regularization. **Unresolved/ambiguous**: not fully read in this pass; downstream effect of
accept/decline (e.g. payroll gating) needs a dedicated follow-up read before the new backend
designs its own "monthly lock" semantics, if one is wanted at all.

---

## 6. Auto-Checkout

**Two independent, redundant implementations exist** — a Firebase Cloud Function and a Vercel
serverless cron endpoint. It is not established from a read-only pass which is actually active in
production. **This is a blocker to confirm with the team before porting one/both behaviors.**

### 6.1 Common behavior

- For every record with an open session, the correct cutoff is **that employee's own check-in
  time + their shift's target hours** (not a single fixed wall-clock cutoff for everyone).
- If cutoff is still future, session left open.
- If due, closes the session at the computed cutoff (not "now"), recomputes hours via the same
  status-aware rules as manual edit, sets `autoCheckedOut: true`.
- Both document a detection-lag caveat: since the job runs once/day, a session due mid-day won't
  close until the next run, but the resulting hours are still correct once it does.

### 6.2 Firebase Cloud Function (`functions/src/index.ts`)

Runs once daily at **19:00 IST** (`onSchedule`, `'0 19 * * *'`). Writes per-leaf-path (not a
record-level replace) explicitly to avoid RTDB's multi-path `update()` deleting unlisted fields.
Writes to both dual keys.

### 6.3 Vercel serverless cron (`api/auto-checkout.ts`)

HTTP handler requiring `Authorization: Bearer <CRON_SECRET>`; refuses with 500 if unconfigured.
Scans today **plus a 7-day lookback** (recovers from up to a week of cron outage). Also supports a
legacy single-session shape with no `sessions[]`. Falls back to a fixed 7pm IST cutoff only when a
record has no timestamp to compute a duration from.

---

## 7. Late-Attendance Alerts (`useLateAttendanceAlerts.ts`)

- **Entirely client-side** — runs only in the browser of an Admin/HR/Manager user who has the
  dashboard open, polling every 2 minutes. **There is no server-side scheduled job for this**,
  unlike auto-checkout — a real backend port needs an actual scheduled job to replicate "always
  fires," since legacy behavior is incidental to someone having a tab open.
- Morning check (≥10:30 **local browser clock**, not IST — a discrepancy from the rest of the
  app): flags anyone active with no check-in yet (excluding approved-leave/Leave/Absent/Holiday),
  not already notified (`hr/attendanceAlerts`). Notifies employee + admin feed.
- Evening check (≥20:30 local): flags anyone checked in but not out, same exclusion/dedup.
- Alerts are written to `hr/attendanceAlerts`, never `hr/attendance`, specifically so this
  notifier can never pollute real attendance data.

---

## 8. Reports / Summaries

- **Daily grid** with CSV export — Status via `getEmployeeAttendanceStatus` (§3.1), hours via
  `computeAttendanceHours` (§4.1).
- **Week/Month views** — a near-identical but **not byte-identical** reimplementation of the
  status precedence exists for the CSV export path vs the on-screen cell-badge path (noted
  drift risk in the legacy code itself) — the new backend should have exactly one canonical
  status function used everywhere, not screen-local reimplementations.
- **Weekly OT/shortfall balancing** — display-only (§4.2), not persisted.
- **"Present Today" KPI** — dedicated dedup-aware counter (`countValidPresentAttendance`),
  explicitly built to fix double-counting across the dual-key problem.
- **"Absent" KPI** — computed via `getEmployeeAttendanceStatus` per employee, NOT a raw
  `status === 'Absent'` filter, specifically to avoid double-counting someone also on approved
  leave.
- **Monthly employee-side summary** — per-day-of-month counts + total worked hours.
- **No standalone "Missing Punch Report" or "Overtime Report" screen was found.** OT visibility
  lives in the grid/weekly-card views; missing-punch visibility is either the late-alert
  notifications (ephemeral) or the Regularization queue (employee-initiated, not
  system-detected). **Confirm before assuming these are a Phase-4 deliverable** — they were not
  found as pre-existing legacy screens.

---

## 9. Permissions Summary (as observed)

| Role                                                          | Observed capability                                                                                                                                        | Citation                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Employee                                                      | Check-in/check-out (subject to Wi-Fi/remote-privilege gate + face verify), view own attendance, submit Regularization requests                             | `attendanceService.ts`, `MyAttendance.tsx`                      |
| Admin / HR / Manager                                          | Receive late check-in/check-out alerts (client-side, while logged in)                                                                                      | `useLateAttendanceAlerts.ts`                                    |
| "hr" module (route-gated, not finer-grained in code reviewed) | View/edit attendance grid, auto-apply holidays, approve/reject Regularization, approve/reject Leave (cascades via `markLeaveDays`), set location privilege | `App.tsx`, `Attendance.tsx`, `Regularization.tsx`, `Leaves.tsx` |
| Admin (`isAdmin`, distinct from generic "hr" access)          | Approve/decline **monthly** attendance sign-off                                                                                                            | `Approved.tsx`                                                  |

**Unresolved/ambiguous**: the precise role hierarchy (is "manager" a subset of "hr"? can a plain
"hr" role approve Regularization or only view?) was not traced to a central RBAC source in this
pass. `Regularization.tsx`'s approve/reject appears gated only by the outer route wrapper. The new
backend's `.own`/`.team`/`.all` scope model (already established for Leave/Employees) should be
the target shape, not a literal port of this ambiguous legacy gate.

---

## 10. Notable Edge Cases / Error Handling Actually Observed

1. **Dual-key drift** is the single most-repeated defensive theme in the legacy codebase — a
   relational schema with one real employee foreign key eliminates this whole class of bug. Not
   relevant to the new Postgres design except as a reminder that status/presence derivation must
   be centralized in one function, which the legacy app itself learned the hard way.
2. **Device clock cannot be trusted** — server-timestamp-first design, flagged-not-rejected skew
   tolerance of 5 minutes (§2.4). The new backend should always use server/DB time for
   `checkInMs`/`checkOutMs` equivalents, never trust a client-submitted timestamp for the
   authoritative instant.
3. **Stray/unclosed sessions during regularization** are explicitly filtered before appending a
   new regularized session — same discipline needed in the new correction workflow.
4. **Multi-path RTDB `update()` SET semantics bug** — RTDB-specific, not applicable to Postgres,
   but confirms that PATCH-style endpoints must only touch the fields actually supplied.
5. **Corrupted time-string repair function exists** — evidence that bad data has existed in
   production; informs how defensively to treat any migrated historical data, but a clean typed
   schema makes the function itself unnecessary going forward.
6. **Timezone-sensitive Sunday-detection bug already fixed once** (local Y/M/D components instead
   of UTC-parsing a date string) — a concrete example of the exact class of bug
   `Docs/ARCHITECTURE.md`'s / `date-only.ts`'s UTC-midnight convention is designed to prevent.

---

## Files Read (for traceability)

**Full**: `src/utils/attendanceStatus.ts`, `functions/src/attendanceMath.ts`,
`functions/src/index.ts`, `api/auto-checkout.ts`, `src/modules/hr/useLateAttendanceAlerts.ts`,
`src/services/attendanceService.ts`, `src/utils/otBalancing.ts`, `src/modules/hr/Regularization.tsx`,
`src/modules/hr/Holiday.tsx`, `src/modules/hr/Shifts.tsx` (= Location Privilege screen).
**Partial**: `src/modules/hr/Attendance.tsx` (~1600/2570 lines), `src/modules/employee/MyAttendance.tsx`
(~250/2146 lines), `src/modules/employee/CameraVerifyModal.tsx` (first 120/310 lines),
`src/modules/hr/Leaves.tsx` (approval handler), `src/modules/hr/Approved.tsx` (grep-level only),
`src/App.tsx` (route table only), `src/types/hr.ts` (partial).
**Not read** (flagged above as needed before full confidence): `src/utils/faceVerification.ts`,
`src/services/notifications.ts`, `src/context/AuthContext.tsx` / role-permission source,
`src/modules/employee/WebCheckin.tsx` and `EmployeeDashboard.tsx` bodies (confirmed by in-repo
comments to delegate to `attendanceService.ts`, not reimplement it),
`src/modules/hr/EmployeeTimesheet.tsx` (another writer, `writeAttendance` call seen, not
inspected), `src/modules/hr/FMA.tsx`/`FMP.tsx`/`Bonus.tsx`/`Empdash.tsx` (grep-only),
`src/modules/documents/utils/hrComputations.ts`.

## Follow-up recommended before finalizing scope

1. `Approved.tsx` in full — monthly lock semantics and whether it gates anything downstream.
2. `EmployeeTimesheet.tsx` — another attendance writer not yet inspected.
3. `AuthContext.tsx` / role model — to confirm the legacy role hierarchy before mapping it onto
   the new `.own`/`.team`/`.all` scope system.
4. Confirm with the team which of the two auto-checkout implementations (§6.2 vs §6.3) is actually
   scheduled in production, if either — this determines whether auto-checkout is in scope at all
   for parity, and if so, which cutoff/lookback behavior to match.

---

## 11. Implementation status against this parity reference (added after implementation)

Backend implemented; see `Docs/ATTENDANCE_ARCHITECTURE.md` §7 for the full as-built record. This
section maps each legacy behaviour above to what the new backend does.

| Legacy behaviour (section)                                                                          | New backend                                                                                             | Status                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Check-in / check-out, server time (§2)                                                              | `POST /hr/attendance/check-in`, `check-out`; server clock, IST date                                     | Parity; client time never trusted                                        |
| Multiple sessions summed, gaps are breaks (§2, §4)                                                  | Sessions summed; gaps not counted; lunch not deducted                                                   | Parity                                                                   |
| Status: stored Present/Absent authoritative (§3)                                                    | Stored PRESENT/ABSENT/HALF_DAY; NOT_MARKED derived, never persisted                                     | Parity                                                                   |
| Holiday beats Leave (§3.1)                                                                          | Holiday > Weekly Off > Leave > stored status                                                            | Parity, plus Weekly Off decided by user                                  |
| Half Day: worked = target ÷ 2, pending = the other half, no OT (§4; `attendanceMath.ts` pendingHrs) | Implemented, shortfall corrected this round                                                             | Parity                                                                   |
| Normal day worked / OT / pending formula (§4)                                                       | Implemented in the single calculation service                                                           | Parity                                                                   |
| Sunday: no OT, worked capped (§4)                                                                   | Generalised to weekly-off rules; no hard-coded Sunday                                                   | Deviation (intentional)                                                  |
| Leave/Holiday pendingHrs = 0, punched hours kept (§4)                                               | Implemented; OT and shortfall 0                                                                         | Parity; OT on these days decided as 0                                    |
| Weekly OT vs shortfall display-only (§4.2)                                                          | Overtime and shortfall shown per day; no authoritative ledger                                           | Parity                                                                   |
| Manual HR edit: status, times, clear punches (§5)                                                   | `PATCH /hr/attendance/:id`; replaced punches kept in audit                                              | Parity; hard-delete of replaced punches is a decision                    |
| Regularization reasons and approval (§5.2)                                                          | Correction workflow, planner refuses fabricated checkouts                                               | Parity; refusal is stricter than legacy                                  |
| Auto-checkout, two implementations (§6)                                                             | Scheduled in the ERP API every 5 min, closing at check-in + shift target; idempotent, audited as system | ERP authoritative rule chosen; legacy duplication recorded, not resolved |
| Late alerts, client-side (§7)                                                                       | Not implemented: needs notification infrastructure, which the ERP does not have                         | Out of scope                                                             |
| Reports: daily, monthly summary (§8)                                                                | Daily and monthly reports                                                                               | Parity                                                                   |
| Missing-punch and standalone overtime reports (§8)                                                  | Implemented as NEW derived reports (not legacy parity), definitions in ATTENDANCE_ARCHITECTURE.md §7.6  | New, not parity                                                          |
| Face verification, office IP gate (§2)                                                              | Not implemented                                                                                         | Out of backend scope, unresolved                                         |
| Monthly sign-off / lock (§5.3)                                                                      | Not implemented. Legacy workflow has no lock effect and its payload is payroll-coupled                  | Unresolved, needs payroll decision                                       |
| Asia/Kolkata timezone (§2)                                                                          | IST business date for every punch and calendar lookup                                                   | Parity                                                                   |

Known deviations from legacy, in one list: derived values are not stored; the Sunday special case
is replaced by weekly-off rules; corrections never fabricate a checkout; self-approval is refused;
self punches are not audited.

### 11.1 Post-implementation spot-check (read-only, legacy repo not modified)

- Confirmed against `functions/src/attendanceMath.ts`, the legacy calculation module: Day target
  8.0 h, Sunday target 4.0 h, Half Day = target ÷ 2 with no overtime, worked = min(actual, target),
  pending = max(target − actual, 0) with 0 on non-working statuses. These match the implementation.
- **Unresolved contradiction, not decided:** the legacy UI labels the standard window
  "10:00 AM – 7:00 PM" (`src/modules/employee/MyAttendance.tsx`), while this document and the brief
  say 10:00–18:30. The new backend does not hard-code a window; the target comes from the `Shift`
  master data (`working_minutes`). Confirm the intended window before any shift is seeded from legacy.
- **Out of scope, flagged for payroll:** legacy computes half-day and holiday pay from attendance
  (`src/modules/documents/utils/hrComputations.ts`, `halfDayPay`). The attendance backend produces no pay
  figures. A payroll module will need the derived status and hours, not a copy of this logic.
- Legacy auto-checkout exists in both places the parity doc names: `functions/src/index.ts` and
  `api/auto-checkout.ts`. Legacy production authority is still unresolved (§6); the ERP has its own authoritative scheduler (ATTENDANCE_ARCHITECTURE.md §7.7).
