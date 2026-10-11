# HR Leave — architecture, rules and legacy parity

Scope: `hr/leave-requests`, `hr/leave-types`, `hr/leave-entitlements`, `hr/leave-delegations`,
`employee-self-service/leave-requests`, and the Attendance integration that reads
approved leave. Backend only. API reference: [HR_API.md](HR_API.md) §Leave.
Legacy parity findings: [HR_LEGACY_PARITY.md](HR_LEGACY_PARITY.md).

Written for: engineers reviewing or extending the Leave module, and HR/product
owners who need to confirm the rules marked **Decision** below.

Labels used throughout:

- **Legacy** — verified in `TexaWave_ERP` (read-only).
- **Decision** — a production rule chosen for this module. Legacy does not define
  it. Each one is a business choice and is listed again in §9.

## 1. Architecture

| Piece                 | Where                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pure rules            | `leave-requests/leave-domain.ts` — lifecycle, overlap, working-day count, balance (no DB, unit-tested)                    |
| Persistence & locking | `leave-requests/leave-requests.repository.ts` — the only Prisma caller; every write is one transaction with its audit row |
| Orchestration         | `leave-requests/leave-requests.service.ts` — resolves the employee from the JWT, scope, org                               |
| HTTP                  | `leave-requests.controller.ts` (HR, entitlements, delegations), `employee-self-service/leave-requests/` (own)             |
| Notifications         | `leave-notifications.service.ts` — recipients and texts; sent after commit, best effort (§6.3)                            |
| Export / report       | `leave-transfer.service.ts` + pure `leave-csv.ts` — CSV export, balance report, bulk and CSV entitlements                 |
| Delegations           | `leave-delegations.repository.ts` / `.service.ts` (§6.2)                                                                  |
| Calendar              | Reused from Attendance: `AttendanceDayContextRepository.load` + `resolveCalendar` (holiday and weekly-off precedence)     |
| Attendance            | Reads approved leave through the same resolver; writes nothing for leave                                                  |

Tables (schema `hr`): `leave_types`, `leave_requests`, `leave_entitlements`, `leave_approval_delegations`.

## 2. Request lifecycle

```
PENDING ──approve──▶ APPROVED ──cancel (employee: before start; HR: any time)──▶ CANCELLED
   │                                                        │
   ├──reject──▶ REJECTED                                    │
   │              │                                         │
   └──cancel──────┴──────────resubmit────────────────────────┴──▶ PENDING
```

| From      | To                 | Who                                            | Rule                                                                  |
| --------- | ------------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| —         | PENDING (submit)   | employee (own), or HR on the employee's behalf | re-validated, see §3–§6; on behalf: §6.4                              |
| PENDING   | PENDING (1st of 2) | first approver (§6.1)                          | two-level types only; records `first_decided_*`                       |
| PENDING   | APPROVED           | approver (§6.1, not self)                      | decision final; balance re-checked (§5); closed month refused (§8)    |
| PENDING   | REJECTED           | approver (§6.1, not self)                      | reason mandatory; final at either stage                               |
| PENDING   | CANCELLED          | employee (own), or HR                          | any time                                                              |
| APPROVED  | CANCELLED          | employee (own)                                 | **Decision:** only while the start date is after today (UTC)          |
| APPROVED  | CANCELLED          | HR (`hr.leave.cancel`)                         | **Decision:** any time, even after the start; reason mandatory (§6.4) |
| REJECTED  | PENDING (resubmit) | employee (own)                                 | **Decision:** start date not before today; same id; re-validated      |
| CANCELLED | PENDING (resubmit) | employee (own)                                 | same as REJECTED                                                      |

Everything else is `422 INVALID_STATE_TRANSITION`. The database enforces the same
edges in a trigger (`leave_requests_protect`), so no code path can skip them. Submitted
content (dates, portion, reason, requester, leave days) can never change. Only the
decision fields and cancellation fields move. `approval_levels` is copied from the leave type at
submission and changes only on resubmission (trigger), so editing a leave type never changes a
request already in flight.

A request is never deleted. Its history stays in the audit log.

## 3. Dates and working days

- **Inclusive range**, date-only, no time zone.
- **Working days** (`leaveDays`) = dates in the range that are neither a holiday
  (organization or the employee's location) nor a weekly off. Weekly-off precedence
  is the Attendance rule (most specific rule wins). **Decision:** this replaces the
  earlier calendar-day count for balances. `calendarDays` is still returned for history.
- **Half-day:** `FIRST_HALF` or `SECOND_HALF`, single date only, counts `0.5` on a
  working date. A half-day on a non-working date is refused.
- A request with **no working day** is refused (`LEAVE_NO_WORKING_DAYS`).
- **Employment period:** the start may not precede the date of joining; the end may
  not pass the date of exit; the employee must be `ACTIVE`.
- **Year boundary:** a request may not span two calendar years
  (`LEAVE_SPANS_YEAR`). **Decision:** this keeps balance accounting per year simple.
- **Past dates:** a submission may name a past date. Only cancel-after-approval and
  resubmission check the date against today. See §9.

## 4. Overlap

Two open requests (PENDING or APPROVED) of one employee may not describe the same day,
with one exception: the **first and second half of the same date** are two valid
requests. Pairs that conflict:

| Existing ↓ / New → | FULL | FIRST_HALF | SECOND_HALF |
| ------------------ | ---- | ---------- | ----------- |
| FULL               | ✗    | ✗          | ✗           |
| FIRST_HALF         | ✗    | ✗          | ✓           |
| SECOND_HALF        | ✗    | ✓          | ✗           |

Each rule is enforced in two layers:

- **Database** — `leave_requests_employee_no_full_day_overlap` (full vs full) and
  `leave_requests_employee_no_same_half_overlap` (same portion). A PostgreSQL exclusion
  constraint cannot express "a FULL row against a HALF row" as one rule, because a
  constraint predicate applies to both rows.
- **Service** — the check that covers the FULL-vs-HALF case. It runs under the
  per-employee advisory lock (§7), so the database rules and this check cannot race.

REJECTED and CANCELLED requests never block.

## 5. Balance

### 5.1 Model

Balances are derived from the facts, not stored as counters, so they cannot drift:

- **Entitlement** for year Y = the employee's override for (leave type, Y) if one exists,
  else the leave type's `annualEntitlement`.
- **Accrual:** `entitlement / 12` per credited month. A month is credited when the
  employee has joined by its last day and has not left before its first day. A joiner
  gets full credit for the joining month (no pro-rating). An employee who leaves
  mid-month is credited for that month.
- **Used:** approved working days, attributed to the year of the request's start.
- **Pending:** working days of PENDING requests in the year. A pending request holds
  balance, so concurrent submissions cannot over-commit it.
- **Carry-forward:** at year end, `closing = opening + full-year accrual − used`.
  `opening(Y+1) = min(max(closing(Y), 0), carryForwardLimit)`. Unused days above the
  cap are forfeited. Carry-forward is computed from the leave type's first year onward,
  so it is deterministic from the full history.
- **Available** = opening + accrued (through the month of the request's end) − used −
  pending.

### 5.2 Rules

- **Enforcement (paid leave):** a submission or resubmission is refused when its working
  days exceed the available balance (`LEAVE_BALANCE_INSUFFICIENT`).
- **Approval re-check:** approval re-checks the balance with the request held as pending.
  An entitlement cut after submission therefore blocks approval; the request stays PENDING.
- **Negative balance:** not permitted for paid leave.
- **Unpaid leave** (`isPaid = false`): not balance-limited. Its days are still recorded
  in `leaveDays` for reporting.
- **Accrual through the end month (Decision):** a request may draw on accrual up to the
  month of its end date, so planned leave in the same year can be requested ahead.
- **Balance view:** "as of today". Past years show full accrual; the current year shows
  accrual through the current month; future years show no accrual yet (available is
  opening only).

### 5.3 Worked example (Decision-based, 2026 leave type, 12 days a year, cap 5)

| Year | Opening                             | Accrued through Mar | Used | Available at Mar-end |
| ---- | ----------------------------------- | ------------------- | ---- | -------------------- |
| 2026 | 0                                   | —                   | 0    | —                    |
| 2027 | 5 (12 accrued, unused, capped at 5) | 3                   | 0    | 8                    |

## 6. Permissions

| Action                                   | Permission                                        | Scope                                        |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| Submit, cancel, resubmit                 | `employee_self_service.leave_request.create`      | the caller's own employee only               |
| Own requests and own balances            | `employee_self_service.leave_request.read`        | the caller's own employee only               |
| HR / team list, detail, balances, report | `hr.leave_request.read` (`.own` `.team` `.all`)   | team or organization                         |
| Approve / reject, approval queue         | `hr.leave.approve` (`.own` `.team` `.all`)        | §6.1; never own request or one you submitted |
| Delegate your approval                   | `hr.leave.approve` (any level)                    | your own delegations only (§6.2)             |
| Apply on an employee's behalf            | `hr.leave_request.create` (`.team` `.all`)        | team or organization; never yourself (§6.4)  |
| Cancel someone's leave                   | `hr.leave.cancel` (`.team` `.all`)                | team or organization; never yourself (§6.4)  |
| Export requests / balances (CSV)         | `hr.leave_request.export` (`.own` `.team` `.all`) | team or organization                         |
| Leave type administration                | `hr.leave_type.read` / `.write`                   | organization                                 |
| Entitlements: single, bulk, CSV import   | `hr.leave_type.write`                             | organization (D11)                           |

- `hr.leave_request.create.own` and `hr.leave.cancel.own` are reserved and grant nothing: one's own
  leave goes through self-service, and the service also refuses the caller's own record
  (`403 LEAVE_OWN_VIA_SELF_SERVICE`).
- Maker-checker: nobody decides their own request, nor one they submitted on someone's behalf
  (`403 SELF_APPROVAL_FORBIDDEN`), even with `.all`.
- Out of scope is `404`, not `403`, so existence is not leaked. The one exception: an `.own`-only
  approver gets `403` for a request outside their reporting line (it was always `403` for `.own`).
- Organization isolation: every query carries `organizationId`. An entitlement or
  decision that names another organization's employee or leave type is `422` or `404`.
- Service-level enforcement: the repository loads through `teamWhere`/`tenantWhere`,
  not only the controller decorator.

### 6.1 Approval routing (Decision)

Authority over a PENDING request comes from two independent sources:

- **Reporting line:** the caller is the employee's reporting manager (`Employee.reportsTo`, through
  its linked login) or that manager's active delegate today (§6.2). Any `hr.leave.approve` level
  gives this. `hr.leave.approve.own` gives **only** this — it is the reporting-manager level.
- **Scope:** the caller's `hr.leave.approve` level is `.team` (the employee's team) or `.all`.

Each leave type has `approvalLevels`:

| Levels | Stage 1                                                        | Stage 2                                             |
| ------ | -------------------------------------------------------------- | --------------------------------------------------- |
| 1      | reporting line **or** scope → final                            | —                                                   |
| 2      | reporting line **or** scope → still PENDING (`awaiting: "HR"`) | an `.all` approver who did not give stage 1 → final |

Refusals: `403 LEAVE_AWAITING_HR` (stage 2 by someone without `.all`), `403 LEAVE_SAME_APPROVER`
(the stage-1 approver again; also a CHECK in the database). A rejection at either stage is final.
The pure rule is `approvalVerdict()` in `leave-domain.ts`. `GET /hr/leave-requests/approvals` lists
exactly what the caller may decide now.

### 6.2 Delegation (Decision)

A user with any `hr.leave.approve` level may name a stand-in for a date range (at most 90 days,
ending today or later, one active delegation at a time). During the range the delegate decides
what the delegator could decide **as reporting manager** — never more: scope-based authority still
comes only from the delegate's own roles. The delegate must hold some `hr.leave.approve` level
(`422 DELEGATE_CANNOT_APPROVE`), because the route guard would refuse them otherwise. Delegations
are revoked, never edited, and audited (`leave_delegation`). Only the delegator lists, creates and
revokes their own; the delegate sees the ones they received.

### 6.3 Notifications

In-app (`platform/notifications`), sent after the change commits; a failure is logged and never
fails the change. The person who acted is never notified.

| Event                    | Recipients                                                                                                         | Type                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Submitted / resubmitted  | reporting manager + active delegates; no manager with a login → the team's approvers (`.team` with access, `.all`) | `leave.submitted`                           |
| Submitted on behalf      | the above, plus the employee                                                                                       | `leave.submitted_on_behalf`                 |
| First of two approvals   | the employee; `.all` approvers except the first approver                                                           | `leave.first_approved`, `leave.awaiting_hr` |
| Approved / rejected      | the employee                                                                                                       | `leave.approved`, `leave.rejected`          |
| Cancelled by HR          | the employee                                                                                                       | `leave.cancelled_by_hr`                     |
| Approved leave withdrawn | whoever approved it (both approvers on two-level)                                                                  | `leave.withdrawn`                           |
| Delegation created       | the delegate                                                                                                       | `leave.delegation_created`                  |

### 6.4 HR actions on someone else's leave (Decision)

- **Apply on behalf** (`POST /hr/leave-requests`): the same validation as self-service. The request
  starts PENDING with `requestedBy` = HR, so the HR user who applied cannot approve it.
- **Cancel** (`POST /hr/leave-requests/:id/cancel`): PENDING or APPROVED, with a mandatory reason.
  An approved leave may be cancelled after it has started (e.g. the employee came back); the whole
  request is cancelled, so the days already passed lose their `ON_LEAVE` status in Attendance.
  `cancelled_by` records who cancelled (also set for the employee's own withdrawal).

## 7. Concurrency

Every balance-affecting write (submit, resubmit, cancel, decide, entitlement change)
runs in one transaction that first takes `pg_advisory_xact_lock` keyed on the employee.
Then it locks the request row (`SELECT … FOR UPDATE`). This order is always the same,
so writes for one employee are serialized and cannot deadlock. Concurrent overlapping
submissions: exactly one succeeds. A bulk entitlement write takes every affected
employee's lock first, in ascending id order. A write that checks the attendance month
(§8) then takes Attendance's own per-employee lock — always after the leave lock, and
Attendance never takes the leave lock — so a month cannot close between the check and
the commit.

## 8. Attendance integration

- Attendance derives its status when it reads: nothing is written for leave.
- **Full-day** approved leave → `ON_LEAVE`.
- **Both halves** of one date → `ON_LEAVE`.
- **One half** → `HALF_DAY`, using the same half-target allocation as a stored HALF_DAY.
- Precedence is unchanged: **Holiday > Weekly off > Leave > stored status**.
- Only `APPROVED` leave counts. A cancelled, rejected or pending request has no effect,
  so withdrawal reverses Attendance automatically.
- **Closed month (Decision):** approved leave is part of a month's attendance, so the final
  approval of a request, and any cancellation of an APPROVED one, is refused when a month it
  touches is SUBMITTED or APPROVED in the attendance month close (`409 ATTENDANCE_MONTH_LOCKED`).
  Return or reopen the month first. Submitting, rejecting and the first of two approvals are
  not affected, because they do not change attendance.

## 9. Decisions and open items

### 9.1 Decisions made for this module (not in legacy)

| #   | Decision                                                                                      | Why                                                        |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| D1  | Balance is enforced at submission and approval; paid leave cannot go negative                 | Requested. Legacy only gated the UI.                       |
| D2  | Entitlement = type default, overridable per employee per year                                 | Mirrors legacy's defaults and HR overrides.                |
| D3  | Accrual = 1/12 per credited month; joining and exit months credited as in §5.1                | Accrual was requested; the schedule is a choice.           |
| D4  | Carry-forward capped per leave type; excess forfeited                                         | Carry-forward was requested; the cap is a choice.          |
| D5  | Working days (not calendar days) consume the balance                                          | Requested. Legacy counted calendar days.                   |
| D6  | Half-days: single date, 0.5 day, FIRST/SECOND portions                                        | Requested. Legacy had no half-days.                        |
| D7  | Cancel approved leave only before its start (UTC date)                                        | Requested. Legacy had no cancellation.                     |
| D8  | Resubmit only if the start date is not past; same id, re-validated                            | Requested. Avoids duplicate requests.                      |
| D9  | No request may span two calendar years                                                        | Keeps per-year accounting unambiguous.                     |
| D10 | Accrual counted through the request's end month                                               | Lets planned leave be requested ahead.                     |
| D11 | Entitlement administration reuses `hr.leave_type.write`; no new permission                    | Avoids a second permission family for one admin action.    |
| D12 | Balance is computed, not stored                                                               | Prevents drift; cost is one query per employee and type.   |
| D13 | Reporting manager (or delegate) or scoped approver decides; `approve.own` = reporting manager | Legacy routed nothing; a manager needs no team scope.      |
| D14 | Optional second approval per leave type, by a different `.all` approver                       | "Reporting manager → HR" without forcing it on every type. |
| D15 | Delegation: reporting-line authority only, ≤ 90 days, one at a time                           | Cover for absent managers without widening scope.          |
| D16 | HR may apply on behalf (still needs someone else's approval)                                  | Phone-in sick leave; maker-checker kept.                   |
| D17 | HR may cancel approved leave at any time, whole request only                                  | Corrections after the start; no partial curtailment yet.   |
| D18 | Approval / cancellation of approved leave refused in a closed attendance month                | A closed month must not change silently.                   |
| D19 | CSV (not .xlsx) for export and import                                                         | Excel opens and saves CSV; no new dependency.              |

### 9.2 Legacy behaviour that was not adopted

- Legacy default quotas (Casual 6, Sick 6, Privilege 15, Compensation 0, OnDuty 0)
  are **not** seeded. Entitlements must be configured by HR per leave type. With a
  zero entitlement, paid leave is refused until configured. This is intentional.
- Legacy's `Marriage` type is commented out in legacy and is not created.
- Legacy's admin feed is replaced by in-app notifications to the people who act (§6.3).

### 9.3 Unresolved

1. Whether legacy default quotas should become the production defaults.
2. Paid vs unpaid policy beyond the flag (e.g., unpaid days affecting payroll). Payroll
   effects are not built.
3. Whether past-dated submissions should be allowed at all.
4. Approval hierarchy: built as D13/D14. Which roles get `hr.leave.approve.own` (managers) and
   which leave types need two levels is configuration for HR to decide; no default role holds
   `approve.own`/`.team`, and no leave type is two-level by default.
5. HR-initiated cancellation or submission: built (D16/D17). Partial cancellation (curtailing a
   started leave to the days actually taken) is not built.
6. Whether a leave on a holiday or weekly off should count against balance. It does not
   (D5), but this is a policy choice to confirm.
7. Notifications: built (§6.3). Email delivery is not built (in-app only).
8. Whether overlap should apply across leave types (currently it does).
9. Leave encashment and rollover for unpaid types. Not built.
10. Attendance precedence when the scope of two weekly-off rules conflicts. Resolved by
    the existing most-specific rule (team > location > organization).
11. Migration backfill: existing rows get `leave_days` equal to inclusive calendar days,
    because no holiday or weekly-off data was applied to them. New rows use working days.
    HR should review any balance figures that depend on those historical rows.

## 10. Verification

Results of the final run are recorded in the completion report for this change. This
document describes the design only; it does not state test counts.

## 11. Leaves UI/UX Enhancement (TexaWave ERP Production)

### 11.1 Layout and Navigation Architecture

- **Page Header:** Unified header with title `Leaves` and subtitle `Manage your leave requests and review team requests.`
- **Navigation Tabs:** When an authenticated account holds both self-service (`employee_self_service.leave_request.read`) and organizational review scopes (`hr.leave_request.read.*`), the page renders a unified tab switcher:
  - `All` (default): Presents both My Leave and Team/Organization Requests sequentially, maintaining immediate locator visibility for automated test suites.
  - `My Leave`: Focuses exclusively on personal leave balances, entitlement metrics, and personal request history.
  - `Team Requests`: Focuses exclusively on the team/organizational approvals queue and filter toolbar.
- **Permission Decoupling:** Accounts with self-service permission that lack a linked employee profile (e.g. Super Admin) cleanly suppress personal sections without displaying unhandled API errors.

### 11.2 My Leave & Leave Balance Presentation

- **Leave Balance Cards (`LeaveBalanceCards`):**
  - Renders server-derived balances per leave type in responsive cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
  - Top gradient accent bar, leave type code badge, and paid/unpaid status pill.
  - Primary metric displays `available` working days for paid leave, or `Not balance-limited` for unpaid leave.
  - Detailed micro-stat breakdown: Entitlement, Accrued, Used, and Pending.
- **Missing Configuration Warning State:**
  - Distinct warning banner (`AlertTriangle`, amber theme) rendered strictly when leave types are loaded and empty (`balances.length === 0`).
  - Never shown during pending query loading or network/server errors.
  - Clarifies that leave requests cannot be submitted until HR or an administrator configures leave types and entitlements.
- **Personal Request History:**
  - Table columns: `Leave type` (with code badge), `Dates` (with half-day portion indicator if applicable), `Days`, `Reason` (truncated with tooltip), `Status` (with decision/cancellation notes), and `Actions`.
  - Actions provide `Cancel` (when `canCancel(r)` is true) and `Resubmit` (when `canResubmit(r)` is true).
  - Uses `TableSkeleton` for loading states and semantic `EmptyState` when no requests have been logged.

### 11.3 Team / Organization Requests Queue

- **Filter Toolbar:**
  - Compact filter card housing `Filter by status` combobox and `Filter by employee ID` input.
  - Interactive `FilterChips` bar with individual removal actions and `Clear filters` button.
- **Approvals Table:**
  - Columns: `Employee` (rendered with shared `EmployeeIdentity`), `Leave type`, `Dates`, `Days`, `Status` (`LeaveStatusBadge`), `Decided by`, and `Actions`.
  - Direct `Approve` and `Reject` action buttons for requests with `PENDING` status when holding `hr.leave.approve.*`.

### 11.4 Centered Modals & Validation

- **Request Leave Modal (`RequestLeaveDialog`):**
  - Rendered using native `<dialog>` with backdrop blur, top gradient accent bar, and ESC/backdrop dismissal.
  - Fields: `Leave type` (with available days preview), `Start date` (`type="date"`), `End date` (`type="date"`), `Portion` (`FULL`, `FIRST_HALF`, `SECOND_HALF`), and `Reason`.
  - Validation: 3–500 character reason enforced client-side via Zod and mirrored in live character counter (`{values.reason.length}/500`) passed through `FormField.labelAction`.
  - Inline warning alert when opened with zero active configured leave types.
- **Decide Leave Modal (`DecideLeaveDialog`):**
  - Displays employee context card (`EmployeeIdentity`, leave type, date span, duration, and employee reason).
  - Rejection note required (3–500 characters) when rejecting; optional note when approving. Live character counter via `labelAction`.
- **Cancel Leave Modal (`CancelLeaveDialog`):**
  - Displays request context and optional cancellation note (3–500 characters) with live counter via `labelAction`.
