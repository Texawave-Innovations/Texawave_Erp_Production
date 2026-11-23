# HR Module Audit — 2026-11-19

**Method and confidence.** Six parallel read-only code audits (RBAC; attendance + timesheets; leave/exit/expense;
employee lifecycle; payroll; tasks/tickets/portal/schema). **Nothing was executed** — no tests, build or DB runs.
Every finding is from reading code. Findings marked **[V]** were re-read by the lead and confirmed in the cited lines;
all others are agent-reported and should be treated as _probable_ until reproduced. Items an agent could not confirm are
marked _unverified_.

**Not covered:** line-by-line review of every one of the ~140k HR lines; CSV import/export, attendance-alerts scheduler,
leave delegations internals, notification service internals, DB triggers, UI component internals (only hooks/api/schema
files were contract-checked), Mermaid workflow diagrams (transitions below are listed as text, not diagrammed),
Postman collections. Re-run the audit on those before calling the module "clean".

## 1. Executive summary

The module is more defensive than typical: every HR route carries a permission decorator, all 289 permission strings used
exist in the catalog, no hardcoded role-name checks in the API, leave/attendance/payroll writes use advisory + row locks,
DB exclusion constraints back overlap rules, and out-of-scope ids return 404. No P0 found.

Main weaknesses:

1. **Account/identity boundary** — deactivated users keep access for ≤15 min (RBAC-2 [V]); HR can set any linked user's
   password (EMP-2/RBAC-1); sensitive IDs readable via the ordinary read permission (EMP-1).
2. **Lifecycle not wired together** — exit requests, employee status, leave, payroll and login revocation are separate
   islands (EX-1, LV-1, PAY-3, EMP-13).
3. **Destructive hard-delete of employees** wipes payroll/statutory data (DB-1 [V]).
4. **Payroll calculation gaps** with financial impact (PAY-1, PAY-2, PAY-6, PAY-9) and no idempotency on bonuses.
5. **Notification recipient selection leaks** ticket/task content to every `hr.*` holder (XM-1 [V]).
6. **HR Teams UI is a localStorage mock** (EMP-5).

## 2. Feature matrix (status from audits)

| Feature                                                              | Status                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Employees CRUD / onboarding wizard / review                          | Real, transactional, audited; gaps EMP-1..4,6,8..12,15,16                                   |
| Profiles, documents                                                  | Real; scope/authz gaps (EMP-8, EMP-9)                                                       |
| Org chart                                                            | Real, read-only, cycle-safe                                                                 |
| Teams                                                                | **API: GET only. UI: mock** (EMP-5)                                                         |
| Departments                                                          | CRUD, no delete guard, no audit (EMP-11, EMP-16)                                            |
| Offer/promotion/revision letters, interviews                         | Document generators only; not linked to employee/comp (EMP-14)                              |
| Attendance (punch, auto-checkout, corrections, month lock)           | Real; overnight + stale-session gaps (ATT-1..4). **No late/early/break calculation exists** |
| Shifts, weekly off, holidays, location privilege                     | Real, constraint-backed                                                                     |
| Timesheets                                                           | Real, 2-level review; no hours-vs-attendance check (TS-1)                                   |
| Leave types/entitlements/requests                                    | Real, lock-protected, concurrency-safe; policy-edit and backdating gaps (LV-2, LV-3)        |
| Exit requests                                                        | Workflow only; no effect on employee/login/payroll (EX-1)                                   |
| Expense claims                                                       | Approve/reject only; no payment link (EC-1)                                                 |
| Payroll (structures, runs, PF/ESI/PT/TDS, loans, bonuses, payslips)  | Real, period-locked; calc gaps PAY-1..9                                                     |
| PF/ESI remittance tracking                                           | Not implemented (PAY-10)                                                                    |
| Bank payments                                                        | Manual flag only, no bank integration (PAY-11)                                              |
| Tasks, tickets                                                       | Complete, UI↔API contract verified                                                          |
| Employee self-service / portal                                       | Complete; API is the real boundary                                                          |
| Recruitment/candidates, work logs, performance, appraisals, training | Not implemented / catalog entries with no route                                             |

## 3. Verified workflow transitions (text)

- **Onboarding:** user created separately in IAM (no invitation flow exists) → `POST /hr/employees` (ACTIVE,
  PENDING_ACTIVATION, NOT_SUBMITTED; code issued under counter lock) → link-user → forced password change → wizard →
  submit (COMPLETE/PENDING_REVIEW) → HR approve (not self) or send back. **Approval gates nothing** — employee is ACTIVE
  from creation; the portal opens at COMPLETE.
- **Lifecycle:** ACTIVE ↔ INACTIVE (INACTIVE deactivates the user + logout; back to ACTIVE re-enables it); → RESIGNED/TERMINATED (terminal; deactivates user + logout). Exit-request approval
  does **not** trigger this.
- **Leave:** PENDING→APPROVED (not self, reporting line/scope, balance re-check, 2-level optional) / REJECTED /
  CANCELLED; APPROVED→CANCELLED (employee only if start > today; HR any time with reason); resubmit from
  REJECTED/CANCELLED if start ≥ today. All under advisory + FOR UPDATE.
- **Attendance:** check-in (upsert per IST date, partial unique open session) → check-out → auto-checkout job; corrections
  SUBMITTED→APPROVED/REJECTED; month lock → SUBMITTED → APPROVED (second approver) / RETURNED → REOPENED.
- **Timesheet day:** DRAFT/REJECTED→SUBMITTED→(L1)→APPROVED | REJECTED; HR reopen needs note.
- **Payroll period:** DRAFT→PROCESSED→APPROVED (maker-checker)→FINALIZED→REOPENED (refused if any payment PAID).
- **Loans:** PENDING_HR→PENDING_ADMIN→ACTIVE→CLOSED.

## 4. Bug register

Severity: P1 = core workflow / permission / integrity; P2 = partial/incorrect behaviour; P3 = minor.
**[V]** = verified by lead re-read. Files relative to `apps/api/src/modules` unless noted.

### P1

| ID                     | Issue                                                                                                                                                                                                                        | Where                                                                                            | Minimal fix                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| RBAC-2 / EMP-3 **[V]** | Deactivated/exited user's access token keeps full permissions until expiry (permission lookup never checks `user.isActive`/`deletedAt`; JwtStrategy does no DB check)                                                        | `platform/roles-permissions/permissions.repository.ts:17-29`, `platform/auth/jwt.strategy.ts:24` | Filter `user:{isActive:true,deletedAt:null}` in `findPermissionCodesForUser`        |
| XM-1 **[V]**           | `notifyAdmins` treats any role with an `hr.*`/`settings.*` permission (or email containing "admin") as admin → ticket subjects/task content go to Employee/Team Lead users; fallback notifies an arbitrary user              | `platform/notifications/notifications.repository.ts:183-196`                                     | Select by explicit write codes; fallback = no recipients                            |
| DB-1 / EMP-10 **[V]**  | Hard-delete employee deletes payroll entries, payslips, payments, PF/ESI, loans, tax declarations, and _other people's_ project tasks; doc comment claims it blocks on linked records; leaves login active and files on disk | `hr/employees/employees.repository.ts:951-961`                                                   | Block on payroll/statutory/loan rows (409); unassign project tasks; deactivate user |
| EX-1 / EMP-13          | Completing an exit request changes nothing (employee stays ACTIVE, login live, no settlement)                                                                                                                                | `hr/exit-requests/*`                                                                             | Tie COMPLETED to lifecycle `changeStatus` or block until status change done         |
| RBAC-1 / EMP-2         | `set-portal-password` + `link-user` (only `hr.employee_account.write`) let HR set any user's password incl. admins; uses `adminSetPassword` which clears `mustChangePassword`; 6-char min; no audit                          | `hr/employees/employee-lifecycle.service.ts:34-61`                                               | Use audited `resetPasswordByAdmin` (forces change), refuse privileged targets       |
| EMP-1 / RBAC-3         | `hr.employee.read.team` (Team Lead default) returns plaintext PAN/Aadhaar via `GET /hr/employees/:id/government-ids`, bypassing `hr.employee_sensitive.read`; PUT unaudited                                                  | `hr/employees/employees.controller.ts:200-229`, `employee-personal-data.service.ts:131`          | Gate on `hr.employee_sensitive.*` or mask + audit                                   |
| EMP-5                  | HR Teams UI is a localStorage mock; API has only `GET /hr/teams`; member count hard-faked                                                                                                                                    | `apps/ui/src/features/hr/teams/utils.ts:6-48`                                                    | Real teams CRUD API or hide route                                                   |

### P2

LV-1 leaver's pending leave approvable; LV-2 policy edits rewrite history/negative balances; LV-3 unlimited backdating;
EX-2 exit approval needs no data; EX-3 no withdraw/rescind; EC-1 approved claim never reaches payroll/finance;
ATT-1 stale open session blocks all future check-ins when auto-checkout off (`hr/attendance/attendance.repository.ts:172`);
ATT-2 overnight shifts truncated/uncorrectable; ATT-3 rejected correction blocks re-request forever
(`corrections/attendance-corrections.repository.ts:153`); ATT-4 MISSED_CHECK_OUT can't apply to auto-closed session;
ATT-7 manual-edit dialog shifts punch times in non-IST browsers
(`apps/ui/.../ManualEditAttendanceDialog.tsx:65-70`);
PAY-1 approved loan-skip double-charges EMI (`payroll/loans/loans.repository.ts:~603-640`);
PAY-2 mid-month salary revision not split (`runs/payroll-calculator.service.ts:226-243`);
PAY-3 default run excludes leavers; PAY-4 TDS ignores leavers; PAY-5 unverified declarations reduce TDS, no caps;
PAY-6 net clamped to 0 with uncapped deductions (`:756-761`); PAY-7 bonus/gratuity creation not idempotent;
PAY-8 sensitive exports unaudited; XM-2/RBAC-5 work-permission decide non-atomic, un-audited, no self-decision guard,
`@OrgScoped` only; TSK-1 no separation of duties on task approve; DB-2 append-only triggers dropped but docs/schema
comment/e2e still claim them (`apps/api/test/hr-tickets.e2e-spec.ts:755-771` likely fails); EMP-6 team transfer doesn't
sync child-table `teamId` (old lead keeps seeing docs); EMP-7 reporting-cycle race _(unverified)_; EMP-8 HR delete removes
onboarding docs; EMP-9 doc upload ignores write scope, free-text `documentType`; EMP-11 department delete with
employees attached; EMP-12 create-employee can link `userId` without account permission; EMP-14 letters don't drive
employee/comp; EMP-15 force-approve indistinguishable in audit; EMP-16 missing audit (departments, personal data,
documents); EMP-4 INACTIVE/unlink/delete leave login usable; RBAC-4 `users.user.write`/`settings.role.write` allow
privilege escalation (no subset check; default-held by Super Admin only).

### P3

LV-4..8, EX-4/5, EC-2..5, ATT-5/6/8/9/10, TS-1..3, PAY-9..15, RBAC-6..9, PORTAL-1/2, XM-3..5, TSK-2, TKT-1, EMP-17..21
(incl. `font-mono` violations of CLAUDE.md in 9 UI files, EMP-18). Details are in the agent reports summarised in
the session; promote any to P2 on reproduction.

## 5. Pending decisions (not safe to guess)

1. **Employee hard-delete policy (DB-1/DB-2):** block-if-payroll (recommended) vs. restore append-only triggers +
   soft-delete only.
2. **Exit ↔ lifecycle (EX-1):** should completing an exit auto-run status change + login disable?
3. **Mid-month salary revision (PAY-2) and leaver TDS (PAY-4):** proration rules are a payroll/finance business call.
4. **Net-pay floor (PAY-6):** defer/carry-forward vs. cap.
5. **Backdating window (LV-3), policy immutability (LV-2).**
6. **New permission verbs** (`hr.task.approve`, force-approve, work-permission team scopes) — permission expansion needs approval.
7. **Teams CRUD (EMP-5):** needs API contract + migration approval.
8. Migrations needed: unique partial index on bonuses (PAY-7), one-live-run-per-period, `tasks(createdByEmployeeId)` index.

## 6. Implementation results

See §7 (filled in as fixes land).

## 7. Applied fixes

**Batch 1 — RBAC-2 / EMP-3 (inactive users keep permissions)**

- Changed: `apps/api/src/platform/roles-permissions/permissions.repository.ts` — `findPermissionCodesForUser` now
  requires `user: { isActive: true, deletedAt: null }`, so a deactivated/deleted user resolves to zero permissions.
  No schema/migration/API-contract change; fails closed.
- Run: `npx tsc --noEmit -p tsconfig.json` (apps/api) → exit 0; `npx vitest run src/platform/roles-permissions` →
  3 files, 29 tests passed. **Caveat:** those specs mock the repository, so they do not exercise the new `where`
  clause. Still required: an api e2e (login → deactivate user → same access token → expect 403) in
  `apps/api/test/`, not yet written or run (needs the disposable Postgres/Redis per `apps/api/test/README.md`).
- Residual risk: permissions are cached (15 min, `permissions.service.ts`); deactivation paths that don't invalidate the
  cache (the agent confirmed `auth.logout` does; `users.user.write` deactivation was not checked) may still lag.
  Touches auth → needs reviewer sign-off per CLAUDE.md.

**Batch 2 — EMP-1, EMP-2, XM-1** (typecheck: api `tsc` exit 0, ui `tsc` exit 0, eslint clean on touched api dirs;
`npx vitest run src/platform src/modules/hr/employees` → 30 files / 306 tests passed. e2e **not run**: needs the
disposable Postgres/Redis per `apps/api/test/README.md`.)

- **EMP-1:** `GET/PUT /hr/employees/:id/government-ids` now require `hr.employee_sensitive.read/write`
  (`employees.controller.ts`). Only consumer is the HR "edit on behalf" onboarding dialog; HR Manager holds both codes.
  Team Leads now get 403. PUT remains unaudited (EMP-16 still open).
- **EMP-2:** `set-portal-password` now goes through audited `resetPasswordByAdmin`, which sets
  `mustChangePassword = true` and writes an audit row (`auth.service.ts` `adminSetPassword` takes `performedBy`;
  `employee-lifecycle.service.ts`). Existing login/change-password enforcement is reused unchanged: login/`me`
  report `user.mustChangePassword` (`auth.service.ts:355`) and `/auth/change-password` clears it via
  `updatePasswordHash` (`users.repository.ts:523`). **Password policy deliberately unchanged** (6–72 chars, UI Save
  at 6) — a stronger policy needs explicit approval. Still does not refuse privileged target users (RBAC-1 open).
  An e2e for this endpoint (set → login reports true → change → false) does not exist yet and was not run.
- **XM-1:** admin-recipient test in `notifications.repository.ts` now uses `hr.workspace.access` (pinned by
  `default-roles.test.ts` to HR Manager, absent from Employee/Team Lead) instead of the `hr.` prefix. Email-contains-
  "admin" heuristic and the `users.slice(0,1)` fallback are **unchanged** — pending decision. Needs an e2e: Employee
  user must not receive another user's ticket notification.

**Reclassified after checking docs/tests (NOT changed):**

- **ATT-3** is a documented legacy rule ("one request per date, whatever its status",
  `ATTENDANCE_ARCHITECTURE.md:193`) and e2e `hr-attendance.e2e-spec.ts:605-633` asserts it. Product decision, not a bug.
- **ATT-1** is by design: a stale open session is surfaced as `MISSING_CHECKOUT` and resolved by an employee
  `MISSED_CHECK_OUT` correction (`ATTENDANCE_ARCHITECTURE.md:266,286,295`). Downgrade to P3 UX concern; ATT-4
  (that correction fails on _auto-closed_ sessions) remains the real gap.
