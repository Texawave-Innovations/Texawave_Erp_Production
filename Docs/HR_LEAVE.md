# HR Leave — legacy parity and production decisions

Scope: `hr/leave-requests`, `hr/leave-types`, `employee-self-service/leave-requests`, and the Attendance
integration that reads approved leave. Backend only. API reference: [HR_API.md](HR_API.md) §Leave.
Legacy evidence is read-only from `TexaWave_ERP` (Firebase Realtime Database, React screens).

Written for: engineers reviewing the Leave module and deciding the open items below.

## 1. Current production state (verified)

| Area          | Production behaviour                                                                                                                                                | Evidence                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Schema        | `LeaveType` and `LeaveRequest` in schema `hr`, tenant-scoped, soft-delete, `customFields`                                                                           | `packages/database/prisma/schema.prisma`                                           |
| Submit        | Self-service only; employee resolved from JWT; `leaveTypeId, startDate, endDate (inclusive), reason 3–500`; starts `PENDING`                                        | `leave-requests.repository.ts` `create`                                            |
| Submit guards | Employee must be `ACTIVE`; start not before `dateOfJoining`; leave type must be active and in the org; `endDate ≥ startDate`                                        | same                                                                               |
| Overlap       | Two `PENDING`/`APPROVED` requests of one employee may not share a day (DB exclusion constraint → `409 LEAVE_OVERLAP`, names the clash). `REJECTED` does not block.  | `explainOverlap`, E2E "overlap prevention"                                         |
| Concurrency   | 8 simultaneous overlapping submissions: exactly one wins, none 500.                                                                                                 | E2E `of 8 simultaneous overlapping submissions…`                                   |
| Decide        | `approve` (note optional), `reject` (note mandatory). Row locked in a transaction, looked up through caller scope, `PENDING` only, audited in the same transaction. | `decide`                                                                           |
| Final states  | `APPROVED` / `REJECTED` are final. No edit, cancel, withdraw, delete, or resubmit endpoint exists.                                                                  | controller doc comment                                                             |
| Maker-checker | Requester can never decide own request (`403 SELF_APPROVAL_FORBIDDEN`), even with `.all`.                                                                           | E2E                                                                                |
| Scope         | Reads `own / team / all` via `TeamContextService`; out-of-scope → `404`, not `403`.                                                                                 | `findOne`                                                                          |
| Attendance    | `AttendanceDayContextRepository` loads `approvedLeaves`; the shared day resolver only counts `APPROVED`; calendar precedence Holiday > Weekly Off > Leave > stored. | `attendance-day-context.repository.ts`, `attendance-calculation.service.ts`, specs |
| Day count     | `calendarDays` = both ends inclusive; holidays and weekly-offs are **not** excluded.                                                                                | `HR_API.md` §Leave                                                                 |

Verification run for this task (disposable DB `texawave_erp_test`, Redis DB 5; the shared dev DB was not touched):

- `vitest run` on `hr/leave-requests`, `hr/leave-types`, `hr/attendance`: 8 files, 119 tests passed.
- `test/hr-leave.e2e-spec.ts`: 58 tests passed.
- `tsc --noEmit`: clean.
- `prisma migrate deploy` against the disposable DB: no pending migrations.

## 2. Legacy behaviour (TexaWave_ERP, read-only)

Sources: `src/modules/employee/MyLeaves.tsx`, `src/modules/hr/Leaves.tsx`, `src/modules/hr/LeaveAllotment.tsx`, `src/modules/hr/Holiday.tsx`.

- **Types:** `Casual`, `Sick`, `Privilege`, `Compensation`, `OnDuty`. Default quotas in code: Casual 6, Sick 6, Privilege 15, Compensation 0, OnDuty 0. `Marriage` is commented out.
- **Request fields:** `employeeId`, `type`, `fromDate`, `toDate`, `days`, `reason` (required, non-empty), `status`, `appliedAt`.
- **Days:** `max(1, differenceInCalendarDays(to, from) + 1)`. Calendar days; no holiday or weekly-off exclusion. Matches production.
- **Half-days, attachments, cancel, withdraw, resubmit:** none found.
- **Balance:** `quota − taken`, where quota = HR custom allotment, else policy, else default. Employees may apply only for a type with a configured quota.
- **Submit:** no overlap check and no balance check in `handleApply`. Writes to `hr/leaveApplications` and posts an admin feed notification.
- **Approve:** sets status `approved`, increments `taken` in `hr/leaveBalances/{employee}/{type}`, and (per its comment) syncs attendance. Approve note optional; reject note mandatory. Matches production on note rules.
- **Approver roles:** `admin`, `hr`, `manager` in the UI. Team scoping is not visible in the screen code; production enforces team scope on the server.
- **Annual allotment (`LeaveAllotment`):** HR overrides per employee per type; reset deletes the override. This is a static annual figure.
- **Holidays:** shown as upcoming only; not used in day counts.

## 3. Gap analysis

| Legacy behaviour                  | Production                                             | Decision                                                                                              |
| --------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Leave types                       | `LeaveType` CRUD + activate/deactivate                 | Reused. Legacy's five types are seed data, not hard-coded rules.                                      |
| Calendar-day count                | `calendarDays` inclusive, no exclusions                | Matches legacy. Not changed.                                                                          |
| Balance (quota, taken, available) | None                                                   | **Not built.** Already recorded as "not built by decision" in `HR_API.md` §6. Needs a policy.         |
| Balance deduction on approval     | None                                                   | Same as above.                                                                                        |
| Attendance effect on approval     | Derived at read time from `APPROVED` rows (`ON_LEAVE`) | Kept. The legacy comment describes a write-through sync; production's derivation is the safer design. |
| Half-days                         | Not supported                                          | **Not built.** Recorded as not built in `HR_API.md`.                                                  |
| Cancel / withdraw / resubmit      | Not supported                                          | **Not built.** Legacy has no such flow; a cancellation policy is unapproved.                          |
| Overlap                           | Enforced by DB exclusion constraint                    | Stricter than legacy (legacy has no check). Kept.                                                     |
| Maker-checker                     | Enforced                                               | Stricter than legacy. Kept.                                                                           |
| Admin notification on submit      | Not implemented                                        | **Unresolved.** No notification subsystem in the production HR module yet.                            |
| Employee notification on decision | Not implemented                                        | Same.                                                                                                 |
| Negative balance                  | Not applicable (no balance)                            | Unresolved with balances.                                                                             |

## 4. Unresolved / undocumented

These cannot be verified from legacy or are not approved. None were invented.

1. **Balance model:** whether quotas are annual or accrued monthly, whether unused days carry forward, and whether a request beyond balance is blocked or allowed. Legacy shows no accrual or carry-forward code; the quota is a manual figure.
2. **Paid vs unpaid leave:** no paid or unpaid flag exists in legacy or production. Payroll impact is therefore undefined.
3. **Holiday and weekly-off exclusion from leave days:** legacy counts them; attendance treats them with precedence. Whether a leave day that falls on a holiday consumes balance is unknown.
4. **Half-day representation:** not in legacy.
5. **Approval hierarchy:** legacy uses role checks (`admin`/`hr`/`manager`). Production uses permissions and team scope. Whether a reporting manager must approve before HR is unknown.
6. **Cancellation and resubmission:** not in legacy; cancelling an approved request would need attendance reversal, which is not designed.
7. **Notifications:** legacy posts to an admin feed; production has no equivalent wired to Leave.
8. **Legacy attendance sync:** the legacy comment says approval syncs attendance; the mechanics were not fully traced. Production's approach does not need them.
9. **Legacy team scoping:** not visible in legacy code.

## 5. Changes made in this task

No runtime code changed. The existing Leave foundation already covers the verified legacy scope, and every gap above is either an unapproved policy or intentionally out of scope. Adding balance or cancellation logic now would invent business rules. This document is the parity record. Any change to the open items needs an explicit policy decision first.
