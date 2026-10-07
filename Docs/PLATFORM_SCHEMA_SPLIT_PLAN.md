# Platform-Wide PostgreSQL Schema Split — Migration Plan (Proposal Only, Pending Sign-Off)

**Status: NOT IMPLEMENTED. No `schema.prisma` edit, no migration file, no code change has been
made.** This is a standalone plan, reviewed and approved independently of the Attendance work.
Attendance implementation does not start until (a) this plan is approved and the resulting
migration lands, or (b) you explicitly choose to defer the split (Option B in
`Docs/ATTENDANCE_DATABASE_DESIGN.md` §1.3) and accept Attendance landing in `public` for now.

This plan covers **only** the schema-ownership restructuring. It creates zero new business tables.
Attendance's own tables remain proposed-only in `Docs/ATTENDANCE_DATABASE_DESIGN.md` §2 and are not
part of this migration.

---

## 1. Ownership map — every existing model, assigned

All 23 current models, `packages/database/prisma/schema.prisma`. Two are flagged for your decision
rather than assigned unilaterally (§1.2).

### 1.1 Platform schema (12 models) — shared auth/tenancy/RBAC/org infrastructure

| Model            | Table              | Why platform, not hr                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Organization`   | `organizations`    | tenant root, consumed by every module                                                                                                                                                                                                                                                                                                                                                      |
| `User`           | `users`            | login identity, not HR-specific (an `Employee` may have no `User`, and not every `User` is an employee)                                                                                                                                                                                                                                                                                    |
| `Permission`     | `permissions`      | global RBAC catalog across all modules                                                                                                                                                                                                                                                                                                                                                     |
| `Role`           | `roles`            | per-org RBAC                                                                                                                                                                                                                                                                                                                                                                               |
| `RolePermission` | `role_permissions` | RBAC join/grant record                                                                                                                                                                                                                                                                                                                                                                     |
| `UserRole`       | `user_roles`       | RBAC join/assignment record                                                                                                                                                                                                                                                                                                                                                                |
| `Department`     | `departments`      | landed "ahead of the RBAC module" per `Docs/ARCHITECTURE.md` changelog (2026-09-22) — an org-structure concept the whole platform's tenancy layer sits on, not an HR business record                                                                                                                                                                                                       |
| `Team`           | `teams`            | "the real access boundary for HR/team-scoped data" per its own doc comment — but the boundary mechanism itself is platform tenancy infrastructure (`TeamContextService`, `TeamScopeGuard` live in `apps/api/src/platform/tenancy`), reused by every future team-scoped module (SCM/CRM/Finance will scope their own data through the same `Team`/`user_team_access`, not an HR-owned copy) |
| `UserTeamAccess` | `user_team_access` | the team-membership/scope-resolution table backing `TeamContextService` — platform tenancy, not HR data                                                                                                                                                                                                                                                                                    |
| `Tag`            | `tags`             | the generic `_reference` fixture module (`apps/api/src/modules/_reference/tags/`), demonstrates the baseline pattern — not a business concept of any module                                                                                                                                                                                                                                |
| `AuditLog`       | `audit_logs`       | explicitly "the platform audit trail" (`apps/api/src/platform/audit`), written to by every module alike                                                                                                                                                                                                                                                                                    |

### 1.2 Decisions needed (not assigned unilaterally)

| Model              | Table                | The question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentSequence` | `document_sequences` | Its own doc comment frames it as a **generic** per-org document-numbering utility ("Employee codes use doc_type = 'employee'... HR may add more" implies other `doc_type`s from other modules are the intended future shape), but its only consumer today is HR's employee-code generator. **Recommendation: platform** (it's infrastructure any future module's "human-readable code" needs will reuse, same reasoning as `AuditLog`) — but flagging rather than assuming, since today 100% of its usage is HR. |
| `WorkLocation`     | `work_locations`     | Only ever referenced by HR tables today (`Employee`, `Holiday`, `WeeklyOffRule`). Could plausibly become a shared concept (SCM warehouses, CRM site visits) later. **Recommendation: hr for now** — promote to platform only when a second module actually needs it; speculative promotion today would be guessing a requirement that doesn't exist yet, which the task's own instructions say not to do.                                                                                                        |

### 1.3 HR schema (11 models) — business data owned by the HR module

| Model                   | Table                     |
| ----------------------- | ------------------------- |
| `Designation`           | `designations`            |
| `EmploymentType`        | `employment_types`        |
| `Employee`              | `employees`               |
| `EmployeeStatusHistory` | `employee_status_history` |
| `Shift`                 | `shifts`                  |
| `ShiftAssignment`       | `shift_assignments`       |
| `Holiday`               | `holidays`                |
| `WeeklyOffRule`         | `weekly_off_rules`        |
| `LeaveType`             | `leave_types`             |
| `LeaveRequest`          | `leave_requests`          |
| `WorkLocation`*         | `work_locations`          | *pending §1.2 |

No model is assigned to `scm`, `crm`, or `finance` — those modules have no tables yet (§2).

---

## 2. Provisioning future `scm` / `crm` / `finance` schemas

**Correction to the brief's framing**: these schemas should **not** be pre-created empty today.
Prisma's multi-schema feature requires every schema named in the datasource's `schemas = [...]`
list to be used by at least one model/enum/view — an unused schema name in that list is a
validation error, not a harmless placeholder. (This repo's disposable-DB validation, §6 below,
will confirm this against the installed Prisma 6.19 before the real migration is written, but it's
documented, longstanding Prisma behavior.)

**The actual provisioning procedure, to apply identically for SCM, CRM, Finance, and any later
module:**

1. When that module's first real table is designed, add its schema name to
   `datasource.schemas` in `schema.prisma` (e.g. `schemas = ["platform", "hr", "scm"]`).
2. Give its first model(s) `@@schema("scm")`.
3. Run `prisma migrate dev` as normal — Prisma generates the `CREATE SCHEMA IF NOT EXISTS scm;`
   statement as part of that module's own first migration automatically. No manual
   `CREATE SCHEMA` step, no separate "provisioning" migration ever needed.
4. That module's own tables only ever land in its own schema — the same rule this plan applies to
   HR applies symmetrically to SCM/CRM/Finance when their time comes.

This means: no action is needed now for SCM/CRM/Finance beyond this plan existing as precedent.
The one platform-wide thing this migration DOES set up once, for every future module to rely on:
confirming that multi-schema works correctly end-to-end in this repo's tooling (CI, permissions
sync, raw SQL, shadow-DB drift check — §4) with two schemas, so adding a third/fourth/fifth later
is a known-good, low-risk, repeatable pattern rather than a first-of-its-kind risk each time.

---

## 3. What does NOT change

- No table is renamed, no column changes, no model's fields change.
- No FK relationship changes shape — `ALTER TABLE ... SET SCHEMA` does not touch constraints;
  Postgres keeps FKs, indexes, triggers, and the exclusion constraints
  (`shift_assignments`/`holidays`/`weekly_off_rules`/`leave_requests`'s `EXCLUDE USING gist`,
  backed by the `btree_gist` extension, `packages/database/prisma/migrations/20260930102756_add_hr_shifts/migration.sql:82`)
  intact and enforcing — these bindings are by internal object id, not by schema-qualified name,
  so moving a table's schema does not require recreating any constraint, trigger, or index.
- No existing migration file is edited, reordered, or rewritten. This is one new, append-only
  migration at the end of the existing history (currently 11 migrations,
  `20260918070103_init` → `20260930105114_add_hr_leave`).
- `prisma db push` is not used anywhere in this plan — every change goes through
  `prisma migrate dev` (local) / `prisma migrate deploy` (CI/prod), per
  `Docs/ARCHITECTURE.md` §9's "one migration tool, one direction" rule.

---

## 4. Code sites that must be reviewed/updated alongside the migration

Exhaustive list from a full-repo inspection (`$queryRaw`/`$executeRaw`, `search_path`,
`DATABASE_URL`, permissions sync, seed script):

### 4.1 Raw SQL using unqualified table names — MUST be schema-qualified

Prisma-generated queries always schema-qualify the tables it manages once `@@schema(...)` is set;
**hand-written raw SQL does not get this for free** — it resolves unqualified names via the
connection's `search_path`, which should not be relied on for correctness here. Six call sites, all
against tables moving to `hr`:

| File                                                                                | Table referenced            | Fix                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/api/src/modules/hr/employees/employee-code.ts:36-52`                          | `document_sequences`        | qualify as `hr.document_sequences` or `platform.document_sequences`, per §1.2's decision |
| `apps/api/src/modules/hr/employees/employee-lock.ts:18-23`                          | `employees`                 | `hr.employees`                                                                           |
| `apps/api/src/modules/hr/employees/employee-references.ts:152-159`                  | `employees` (recursive CTE) | `hr.employees`                                                                           |
| `apps/api/src/modules/hr/leave-requests/leave-requests.repository.ts:319-321`       | `leave_requests`            | `hr.leave_requests`                                                                      |
| `apps/api/src/modules/hr/shift-assignments/shift-assignments.repository.ts:459-461` | `shift_assignments`         | `hr.shift_assignments`                                                                   |
| `apps/api/src/modules/hr/weekly-off-rules/weekly-off-rules.repository.ts:366-368`   | `weekly_off_rules`          | `hr.weekly_off_rules`                                                                    |

This is a small, mechanical, reviewable diff (six `FROM`/`UPDATE`/`INSERT INTO` clauses gain a
schema prefix) bundled into the same PR as the migration — it is not "Attendance application
code," it's the minimum change required for the schema-split migration to not silently break
these six existing, tested code paths. Each one has an existing `*.repository.spec.ts` or e2e
coverage that will catch a missed qualification immediately (§6).

### 4.2 Connection string `?schema=` parameter

`DATABASE_URL`/`SHADOW_DATABASE_URL` across `.env.example`, `apps/api/.env.example`, and
`.github/workflows/ci.yml` all currently pin `?schema=public`. With `multiSchema` + `schemas =
[...]` configured, Prisma Client qualifies its own generated queries by each model's `@@schema`
regardless of this parameter — but it still sets the connection's default search_path, which
matters for the six raw-SQL sites above if any are left unqualified by mistake, and for anyone
running `psql` by hand against the dev/CI database. **Decision needed as part of this plan's
review, confirmed empirically in §6**: either (a) leave `?schema=public` as-is now that all raw SQL
is explicitly qualified (§4.1), or (b) drop the `?schema=` parameter entirely once it's provably
unnecessary. Recommendation: (a) — explicit qualification in code is the real fix; the connection
parameter is a secondary concern and changing it is not required for correctness.

### 4.3 Permissions sync (`packages/database/prisma/permissions/sync.ts`, `sync-cli.ts`)

No unqualified raw table SQL — only `prisma.permission.*`/`prisma.rolePermission.*` Prisma Client
calls and one advisory lock (`pg_advisory_xact_lock`, not table-scoped). **No code change
required**; still listed in §6's verification checklist (`permissions:sync --check` must pass
post-migration) because it's the kind of thing that's cheap to verify and expensive to discover
broken later.

### 4.4 Seed script (`packages/database/prisma/seed.ts`)

Uses only Prisma Client model calls, no raw SQL. **No code change required**, re-run and verified
in §6.

### 4.5 `audit_logs`' and `employee_status_history`'s shared trigger function

`CREATE FUNCTION "prevent_row_mutation"()` (defined once, in the `20260930095406_add_audit_logs`
migration, unqualified — so it lands wherever the connection's default schema was at apply time,
i.e. `public`) is attached via trigger to both `audit_logs` (→ `platform`) and
`employee_status_history` (→ `hr`). Postgres trigger-to-function binding is by internal object id,
not by schema-qualified name re-lookup, so **this continues to work correctly across both tables
after their schemas change** without modification — but it is explicitly called out here because
it's exactly the kind of cross-schema dependency that's easy to miss and must be in the
verification checklist (§6: attempt an `UPDATE`/`DELETE` against both tables post-migration,
confirm both still reject it).

### 4.6 CI workflow (`.github/workflows/ci.yml`)

The migration-drift check (`prisma migrate diff --from-migrations ... --to-schema-datamodel ...
--shadow-database-url ...`) and `prisma migrate deploy` steps require no change — they operate on
whatever `schema.prisma` + `prisma/migrations` say, multi-schema included. The shadow database
creation step (`CREATE DATABASE texawave_erp_shadow;`) also requires no change — Prisma creates
the needed schemas inside it via the migration's own `CREATE SCHEMA` statements when migrations are
replayed into it.

### 4.7 Scaffold script (`scripts/scaffold-module.mjs`) and `Docs/HOW_TO_ADD_A_MODULE.md`

No functional change needed for this migration, but once this plan lands,
`HOW_TO_ADD_A_MODULE.md` should gain a line reminding future module authors to add
`@@schema("<module>")` to any new model and, if it's that module's first, add the schema name to
`datasource.schemas` (§2). Tracked as a documentation follow-up, not a blocker to this plan.

---

## 5. Migration content (to be generated only after sign-off)

One migration, appended after `20260930105114_add_hr_leave`, generated by
`pnpm --filter database exec prisma migrate dev` (never hand-written, never `db push`), containing
exactly:

1. `CREATE SCHEMA IF NOT EXISTS "platform";` / `CREATE SCHEMA IF NOT EXISTS "hr";` (Prisma-generated
   from the `datasource.schemas` change).
2. `ALTER TABLE "public"."<table>" SET SCHEMA "platform";` for each of the 12 (or 13/14, pending
   §1.2) platform tables.
3. `ALTER TABLE "public"."<table>" SET SCHEMA "hr";` for each of the 11 (or 12/13) HR tables.
4. The corresponding `@@schema("platform")` / `@@schema("hr")` attribute added to all 23 models in
   `schema.prisma` (this is a schema-file change, not a separate migration — it's what step 1-3's
   migration SQL is generated _from_).

No `CREATE TABLE`, `DROP TABLE`, `ALTER COLUMN`, or data-touching statement appears anywhere in
this migration. `ALTER TABLE ... SET SCHEMA` is a metadata-only, near-instant operation in
Postgres — it does not rewrite table data or lock for longer than a brief catalog update, and the
whole migration file runs inside Prisma's standard per-migration transaction, so a failure
partway through rolls back cleanly and automatically (the six raw-SQL updates in §4.1 are a
separate application-code commit in the same PR, not part of the SQL migration itself).

---

## 6. Validation plan — on a disposable database only, never the development database

Following this repo's own existing discipline (`apps/api/test/support/e2e-guard.ts`: refuses to
run against a database whose name doesn't contain `test`/`e2e`, unless `CI=true`):

1. **Create** `texawave_erp_schema_split_test` (name satisfies the existing disposable-db guard
   pattern) on a local/throwaway Postgres instance — never the shared dev database.
2. **Seed it from the current migration history** (`DATABASE_URL=...schema_split_test
pnpm --filter database exec prisma migrate deploy`) so it reflects today's real pre-split state,
   then run `pnpm --filter database seed` to populate representative data (organizations, teams,
   employees, shifts, leave requests, audit rows) — not empty tables, so row-count and
   constraint checks in step 5 are meaningful.
3. **Record a baseline**: row counts per table, list of constraints/indexes/triggers
   (`information_schema.table_constraints`, `pg_indexes`, `pg_trigger`), and a confirmation that
   `UPDATE`/`DELETE` against `audit_logs` and `employee_status_history` are currently rejected
   (proves the append-only trigger works pre-migration, for comparison after).
4. **Apply the proposed migration** (once written, post-sign-off) via
   `prisma migrate dev` against this disposable database only.
5. **Verify, point by point**:
   - Row counts per table unchanged (every row survived the schema move).
   - Every constraint/index/trigger from step 3's baseline still exists and is attached to the
     same table, now under its new schema (`information_schema.tables.table_schema`).
   - `UPDATE`/`DELETE` against `audit_logs` and `employee_status_history` are still rejected
     (§4.5's cross-schema trigger-function concern, empirically confirmed).
   - The six raw-SQL call sites (§4.1), once qualified, still execute correctly — covered by
     existing unit/spec tests for `employee-code.ts`, `employee-lock.ts`, `employee-references.ts`,
     and existing e2e coverage for leave-requests/shift-assignments/weekly-off-rules concurrency
     paths (the `FOR UPDATE` lock queries and the exclusion-constraint-conflict paths).
   - `pnpm --filter @texawave-erp/database permissions:sync --check` and a real
     `permissions:sync` run against this database succeed with no unexpected diff.
   - `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel
./prisma/schema.prisma --shadow-database-url <disposable-shadow> --exit-code` reports no
     drift — i.e., the new migration file and `schema.prisma` agree, exactly as CI's existing
     drift check (`.github/workflows/ci.yml`) requires for every PR.
   - Full existing suite green against this database: `pnpm exec turbo run lint typecheck test
build`, plus the backend e2e suite (`apps/api/test/*.e2e-spec.ts` — `hr-employees`,
     `hr-shifts`, `hr-leave`, `hr-calendar`, `audit`, `team-scope`, `master-data`) pointed at
     `texawave_erp_schema_split_test` per `apps/api/test/README.md`'s existing disposable-DB
     instructions.
   - Confirm, empirically, the Prisma "every listed schema needs a model" validation behavior
     assumed in §2, by attempting (in this disposable sandbox only) to add an unused schema name
     and observing the validation error — then removing it, since §2 concludes none should be
     pre-created.
6. **Tear down** the disposable database after validation. Nothing from this step touches the real
   development database at any point.

**Recovery procedure if validation fails at any point**: the disposable database is simply
dropped and recreated from migration history — there is no "real" data to recover in this sandbox.
For the eventual real deploy (after this plan and the migration are both approved, which is a
separate future approval step from this document), the standard recovery procedure is a
`pg_dump` taken immediately before applying the migration; since every statement in the migration
is transactional DDL, a mid-migration failure already rolls back automatically without needing the
dump, and the dump exists only as defense-in-depth for an operational mistake outside the
migration itself (e.g., applying it against the wrong database).

---

## 7. Attendance-status historical snapshot/recalculation — resolved

This was listed as unresolved in `Docs/ATTENDANCE_DATABASE_DESIGN.md` §2.1 ("derived and stored...
so historical reports don't silently change"). Resolving it concretely here, since it's a
prerequisite decision for that table's design, not a schema-split question:

**Policy: `attendance_records.status` is a point-in-time snapshot, computed once by
`attendance-calculation.service.ts` at a specific, auditable moment, and never silently
recalculated in the background.**

The moments a (re)computation is allowed to happen:

1. On check-in/check-out, for that day's record, using Holiday/WeeklyOffRule/LeaveRequest data as
   it exists at that instant.
2. On an approved attendance correction (`ATTENDANCE_DATABASE_DESIGN.md` §2.3), which explicitly
   recomputes the affected record — this is the one case an already-finalized day's status can
   change, and it is always an audited, human-decided action, never automatic.
3. On an HR manual edit of the record (same audit trail as §5.1 of the legacy parity doc's
   `adminEdited` concept).

**Explicitly NOT a trigger for recalculation**: adding/editing a `Holiday`, `WeeklyOffRule`, or
`LeaveRequest` for a date that already has a finalized `attendance_record` does **not** reach back
and rewrite that record. Rationale: this matches the task's own instruction to "preserve existing
historical records and audit history," avoids a class of silent mass-recompute bugs entirely (no
background job ever rewrites attendance history as a side effect of unrelated master-data edits),
and matches how the legacy system actually behaved in every path the audit traced (§3 of the parity
doc — no code path there recalculates a past day's stored status from current master data either;
drift between master data and historical attendance was, at most, surfaced in read-time display
logic, never written back).

If a holiday is added retroactively and a past day's attendance needs to reflect it, that is a
correction request (§2.3), going through the same audited approve/reject workflow as any other
fix — not an automatic recompute. This is presented as the resolved design, not an open question,
but is included in this sign-off request since it's a real policy choice with real consequences
(§6 of `ATTENDANCE_ARCHITECTURE.md`'s existing "no invented precedence rule" caution applies here
too).

---

## 8. Consolidated list of unresolved legacy decisions (carried over, not re-litigated here)

These remain open from `Docs/ATTENDANCE_ARCHITECTURE.md` §6 and are restated here only for a single
consolidated sign-off list — their analysis lives in that document and
`Docs/ATTENDANCE_LEGACY_PARITY.md`, not duplicated in full here:

1. **Face verification** — drop from backend scope, or accept-and-store-only (no server-side
   verification claim)? (`ATTENDANCE_ARCHITECTURE.md` §5, §6.2)
2. **Location gating** — configurable IP allowlist, a different strategy, or out of backend scope
   this phase? (§5, §6.3)
3. **Scheduled jobs** (auto-checkout, missing-punch alerts) — in scope at all, and on what
   scheduling infrastructure? No existing scheduler was found in this repo to reuse. (§6.4)
4. **Three-way weekly-off/holiday/leave precedence** under the new, richer `WeeklyOffRule` model —
   legacy only confirms Holiday-beats-Leave for its hardcoded-Sunday case; this is new design.
   (§6.5)
5. **Monthly sign-off/lock** (`Approved.tsx`) — in scope pending a fuller legacy re-audit, or
   deferred entirely? (§6.6)
6. **Reports scope** — confirm the derived list (daily/monthly summary, missing-punch, overtime)
   is complete and nothing else is expected. (§6.7)

Resolved in this document: item 7 from that list, attendance-status recalculation policy (§7
above).

---

## 9. What this plan needs from you before anything is generated

1. **Sign off on the ownership map** (§1), including the two flagged decisions
   (`DocumentSequence`, `WorkLocation`).
2. **Confirm the provisioning approach for future modules** (§2) — on-demand at each module's
   first migration, nothing pre-created.
3. **Confirm the six raw-SQL qualification edits** (§4.1) are acceptable as part of this migration
   PR (they are the minimum required for correctness, not optional polish).
4. **Approve running the disposable-database validation** (§6) — this requires a throwaway local
   Postgres instance; confirm you have one available or want guidance provisioning one.
5. **Confirm the attendance-status recalculation policy** (§7) as the resolved design.
6. Separately, in your own time: the six unresolved product/legacy decisions (§8) — these don't
   block the schema-split migration itself, only the Attendance implementation that follows it.

Nothing in `schema.prisma`, `prisma/migrations/`, or application code changes until items 1-4 are
confirmed.
