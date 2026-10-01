# HR Backend — Implementation Readiness Review

|                         |                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository / branch** | `Texawave_Erp_Production`, `feature/HR` (identical to `main` @ `73bbb16`), nothing committed                                                          |
| **Date**                | 2026-09-30                                                                                                                                            |
| **Purpose**             | Record what Phase 0 delivered, and list every business/architecture decision that is **still unresolved** so HR implementation does not invent policy |
| **Old ERP**             | `TexaWave_ERP` was only _read_. Facts quoted from it below are evidence of past behaviour, **not** approved requirements                              |
| **Status**              | **Stopped for approval.** No HR table, endpoint or migration beyond Phase 0a exists                                                                   |

Rule used throughout: where the business has not decided, the rule is either stored as **configurable master data** or **left unimplemented and listed here** — never hard-coded.

---

## 1. Phase 0 status

| #   | Item                                                          | State                            | Evidence                                                                        |
| --- | ------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 0a  | Drift fix migration `20260930092410_drop_updated_at_defaults` | **Done, applied to dev DB**      | `migrate status` up to date; CI drift command "No difference detected" (exit 0) |
| 0b  | Commit scopes `hr`, `employees`, `attendance`                 | **Done** (own change)            | commitlint accepts the 3 new scopes, still rejects unknown/upper-case           |
| 0c  | Any-scope permission guard + team-scope proof                 | **Done** (own change)            | 75 unit / 37 e2e passing; mutation-checked                                      |
| 0d  | Audit platform                                                | **Designed only** (as requested) | `reports/AUDIT_PLATFORM_DESIGN.md`                                              |
| 0e  | Permission catalogue + non-destructive sync                   | **Done** (own change)            | 33 tests (incl. 4 on real Postgres), CLI exercised end-to-end                   |
| —   | `@nestjs/event-emitter`                                       | **Not added**                    | see decision X-1                                                                |

Change-set boundaries (files) are listed in the phase report so each can be reviewed/committed separately.

## 2. Findings that shaped Phase 0 (all verified by running code)

1. **The permission guard matched one exact string**, so a route could not admit `.own`/`.team`/`.all` holders; the docs' own example (`@RequirePermission("hr.employee.read.team")`) would have locked HR (`.all`) out of the employee list. Fixed with `@RequireScopedPermission(prefix)`; `@RequirePermission` unchanged.
2. **`TeamContextService` counted deactivated memberships** (`isActive:false`) and ignored the organization and the team's own state — a revoked team lead kept access. Fixed; revocation is now immediate (e2e-proved).
3. **`teamWhere` overwrote a caller's `teamId`/`userId` filter** with the scope clause (silently returning the wrong rows, not a leak) and could not address tables keyed via `employee_id`. Now AND-composed with an optional dotted field path.
4. `resolveScope` threw a plain `Error` (would surface as a 500) when no variant was held; now `ForbiddenException` (403).
5. `docs` showed `resolveScope()` without `await` though it is async; corrected.
6. The seed's Super Admin grant reset (`deleteMany`+`createMany`) is destructive on re-run — acceptable for a local seed, unusable for production; the new sync never touches grants.

## 3. Unresolved business decisions

Legend: **OPEN** = needs an answer before the affected work starts. **DEFAULT** = I will use the stated default unless told otherwise; still needs a sign-off.

### 3.1 Employment types and probation / notice rules — **OPEN**

- _Old ERP (evidence only):_ `employmentType` ∈ Permanent, Contract, Temporary, Intern. **No probation concept exists anywhere in the old code.** Notice period appears only on the _exit request_ form (`noticePeriodDays`, user-typed, defaults to 30) — not as a per-type rule.
- _Proposal:_ `employment_types` is **master data** (rows, not an enum or `CHECK`): `code`, `name`, `is_active`, plus **nullable** `probation_days` and `notice_days`. No code path enforces or defaults either number.
- _Not implemented until answered:_ whether probation exists and its length; automatic probation-end date; whether notice differs by type; whether an intern/contract type can be confirmed/converted; who may change type.
- **Questions for HR:** (1) Which types exist at go-live and are they exactly the four above? (2) Is there a probation period — per type, fixed, or per hire? (3) Notice period: per type, per designation, or per exit request as today? (4) Does probation/notice affect leave, attendance or payroll?

### 3.2 Team-lead permissions — **DEFAULT: read-only**

- Catalogue will seed all three variants of every team-scoped permission (`.own`/`.team`/`.all`) — seeding is not granting.
- Proposed role grants: **Team Lead** → `hr.employee.read.team` only; **HR Manager** → `hr.employee.read.all` + `hr.employee.write.all`; **Employee** → self-service only. `hr.employee.write.team` is seeded but **granted to no role**.
- Consequences to confirm: a team lead cannot create or edit employees, cannot see `employee_sensitive_info`, cannot change status. Leave approval by team lead (`hr.leave.approve.team`) is a **separate** decision (§3.7).
- Roles are data managed in Settings → Roles; this is a starting seed for dev, not enforced code.

### 3.3 Employee code generation and uniqueness — **OPEN (format) / DEFAULT (mechanism)**

- _Format conflict:_ the brief suggests `EMP-000001`; the old ERP uses `EMP0001` (4-digit, no hyphen) and its create form falls back to a **hard-coded `EMP0010`** when none is given (a defect — must not be copied). `Docs/ARCHITECTURE.md` §5.3 specifies `document_sequences (prefix, next_number, format)`.
- _DEFAULT mechanism (safe under concurrency):_ `document_sequences` row per `(organization_id, doc_type='employee')`, incremented with a single atomic `UPDATE … SET next_number = next_number + 1 RETURNING` inside the employee-create transaction (row lock; no count-then-increment); `UNIQUE (organization_id, employee_code)`; code is immutable after creation (DB trigger or no update path + test); never reused after soft delete.
- _Decisions:_ (1) exact format — `EMP-000001` vs `EMP0001`; (2) do existing employees from the old system keep their old codes (import is **out of scope** unless approved); (3) does the code ever need a per-department/type prefix.

### 3.4 Employment status values and transitions — **OPEN**

- _Brief proposes:_ ACTIVE, INACTIVE, ON_LEAVE, NOTICE_PERIOD, TERMINATED. _Old ERP has:_ Active, Inactive, Resigned, Terminated, with a **separate exit-request workflow** (submitted → under_review → approved/rejected → completed).
- _Concerns:_ (a) `ON_LEAVE` — the brief itself says status must not replace approved leave; leave-for-a-date is derived from `leave_requests`, so a status would duplicate and drift. **Recommend not including it.** (b) `NOTICE_PERIOD` — is it a stored status or derived from an approved exit request? (c) `RESIGNED` vs `TERMINATED` — payroll/settlement usually needs the distinction; the brief has only TERMINATED. (d) Is `INACTIVE` "left the company" or "temporarily disabled"? Two meanings cannot share one value.
- _Proposed set for approval:_ `ACTIVE`, `INACTIVE`, `NOTICE_PERIOD`, `RESIGNED`, `TERMINATED` (text + `CHECK`), with exit reason/date captured on the transition.
- _Proposed transitions (NOT approved):_

  | From → To     | ACTIVE        | INACTIVE | NOTICE_PERIOD | RESIGNED | TERMINATED |
  | ------------- | ------------- | -------- | ------------- | -------- | ---------- |
  | ACTIVE        | –             | ✔        | ✔             | ✔        | ✔          |
  | INACTIVE      | ✔             | –        | ✔             | ✔        | ✔          |
  | NOTICE_PERIOD | ✔ (withdrawn) | ✘        | –             | ✔        | ✔          |
  | RESIGNED      | ✘             | ✘        | ✘             | –        | ✘          |
  | TERMINATED    | ✘             | ✘        | ✘             | ✘        | –          |

  Open: is re-hire = reactivate the same record or a new employee with a new code? Reactivating from a terminal state is proposed as **not allowed** without an explicit approved "re-hire" action.

- _Fixed by the brief:_ every transition records actor, timestamp, reason (proposed table `employee_status_history`, see audit design §7); attendance/payroll gate on `date_of_joining`/`date_of_exit`.

### 3.5 HR permissions (proposed catalogue — nothing added yet)

Names follow `Docs/CODING_STANDARDS.md` §2a; team-scoped ones are seeded as all three variants via `scopedPermission()`.

| Area          | Permissions                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master data   | `master.designation.read/write`, `master.employment_type.read/write`, `master.department.read/write`, `master.work_location.read/write`, `master.shift.read/write`    |
| Employees     | `hr.employee.read.{own,team,all}`, `hr.employee.write.{own,team,all}`, `hr.employee_status.write.all`, `hr.employee_account.write.all` (link/unlink user)             |
| Sensitive PII | `hr.employee_sensitive.read.all`, `hr.employee_sensitive.write.all` (read is audit-logged)                                                                            |
| Shifts        | `hr.shift_assignment.read/write.{team,all}`                                                                                                                           |
| Calendar      | `hr.holiday.read`, `hr.holiday.write`, `hr.weekly_off.read`, `hr.weekly_off.write`                                                                                    |
| Leave         | `hr.leave_type.read/write`, `hr.leave_request.read.{own,team,all}`, `hr.leave_request.create.own`, `hr.leave_request.cancel.{own,all}`, `hr.leave.approve.{team,all}` |
| Self-service  | `employee_self_service.profile.read`, `employee_self_service.leave_request.read/create/cancel`                                                                        |
| Audit         | `audit.log.read`                                                                                                                                                      |

**Open:** whether `.own` write exists for the profile (self-edit of phone/address) — proposed no for v1; whether team-scoped holiday/shift visibility is needed (proposed org-wide read for calendar, team/all for assignments).

### 3.6 Audit requirements — **DEFAULT (design pending sign-off)**

Required by the brief, all via the transactional writer in `AUDIT_PLATFORM_DESIGN.md`:

| Entity                     | Audited actions                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| employee                   | create, update, activate/deactivate                                |
| employee status            | every transition (+ history row)                                   |
| employee ↔ user mapping    | link, unlink, change                                               |
| shift assignment           | create, end, change                                                |
| holiday / weekly-off       | create, update, deactivate                                         |
| leave request              | submit, approve, reject, cancel                                    |
| administrative corrections | any HR override, with mandatory reason                             |
| sensitive PII              | reads (`read_sensitive`) and writes (changed **field names only**) |

Never logged: passwords, raw/hashed tokens, activation secrets, PII values. Open items = design decisions A-1…A-6 in that document.

### 3.7 Other decisions still open (not requested, but blocking specific phases)

| ID   | Decision                                                                                        | Blocks                            | Proposal / evidence                                                                                                                                                                                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1  | Leave types list, half-day support, balances/accrual, carry-forward                             | Leave phase                       | _Old ERP:_ leave request = start/end date + free-text reason, Pending/Approved/Rejected; **no type on the request, no half-day, no cancel, no balance rules** in the type; leave types are a bare string list. Nothing to port — every rule must be defined. Leave balances will **not** be built until rules are approved (per brief). |
| L-2  | Who approves leave (team lead / HR / both), self-approval, cancel-after-approval, overlap rules | Leave phase                       | Brief: "no silent approval". Default: maker ≠ checker.                                                                                                                                                                                                                                                                                  |
| S-1  | Shift fields: grace, break, overnight, target minutes                                           | Shift phase                       | _Old ERP shift_ = name + start + end + assigned employee list only. Everything else is new policy; columns are nullable/configurable, nothing hard-coded.                                                                                                                                                                               |
| C-1  | Weekly-off model (per org / location / team / employee), Sunday assumption                      | Calendar phase                    | Brief forbids assuming Sunday. _Old ERP:_ a holiday name list only.                                                                                                                                                                                                                                                                     |
| C-2  | Work locations: needed?                                                                         | Master data                       | Brief: "if required by existing behaviour" — the old ERP has no location master. **Proposal: omit until requested.**                                                                                                                                                                                                                    |
| D-12 | `timestamptz` for new tables (repo default is `TIMESTAMP(3)` without zone)                      | All new tables                    | Proposal: `@db.Timestamptz(6)` for time-critical columns; document as ADR. Business dates (joining, holiday) are `DATE`.                                                                                                                                                                                                                |
| D-05 | Activation / password setup                                                                     | Deferred by you                   | The teammate's branch has a password-reset flow; reuse it if merged. Until then employees have **no login** (`user_id` nullable).                                                                                                                                                                                                       |
| X-1  | `@nestjs/event-emitter`                                                                         | Attendance reacting to HR changes | Not needed for HR (audit + user deactivation are synchronous/transactional). `CODING_STANDARDS.md` §11 makes EventEmitter2 the _default for async side effects_, so this is a documented deviation until Attendance needs it.                                                                                                           |
| X-2  | Old-employee data import                                                                        | —                                 | Out of scope unless approved.                                                                                                                                                                                                                                                                                                           |

## 4. Platform risks carried into HR

1. **Teammate branch overlap** — `origin/feat/hr-employee-attendance-backend` (unmerged) adds `users` CRUD, `departments` API, password-reset, `/auth/me`, menu, `usePermission`, and migrations `20260926…`/`20260928…`. HR builds on `main`; merging later will need migration-history reconciliation (its `add_menu_items` already contains the same three `DROP DEFAULT`s — harmless duplicates) and a check that its `usePermission`/menu code understands scoped permissions. **Not merged or reconciled, per instruction.**
2. **Existing e2e suites write to whatever `DATABASE_URL`/`REDIS_URL` is set and leave permission rows behind.** I ran all suites on a disposable DB + Redis index 5. Recommend a documented `test:e2e` setup (own DB, own Redis index) before more e2e suites are added.
3. **Module-privacy lint rule only guards top-level `modules/<name>`**; sub-features inside `modules/hr/` can import each other's repositories without a lint failure — review discipline needed (or a tightened rule, which is a shared-config change).
4. **No rate limiting / helmet / login lockout** (out of HR scope; relevant to the activation flow later).
5. **Permission delivery needs a pipeline step** — `deployment/` contains only placeholders; whoever owns deployment must add `permissions:sync` after `migrate deploy`.
6. **Old ERP evidence is thin on HR policy** — most rules are undefined there, so "port the behaviour" is not an available shortcut for leave, shift policy or lifecycle.

## 5. Proposed HR build order once approved

1. Audit platform (per design) → 2. HR master data (designations, employment types, work locations only if approved) → 3. Employees + status history + employee-code sequence + user mapping → 4. Shifts + assignments (raw-SQL no-overlap constraint) → 5. Calendar → 6. Leave (only the rules approved in §3.7) → 7. HR permissions in the catalogue, roles seed, docs, completion gate.

Each step: one module per change, migration reviewed, e2e written before review, docs updated in the same change.

## 6. What I need from you to start HR

Answers or explicit "use the default" for: **3.1** (types/probation/notice), **3.3** (code format), **3.4** (status set + transitions), **3.5** (permission list), audit decisions **A-1…A-6**, plus approval to merge/keep the Phase 0 changes as separate reviewed changes.
