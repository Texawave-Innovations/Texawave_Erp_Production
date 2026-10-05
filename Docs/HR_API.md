# HR backend — API contract

**Scope:** audit platform, HR master data, employees, shifts and shift assignments, holiday and
weekly-off calendar, leave. **Backend only** — no UI exists for any of it.
**Status:** implemented and tested on `feature/HR`; **not merged**. **Owner:** unassigned (see the readiness
report). Companion documents: `reports/HR_BACKEND_COMPLETION_REPORT.md` (what was verified, what is open),
`reports/AUDIT_PLATFORM_DESIGN.md`, `reports/HR_IMPLEMENTATION_READINESS.md` (the decisions).

Everything here is verified against the code by the e2e suites in `apps/api/test/hr-*.e2e-spec.ts`,
`master-data`, `audit`, `team-scope`. Where a rule is an **assumption awaiting approval** it is marked ⚠.

---

## 1. Conventions (all routes)

|                     |                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix / versioning | none (`/hr/...`, `/master-data/...`, `/self-service/...`, `/audit/...`)                                                                                                                                                               |
| Auth                | Bearer access token on every route (global `JwtAuthGuard`); 401 without one                                                                                                                                                           |
| Success body        | `{ "data": … }`; lists add `"meta": { page, limit, total, totalPages }`                                                                                                                                                               |
| Error body          | `{ statusCode, message, error, path, timestamp, correlationId }`; `error` is a **stable code** for business errors (§8)                                                                                                               |
| Pagination          | `?page=1&limit=20` (limit ≤ 100), `?order=asc\|desc`, per-endpoint `sortBy`                                                                                                                                                           |
| Ids                 | integer `id`. Employees also have a human `employeeCode` (`EMP-000001`) — never use the code as a foreign key                                                                                                                         |
| Dates               | **business dates are `YYYY-MM-DD` strings** with no time zone. Times of day are `HH:MM`. Timestamps (`createdAt`…) are ISO instants                                                                                                   |
| Validation          | DTOs are whitelisted: **an unknown body field is a 400** (this is how client-supplied `organizationId`, `status`, `employeeId`, `employeeCode`… are refused). Unknown _query_ parameters are ignored (platform `@Paginate` behaviour) |
| Organization        | taken from the token, never from input. Another organization's ids behave as **404** (or 422 when referenced from a body) — indistinguishable from "does not exist"                                                                   |
| Deletion            | **no DELETE route exists anywhere.** Rows are deactivated, ended, voided or decided — history is never removed                                                                                                                        |
| Writes              | each is one transaction containing the change **and its audit row**; if either fails, neither happens                                                                                                                                 |
| Concurrency         | uniqueness/overlap are enforced by PostgreSQL constraints (unique indexes, exclusion constraints), row locks and an optimistic `version` where noted                                                                                  |

**Scopes** (`.own` / `.team` / `.all`) apply to employee-linked data. A route guarded "any of X.{own,team,all}"
admits any holder; the service then narrows the rows: `.all` → everyone in the organization, `.team` →
employees in the caller's teams (from `user_team_access`), `.own` → the employee linked to the caller's
login. Outside the scope a record is **404**, not 403.

---

## 2. Endpoints

`○` = organization-wide (exact permission). `▲` = own/team/all scope.

### Audit (`platform/audit`)

| Method & path     | Permission         | Notes                                                                                                                                                                                      |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/audit/logs` | `audit.log.read` ○ | filters `entityType, entityId (needs entityType), actorUserId, action, from, to`; newest first. Read-only — no write route exists. Rows show the acting user's name, IP and correlation id |

### Master data (`modules/master-data/*`, `modules/hr/leave-types`)

For each of `designations`, `employment-types`, `work-locations`, `shifts` (under `/master-data/…`) and
`leave-types` (under `/hr/leave-types`): `GET` list · `GET :id` · `POST` · `PATCH :id` · `POST :id/deactivate` ·
`POST :id/activate`. Permission `master.<entity>.read|write` (`hr.leave_type.read|write` for leave types) ○.
List filters: `search` (code/name), `isActive`, `sortBy` (`name\|code\|createdAt`), pagination.

- `code` — 2–30 chars, `A–Z 0–9 _`, upper-cased on input, **immutable**. `name` — unique per organization, case-insensitively.
- Deactivate is idempotent and audited once. It does not touch existing records; **new** assignments to an inactive value are refused (422).
- Employment types are seeded per organization: `PERMANENT, CONTRACT, TEMPORARY, INTERN`. `probationDays` / `noticeDays` are stored but **no rule reads them** (⚠ open policy).
- **Shifts:** `startTime`, `endTime` (`HH:MM`), `workingMinutes` (≤ the start–end window). `isOvernight` is **derived** (end earlier than start) and cannot be sent. Start = end is refused. A shift that is still assigned from today onward cannot be deactivated (409). No break/grace/half-day fields exist — unapproved policy.

### Employees (`modules/hr/employees`)

| Method & path                              | Permission                           | Notes                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/hr/employees`                        | `hr.employee.read` ▲                 | filters `search, status, teamId, departmentId, designationId, employmentTypeId, workLocationId, reportsToId, hasUser, joinedFrom, joinedTo`, `sortBy` (`employeeCode, fullName, dateOfJoining, status, createdAt`). **List rows omit phone, e-mail and exit reason** |
| GET `/hr/employees/:id`                    | `hr.employee.read` ▲                 | full record incl. `version`, `userId`                                                                                                                                                                                                                                |
| GET `/hr/employees/:id/status-history`     | `hr.employee.read` ▲                 | append-only business history                                                                                                                                                                                                                                         |
| POST `/hr/employees`                       | `hr.employee.write` ▲                | `.all` anywhere; `.team` only in own team(s); `.own` → 403. Code is generated                                                                                                                                                                                        |
| PATCH `/hr/employees/:id`                  | `hr.employee.write` ▲                | **`version` required** (409 `VERSION_CONFLICT` if stale). `.team` writers may not change `teamId, departmentId, designationId, employmentTypeId, dateOfJoining`                                                                                                      |
| POST `/hr/employees/:id/status`            | `hr.employee_status.write` ○         | `{status, effectiveDate, reason}`                                                                                                                                                                                                                                    |
| POST `/hr/employees/:id/status-correction` | `hr.employee_status.correct` ○       | same body; the only way out of RESIGNED/TERMINATED                                                                                                                                                                                                                   |
| POST `/hr/employees/:id/link-user`         | `hr.employee_account.write` ○        | `{userId, reason?}`                                                                                                                                                                                                                                                  |
| POST `/hr/employees/:id/unlink-user`       | `hr.employee_account.write` ○        | `{reason?}`                                                                                                                                                                                                                                                          |
| GET `/self-service/profile`                | `employee_self_service.profile.read` | the caller's own employee record; **no id in the request**                                                                                                                                                                                                           |

Rules:

- **Code:** `EMP-` + 6-digit per-organization counter. Issued inside the create transaction by a row-locking `UPDATE … RETURNING` on `document_sequences` — concurrent creators queue, a rolled-back create returns its number (no gaps, no duplicates); `UNIQUE (organization_id, employee_code)` backs it. The code and organization can never change (DB trigger).
- **No credentials** are stored on an employee. A login is a `users` row linked 1:1 by `user_id` (same organization, active, not linked elsewhere). Activation/password setup is **not built** (deferred; reuse the existing auth flow).
- **Statuses** (`text` + CHECK): `ACTIVE, INACTIVE, RESIGNED, TERMINATED`; `is_active` mirrors `status = 'ACTIVE'`; a leaver always has `dateOfExit` + `exitReason` (CHECK).

  | from → to                 | ACTIVE | INACTIVE | RESIGNED |  TERMINATED  |
  | ------------------------- | :----: | :------: | :------: | :----------: |
  | **ACTIVE**                |   –    |    ✔     |    ✔     |      ✔       |
  | **INACTIVE**              |   ✔    |    –     |    ✔     |      ✔       |
  | **RESIGNED / TERMINATED** |   ✘    |    ✘     |    ✘     | ✘ (terminal) |

  **Correction** (own permission, reason mandatory, recorded as `changeType: correction`): RESIGNED ⇄ TERMINATED, and RESIGNED/TERMINATED → ACTIVE (clears the exit fields). Nothing corrects into INACTIVE.

- **Exit disables the login** (⚠ decision): moving to RESIGNED/TERMINATED sets the linked user inactive **in the same transaction** and revokes its refresh tokens/permission cache afterwards; a reinstating correction re-enables it. INACTIVE alone does not.
- Effective date cannot precede the date of joining. A manager must be an **ACTIVE** employee; a reporting-line cycle is refused (service check + DB trigger).
- `.team` scope: an employee changing team leaves the old team lead's scope immediately. Team membership for **access** (`user_team_access`) is _not_ derived from an employee's team (⚠ decision) — a lead's teams are still granted by an administrator.

### Shift assignments (`modules/hr/shift-assignments`)

| Method & path                                       | Permission                    | Notes                                                                                                      |
| --------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET `/hr/shift-assignments`                         | `hr.shift_assignment.read` ▲  | filters `employeeId, teamId, shiftId, activeOn, includeVoided`                                             |
| GET `/hr/shift-assignments/:id`                     | ▲ read                        |                                                                                                            |
| GET `/hr/shift-assignments/resolve?employeeId&date` | ▲ read                        | the shift the employee works that day, or `null`                                                           |
| POST `/hr/shift-assignments`                        | `hr.shift_assignment.write` ▲ | `{shiftId, employeeId \| teamId, effectiveFrom, effectiveTo?, reason?}` — exactly one target; `.own` → 403 |
| POST `/hr/shift-assignments/:id/end`                | ▲ write                       | `{effectiveTo, reason?}` — shorten only, never extend                                                      |
| POST `/hr/shift-assignments/:id/void`               | ▲ write                       | `{reason}` — entered in error; kept, ignored                                                               |

- Ranges are **inclusive**; `effectiveTo` null = open-ended. **No two active assignments of one employee (or one team) may share a day** — PostgreSQL exclusion constraint, safe under concurrency (409 `SHIFT_ASSIGNMENT_OVERLAP`, naming the clash). Adjacent ranges are fine.
- A change of shift = end the old, create the new; both stay visible. The shift must be active; the employee must not have left and the start must not precede joining.
- ⚠ **Resolution precedence** (employee-specific over team default; the team is the employee's _current_ team, so history is not team-accurate) is an **unapproved default** — confirm before Attendance depends on it. Exported as `ShiftQueryService.shiftFor(employeeId, date)` for server-side callers.

### Calendar (`modules/hr/holidays`, `weekly-off-rules`, `calendar`)

| Method & path                                                                | Permission                                                         | Notes                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| GET/POST `/hr/holidays`, GET/PATCH `:id`, POST `:id/deactivate\|activate`    | `hr.holiday.read\|write` ○                                         | list by `year` or `from/to`, `workLocationId`, `organizationWide`, `isActive` |
| GET/POST `/hr/weekly-off-rules`, GET/PATCH `:id`, POST `:id/end`, `:id/void` | `hr.weekly_off.read\|write` ○                                      | filters `scope, workLocationId, teamId, activeOn, includeVoided`              |
| GET `/hr/calendar/day?employeeId&date`                                       | `hr.holiday.read` **AND** any of `hr.employee.read.{own,team,all}` | holidays + weekly-off rules that apply to that employee that day              |

- **Nothing is assumed:** no default weekly off is created and Sunday is not special. `daysOfWeek` are ISO numbers (1 = Monday … 7 = Sunday).
- A holiday's **date and location scope are immutable** (deactivate + re-enter); at most one active holiday per date per scope (organization-wide, or per location).
- A weekly-off rule's scope is the whole organization, **one location, or one team** (never both); rules are not edited in place — end the old, create the new, so past dates stay answerable. No two active rules of the **same scope** may overlap (exclusion constraint); rules of different scopes may coexist.
- `/hr/calendar/day` returns **every** applicable rule with `coversWeekday`, and deliberately **no verdict** (`isWeeklyOff`/`isWorkingDay` do not exist): which scope wins is an open policy decision. Server-side callers: `CalendarQueryService.dayFor(employeeId, date)`.

### Leave (`modules/hr/leave-requests`, `employee-self-service/leave-requests`)

| Method & path                         | Permission                                   | Notes                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/self-service/leave-requests`   | `employee_self_service.leave_request.create` | `{leaveTypeId, startDate, endDate, reason}`; the **employee is the caller's own record** (403 `NOT_AN_EMPLOYEE` if the login is unlinked); starts `PENDING` |
| GET `/self-service/leave-requests`    | `employee_self_service.leave_request.read`   | my requests = my leave history                                                                                                                              |
| GET `/hr/leave-requests`, GET `:id`   | `hr.leave_request.read` ▲                    | filters `employeeId (history), status, leaveTypeId, from, to`, `sortBy`                                                                                     |
| POST `/hr/leave-requests/:id/approve` | `hr.leave.approve` ▲                         | `{note?}`                                                                                                                                                   |
| POST `/hr/leave-requests/:id/reject`  | `hr.leave.approve` ▲                         | `{note}` — **mandatory**                                                                                                                                    |

- Whole days only. `calendarDays` counts both ends and does **not** exclude weekly-offs/holidays (⚠ unapproved policy).
- `PENDING → APPROVED \| REJECTED`, both **final** (DB trigger; no edit, cancel or delete exists). Two approvers racing: one wins, the other gets 422.
- **Maker-checker:** the employee's own login can never decide their request, even holding `hr.leave.approve.all` (403 `SELF_APPROVAL_FORBIDDEN`). `hr.leave.approve.own` is seeded only to keep the permission family complete and grants nothing.
- ⚠ Overlap prevention: two PENDING/APPROVED requests of one employee may not share a day (exclusion constraint); REJECTED ones do not block. Only an **ACTIVE** employee can request; the start cannot precede joining.
- **Not implemented (unapproved):** balances, accrual, carry-forward, half-days, cancellation/withdrawal, HR submitting on someone's behalf, approval chains.

### Recruitment — revision letters (`modules/hr/revision-letters`)

Legacy: Recruitment → Revision Letter (`RevisionLetter.tsx`). Table `hr.revision_letters`. Backend only.

| Method & path                    | Permission                   | Notes                                                                                                                                                                                    |
| -------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/hr/revision-letters`       | `hr.revision_letter.read` ▲  | `?employeeId`, `page`, `limit`, `order` (default newest first); pagination meta                                                                                                          |
| GET `/hr/revision-letters/:id`   | `hr.revision_letter.read` ▲  | 404 outside scope                                                                                                                                                                        |
| POST `/hr/revision-letters`      | `hr.revision_letter.write` ▲ | `{employeeId, designation, location?, letterDate?, effectiveDate?, basic?, da?, hra?, ca?, signatoryName?, signatoryDesignation?}` → **201**; issues `documentNo` and status `GENERATED` |
| PATCH `/hr/revision-letters/:id` | `hr.revision_letter.write` ▲ | any of the fields above except `employeeId` (400); `documentNo` is never changed                                                                                                         |

- **Employee-linked:** `employeeId` is required (legacy is only reachable per employee). The employee must be inside the caller's scope; otherwise **422 `INVALID_EMPLOYEE`**, the same as an unknown id, so ids cannot be probed.
- **Identity from the record:** `employeeName` is copied from the employee's full name and cannot be sent by the client.
- **Defaults (legacy form prefills, applied only when the create request omits them):** `location` = `Chennai`; `letterDate` = today (UTC); `effectiveDate` = 1st of next month; components = `0`; signatory = `Amanullah Khan` / `Co-Founder`.
- **Money:** the four components are the stored truth, each `≥ 0`, at most 2 dp, below 10¹⁰. `grossMonthly = basic + da + hra + ca`; `grossAnnual = grossMonthly × 12`, both derived and exact (`Decimal`). The legacy 35/15/30/20 split is a UI convenience and is **not** enforced here.
- **Document number:** `TW/HR/REV/{FY}/{NNN}` with FY from the issuing date (April–March). Issued from `platform.document_sequences` (doc type `hr_revision_letter_{FY}`) under a row lock in the same transaction, so concurrent issues never share a number and a rolled-back issue gives its number back.
- **Status:** `GENERATED` only (DB CHECK). Legacy never assigns any other value.
- **Issuing a letter does not change the employee's stored salary** (legacy behaviour).
- **Team scope:** `.team`/`.all` readers and writers reach letters through the employee's `team_id`; `.own` **write** is refused (403) — writing is reserved, never granted to self.
- **Not implemented (legacy has no such thing, or it is undecided):** delete (legacy has a delete; the platform rule is "no DELETE route" — decision pending), approval/signing, signature and seal images (no file storage exists yet), document rendering/PDF, an employee salary write-back, share/e-mail/WhatsApp actions, a link to offer letters (legacy has none).

---

## 3. Permission catalogue (73 codes; `packages/database/prisma/permissions/catalog.ts`)

Synced to every environment by `pnpm --filter @texawave-erp/database permissions:sync` (additive; never deletes, never touches role grants, never re-enables a disabled permission).

| Area         | Codes                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Master data  | `master.{designation,employment_type,work_location,shift}.{read,write}`                                        |
| Employees    | `hr.employee.{read,write}.{own,team,all}` · `hr.employee_status.{write,correct}` · `hr.employee_account.write` |
| Shifts       | `hr.shift_assignment.{read,write}.{own,team,all}`                                                              |
| Calendar     | `hr.holiday.{read,write}` · `hr.weekly_off.{read,write}`                                                       |
| Leave        | `hr.leave_type.{read,write}` · `hr.leave_request.read.{own,team,all}` · `hr.leave.approve.{own,team,all}`      |
| Recruitment  | `hr.revision_letter.{read,write}.{own,team,all}`                                                               |
| Self-service | `employee_self_service.{profile.read, leave_request.read, leave_request.create}`                               |
| Audit        | `audit.log.read`                                                                                               |

Reserved-but-inert variants (seeded so the family is complete, granting nothing): `hr.employee.write.own`,
`hr.shift_assignment.write.own`, `hr.leave.approve.own`. Default dev roles (`default-roles.ts`, pinned by a
test): **HR Manager** (everything except status correction), **Team Lead — read-only** (`.team` reads + calendar/leave
types), **Employee** (self-service + calendar). No default role holds any `.team` write/approve permission.

---

## 4. Data model (new tables)

`audit_logs`¹ · `designations` · `employment_types` · `work_locations` · `document_sequences` · `employees` ·
`employee_status_history`¹ · `shifts` · `shift_assignments` · `holidays` · `weekly_off_rules` · `leave_types` ·
`leave_requests` · `revision_letters` (Recruitment). ¹ append-only (triggers). All follow the baseline (`Int` id — `BigInt` for the two logs —
organization scoped, `custom_fields`, `is_active`, audit columns, `timestamptz`, soft-delete column unused because nothing is deleted).
Database-level invariants (CHECKs, partial/expression unique indexes, GiST exclusion constraints, triggers) are in
the migrations as commented raw SQL and are exercised independently of the API in the e2e suites.

## 5. Audit

Every write above records `who` (from the JWT — never a parameter), `when`, `entity`, `action`, allow-listed
`before`/`after`, `reason`, IP and correlation id, **in the same transaction**. Never logged: passwords, tokens,
secrets (a key deny-list applies at any depth), the raw phone number (masked), employee exit reasons, leave
reason text. Browse with `GET /audit/logs` (`audit.log.read`).

## 6. Not built (by decision) — see the completion report for the full list

Employee activation / password setup · employee sensitive-PII table · leave balances/accrual/half-days/cancellation ·
shift break/grace/overtime policy · weekly-off precedence · probation/notice enforcement · old-ERP data import ·
`@nestjs/event-emitter`.

## 7. Verified behaviour worth knowing

- Unknown _query_ parameters are ignored (`@Paginate`); unknown _body_ fields are rejected.
- Prisma reports exclusion/CHECK violations as a debug-formatted string with escaped quotes; `common/database/db-errors.ts` reads that form (an earlier version that assumed plain quotes silently missed every real error until an e2e test caught it).
- An already-issued access token (15 min) is not re-checked against `users.is_active`; exit disables **new** logins and revokes refresh tokens at once, but an outstanding access token lives out its TTL. (Pre-existing platform behaviour.)

## 8. Error codes

| HTTP      | `error`                                                                                                                                                                                              | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 404       | `RESOURCE_NOT_FOUND`                                                                                                                                                                                 | not found **or outside your organization/scope**                             |
| 409       | `RESOURCE_CONFLICT`                                                                                                                                                                                  | duplicate code/name/e-mail/login link, shift still assigned                  |
| 409       | `VERSION_CONFLICT`                                                                                                                                                                                   | stale employee `version`                                                     |
| 409       | `SHIFT_ASSIGNMENT_OVERLAP` · `WEEKLY_OFF_OVERLAP` · `LEAVE_OVERLAP` · `HOLIDAY_DATE_TAKEN`                                                                                                           | overlap/date rules (message names the clash)                                 |
| 422       | `INVALID_STATE_TRANSITION`                                                                                                                                                                           | status/decision not allowed from here (incl. terminal states, decided leave) |
| 422       | `INVALID_TEAM · INVALID_DEPARTMENT · INVALID_DESIGNATION · INVALID_EMPLOYMENT_TYPE · INVALID_WORK_LOCATION · INVALID_MANAGER · INVALID_USER · INVALID_SHIFT · INVALID_EMPLOYEE · INVALID_LEAVE_TYPE` | referenced record missing, inactive, or another organization's               |
| 422       | `REPORTING_LINE_CYCLE · JOINING_AFTER_EXIT · EFFECTIVE_DATE_BEFORE_JOINING · EMPLOYEE_HAS_LEFT · EMPLOYEE_NOT_ACTIVE`                                                                                | employee lifecycle rules                                                     |
| 422       | `SHIFT_TIME_INVALID · SHIFT_WORKING_MINUTES_INVALID · ASSIGNMENT_TARGET_INVALID · ASSIGNMENT_DATES_INVALID · ASSIGNMENT_BEFORE_JOINING · ASSIGNMENT_CANNOT_EXTEND · ASSIGNMENT_VOIDED`               | shifts/assignments                                                           |
| 422       | `WEEKLY_OFF_SCOPE_INVALID · WEEKLY_OFF_DATES_INVALID · WEEKLY_OFF_CANNOT_EXTEND · WEEKLY_OFF_VOIDED`                                                                                                 | weekly-off rules                                                             |
| 422       | `LEAVE_DATES_INVALID · LEAVE_BEFORE_JOINING`                                                                                                                                                         | leave                                                                        |
| 403       | `NOT_AN_EMPLOYEE` · `SELF_APPROVAL_FORBIDDEN`                                                                                                                                                        | self-service without a linked employee / deciding your own leave             |
| 400       | (validation)                                                                                                                                                                                         | malformed body/query, unknown body field                                     |
| 401 / 403 |                                                                                                                                                                                                      | no token / missing permission                                                |
