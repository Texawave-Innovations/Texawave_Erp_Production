# HR Leave — architecture, rules and legacy parity

Scope: `hr/leave-requests`, `hr/leave-types`, `hr/leave-entitlements`,
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
| HTTP                  | `leave-requests.controller.ts` (HR), `employee-self-service/leave-requests/` (own)                                        |
| Calendar              | Reused from Attendance: `AttendanceDayContextRepository.load` + `resolveCalendar` (holiday and weekly-off precedence)     |
| Attendance            | Reads approved leave through the same resolver; writes nothing for leave                                                  |

Tables (schema `hr`): `leave_types`, `leave_requests`, `leave_entitlements` (new).

## 2. Request lifecycle

```
PENDING ──approve──▶ APPROVED ──cancel (before start)──▶ CANCELLED
   │                                                        │
   ├──reject──▶ REJECTED                                    │
   │              │                                         │
   └──cancel──────┴──────────resubmit────────────────────────┴──▶ PENDING
```

| From      | To                 | Who                        | Rule                                                             |
| --------- | ------------------ | -------------------------- | ---------------------------------------------------------------- |
| —         | PENDING (submit)   | employee (own)             | re-validated, see §3–§6                                          |
| PENDING   | APPROVED           | approver (scope, not self) | decision final; balance re-checked (§5)                          |
| PENDING   | REJECTED           | approver (scope, not self) | reason mandatory                                                 |
| PENDING   | CANCELLED          | employee (own)             | any time                                                         |
| APPROVED  | CANCELLED          | employee (own)             | **Decision:** only while the start date is after today (UTC)     |
| REJECTED  | PENDING (resubmit) | employee (own)             | **Decision:** start date not before today; same id; re-validated |
| CANCELLED | PENDING (resubmit) | employee (own)             | same as REJECTED                                                 |

Everything else is `422 INVALID_STATE_TRANSITION`. The database enforces the same
edges in a trigger (`leave_requests_protect`), so no code path can skip them. Submitted
content (dates, portion, reason, requester, leave days) can never change. Only the
decision fields and cancellation fields move.

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

No new permission codes were added. Existing codes are reused.

| Action                                | Permission                                      | Scope                                   |
| ------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| Submit, cancel, resubmit              | `employee_self_service.leave_request.create`    | the caller's own employee only          |
| Own requests and own balances         | `employee_self_service.leave_request.read`      | the caller's own employee only          |
| HR / team list, detail, balances      | `hr.leave_request.read` (`.own` `.team` `.all`) | team or organization                    |
| Approve / reject                      | `hr.leave.approve` (`.team` `.all`)             | team or organization; never own request |
| Leave type administration             | `hr.leave_type.read` / `.write`                 | organization                            |
| Entitlement overrides (balance admin) | `hr.leave_type.write`                           | organization                            |

- Maker-checker: the requester's own login can never decide their request
  (`403 SELF_APPROVAL_FORBIDDEN`), even with `.all`.
- Out of scope is `404`, not `403`, so existence is not leaked.
- Organization isolation: every query carries `organizationId`. An entitlement or
  decision that names another organization's employee or leave type is `422` or `404`.
- Service-level enforcement: the repository loads through `teamWhere`/`tenantWhere`,
  not only the controller decorator.

## 7. Concurrency

Every balance-affecting write (submit, resubmit, cancel, decide, entitlement change)
runs in one transaction that first takes `pg_advisory_xact_lock` keyed on the employee.
Then it locks the request row (`SELECT … FOR UPDATE`). This order is always the same,
so writes for one employee are serialized and cannot deadlock. Concurrent overlapping
submissions: exactly one succeeds.

## 8. Attendance integration

- Attendance derives its status when it reads: nothing is written for leave.
- **Full-day** approved leave → `ON_LEAVE`.
- **Both halves** of one date → `ON_LEAVE`.
- **One half** → `HALF_DAY`, using the same half-target allocation as a stored HALF_DAY.
- Precedence is unchanged: **Holiday > Weekly off > Leave > stored status**.
- Only `APPROVED` leave counts. A cancelled, rejected or pending request has no effect,
  so withdrawal reverses Attendance automatically.

## 9. Decisions and open items

### 9.1 Decisions made for this module (not in legacy)

| #   | Decision                                                                       | Why                                                      |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| D1  | Balance is enforced at submission and approval; paid leave cannot go negative  | Requested. Legacy only gated the UI.                     |
| D2  | Entitlement = type default, overridable per employee per year                  | Mirrors legacy's defaults and HR overrides.              |
| D3  | Accrual = 1/12 per credited month; joining and exit months credited as in §5.1 | Accrual was requested; the schedule is a choice.         |
| D4  | Carry-forward capped per leave type; excess forfeited                          | Carry-forward was requested; the cap is a choice.        |
| D5  | Working days (not calendar days) consume the balance                           | Requested. Legacy counted calendar days.                 |
| D6  | Half-days: single date, 0.5 day, FIRST/SECOND portions                         | Requested. Legacy had no half-days.                      |
| D7  | Cancel approved leave only before its start (UTC date)                         | Requested. Legacy had no cancellation.                   |
| D8  | Resubmit only if the start date is not past; same id, re-validated             | Requested. Avoids duplicate requests.                    |
| D9  | No request may span two calendar years                                         | Keeps per-year accounting unambiguous.                   |
| D10 | Accrual counted through the request's end month                                | Lets planned leave be requested ahead.                   |
| D11 | Entitlement administration reuses `hr.leave_type.write`; no new permission     | Avoids a second permission family for one admin action.  |
| D12 | Balance is computed, not stored                                                | Prevents drift; cost is one query per employee and type. |

### 9.2 Legacy behaviour that was not adopted

- Legacy default quotas (Casual 6, Sick 6, Privilege 15, Compensation 0, OnDuty 0)
  are **not** seeded. Entitlements must be configured by HR per leave type. With a
  zero entitlement, paid leave is refused until configured. This is intentional.
- Legacy's `Marriage` type is commented out in legacy and is not created.
- Legacy's admin-feed and employee notifications are not built (see §9.3).

### 9.3 Unresolved

1. Whether legacy default quotas should become the production defaults.
2. Paid vs unpaid policy beyond the flag (e.g., unpaid days affecting payroll). Payroll
   effects are not built.
3. Whether past-dated submissions should be allowed at all.
4. Approval hierarchy: a reporting manager before HR, or HR alone. Current behaviour is
   permission-based, as before.
5. HR-initiated cancellation or submission on someone's behalf. Not built.
6. Whether a leave on a holiday or weekly off should count against balance. It does not
   (D5), but this is a policy choice to confirm.
7. Notifications on submit, decision, cancel and resubmit. Not built.
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
