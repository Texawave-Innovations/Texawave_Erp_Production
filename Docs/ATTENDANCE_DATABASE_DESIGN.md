# Attendance — Database Design

**Status: IMPLEMENTED** as migration `20261005065109_add_hr_attendance` (tables in the `hr` schema,
no `attendance` schema). §2 is the original proposal. **§7 is the as-built schema and lists every
deviation from §2.** Where they disagree, §7 is correct.

**§1 has since been superseded by a full, dedicated plan**: `Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md`.
That document is the authoritative ownership map, migration plan, code-impact survey, and
validation procedure for the platform-wide schema split, reviewed and approved as its own change
before Attendance's own tables (§2 below) are created. §1 is left below for context on why the
split is needed, but defer to `PLATFORM_SCHEMA_SPLIT_PLAN.md` for the actual plan and ownership
decisions.

---

## 1. The blocking question: PostgreSQL schema-per-module

### 1.1 Current state (verified)

`packages/database/prisma/schema.prisma` has no `multiSchema` preview feature, no `schemas = [...]`
on the `datasource` block, and none of the 23 existing models (`Organization`, `User`, `Employee`,
`Shift`, `LeaveRequest`, etc.) carry an `@@schema(...)` attribute. Every table today lives in
Postgres's default `public` schema. `Docs/ARCHITECTURE.md` does not mention per-module Postgres
schemas as a design goal anywhere.

### 1.2 Why this isn't additive

Prisma's multi-schema support (`multiSchema` in the generator's `previewFeatures`, plus
`schemas = [...]` on the datasource) is all-or-nothing at the file level: once declared, **every**
model in `schema.prisma` must carry an `@@schema(...)` attribute, including ones Attendance never
touches. Enabling it to put Attendance tables in an `hr` schema therefore requires, in the same
change:

- Retagging all 23 existing models into `platform` or `hr`.
- A migration that runs `CREATE SCHEMA IF NOT EXISTS platform, hr;` followed by
  `ALTER TABLE public.<table> SET SCHEMA <platform|hr>;` for every existing table — additive at
  the SQL level (no data loss, no table recreation), but touching every table in the database in
  one migration, not something scoped to "add Attendance."
- Verifying every existing cross-model Prisma relation, every raw SQL (if any), every
  search_path assumption in connection config, and the permissions-sync tooling
  (`packages/database/prisma/permissions/sync.ts`) still resolve correctly once tables move out of
  `public`.

This is a real, bounded, one-time piece of work — not inherently dangerous — but it is a
**platform-wide** change under an **Attendance task's** scope, and it directly intersects the
task's own Phase 0/7 instructions to preserve existing tables/migrations and not relocate anything
without a reviewed compatibility plan.

### 1.3 Options (recommendation marked)

**Option A — Full retroactive multi-schema split now (`platform` + `hr`).** Satisfies the literal
requirement. Correct long-term foundation ERP architecture, and genuinely the easiest time to do
it (fewer tables than it will ever have again). Risk is procedural, not data-loss: every model
needs the annotation, one migration needs careful review, and the permissions/sync tooling and any
raw-SQL query that assumes `public` needs a check pass (full list in
`PLATFORM_SCHEMA_SPLIT_PLAN.md` §4). Note: `scm`/`crm`/`finance` are **not** pre-created empty —
Prisma requires every schema named in the datasource to have at least one model using it, so those
are provisioned on demand when each module's first table is actually designed
(`PLATFORM_SCHEMA_SPLIT_PLAN.md` §2). **Recommended**, but only as its own reviewed change,
separate from and prior to Attendance table creation — not bundled into the same migration/PR as
Attendance.

**Option B — Build Attendance in `public` now, split schemas later.** Lowest short-term risk,
fully reversible, keeps this task scoped. Downside: Attendance tables would need a second,
disruptive migration later (`ALTER TABLE ... SET SCHEMA hr`) once the platform-wide split happens
anyway — so it doesn't avoid the work, it just defers and duplicates it.

**Option C — Attendance-only split (new `hr` schema, only Attendance's own new tables moved into
it, all 22 pre-existing models stay in `public`).** Not actually possible as stated: Prisma's
all-or-model rule means declaring `schemas = [...]` at all forces annotating every model, so "only
the new tables" cannot be done without also touching the 22 existing ones. Listed here only to
rule it out explicitly, since it looks appealing but isn't achievable with the current Prisma
version's multi-schema feature.

### 1.4 Recommendation

Do Option A, but as a **separate, dedicated PR/migration** reviewed and merged before Attendance
implementation starts — not as part of the Attendance task itself. Rationale: it's the only option
that satisfies the explicit requirement without creating deferred, duplicated migration work, and
isolating it from Attendance means a problem in the schema-split migration doesn't block or get
confused with Attendance's own (much smaller, genuinely additive) migrations. Once that lands,
Attendance's own models are written directly with `@@schema("hr")` from the start — no second move
needed for them.

**This requires your sign-off before either the schema-split PR or the Attendance migrations are
written.** No migration has been generated pending that decision.

---

## 2. Proposed Attendance tables (assuming `hr` schema, per §1.4)

All tables below are additive, new, HR-owned. None modify, rename, or relocate `Employee`,
`Shift`, `ShiftAssignment`, `Holiday`, `WeeklyOffRule`, `LeaveRequest`, or any platform table.

### 2.1 `attendance_records` — one row per employee per calendar day

| Column                                                                            | Type                            | Notes                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                              | `Int` PK, autoincrement         | matches existing PK convention (§5.1 of `ARCHITECTURE.md`)                                                                                                                                                                                                                                                          |
| `organization_id`                                                                 | `Int` FK → `organizations`      |                                                                                                                                                                                                                                                                                                                     |
| `employee_id`                                                                     | `Int` FK → `employees`          |                                                                                                                                                                                                                                                                                                                     |
| `attendance_date`                                                                 | `Date`                          | calendar date, `date-only.ts` convention (UTC-midnight `Date`, `YYYY-MM-DD` on the wire) — not a timestamp                                                                                                                                                                                                          |
| `shift_assignment_id`                                                             | `Int?` FK → `shift_assignments` | the resolved shift for that employee/day, nullable for a day with no assignment on record                                                                                                                                                                                                                           |
| `status`                                                                          | `String`                        | `PRESENT \| ABSENT \| HALF_DAY \| ON_LEAVE \| HOLIDAY \| WEEKLY_OFF \| NOT_MARKED` — derived and stored (not purely computed on read), so historical reports don't silently change if shift/holiday/leave data is edited later; written only by `attendance-calculation.service.ts`, never hand-set by a controller |
| `first_check_in_at`                                                               | `DateTime?` (`Timestamptz`)     | earliest session check-in, denormalized for fast listing/sort, derived from `attendance_sessions`                                                                                                                                                                                                                   |
| `last_check_out_at`                                                               | `DateTime?` (`Timestamptz`)     | latest session check-out, same rationale                                                                                                                                                                                                                                                                            |
| `worked_minutes`                                                                  | `Int`                           | sum across sessions, legacy §4.1 equivalent of `workHrs*60`                                                                                                                                                                                                                                                         |
| `overtime_minutes`                                                                | `Int`                           | legacy §4.1 `otHrs*60`                                                                                                                                                                                                                                                                                              |
| `shortfall_minutes`                                                               | `Int`                           | legacy §4.1 `pendingHrs*60`                                                                                                                                                                                                                                                                                         |
| `is_regularized`                                                                  | `Boolean` default false         | set true only by an approved correction, legacy §5.2's `regularized`                                                                                                                                                                                                                                                |
| `custom_fields`                                                                   | `Json` default `{}`             | matches every other HR table's convention                                                                                                                                                                                                                                                                           |
| `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` | standard                        | matches every other HR table's audit-column convention exactly                                                                                                                                                                                                                                                      |

`@@unique([organizationId, employeeId, attendanceDate])` — the business key preventing duplicate
day records, replacing legacy's dual-key problem (§1.1 of the parity doc) outright: one real
foreign key, one row, no key-merge logic needed anywhere downstream.
`@@index([organizationId, attendanceDate])` for daily-grid queries;
`@@index([organizationId, employeeId])` for per-employee history.

### 2.2 `attendance_sessions` — one row per punch pair (replaces legacy's `sessions[]` array)

| Column                                                 | Type                                                        | Notes                                                                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                   | `Int` PK                                                    |                                                                                                                                           |
| `attendance_record_id`                                 | `Int` FK → `attendance_records`, cascade delete with parent |                                                                                                                                           |
| `check_in_at`                                          | `DateTime` (`Timestamptz`)                                  | server time only — never a client-submitted instant, legacy §2.4 lesson                                                                   |
| `check_out_at`                                         | `DateTime?`                                                 | null while session is open                                                                                                                |
| `check_in_source`                                      | `String`                                                    | `WEB \| MOBILE \| MANUAL \| CORRECTION`                                                                                                   |
| `check_out_source`                                     | `String?`                                                   | same enum, nullable                                                                                                                       |
| `created_by`, `updated_by`, `created_at`, `updated_at` | standard                                                    | no soft delete — a wrong session is corrected via the Corrections workflow (§2.3), not deleted, so the audit trail is never silently lost |

At most one row per `attendance_record_id` with `check_out_at IS NULL` is a business rule enforced
in the service layer (re-read-before-write, legacy §2.3's `enforceCheckGuards` lesson), not a DB
constraint — Postgres partial unique indexes can express "at most one NULL per group"
(`CREATE UNIQUE INDEX ... WHERE check_out_at IS NULL`) and this should be the actual DB-level
guard, not service-layer-only, to survive concurrent requests (legacy §2.3's race-condition
lesson, now enforced by the database instead of a re-read).

### 2.3 `attendance_corrections` — regularization/correction requests

| Column                                      | Type                             | Notes                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                        | `Int` PK                         |                                                                                                                                                                                 |
| `organization_id`                           | `Int` FK                         |                                                                                                                                                                                 |
| `attendance_record_id`                      | `Int?` FK → `attendance_records` | nullable — legacy §5.2 allows a correction for a date with no existing record at all                                                                                            |
| `employee_id`                               | `Int` FK                         | denormalized alongside the nullable record FK so the employee is always resolvable even when no record exists yet                                                               |
| `attendance_date`                           | `Date`                           |                                                                                                                                                                                 |
| `correction_type`                           | `String`                         | `MISSED_CHECK_IN \| MISSED_CHECK_OUT \| INCORRECT_TIME \| LATE_ARRIVAL \| EARLY_DEPARTURE` — legacy §5.2's exact type set                                                       |
| `requested_check_in_at`                     | `DateTime?`                      |                                                                                                                                                                                 |
| `requested_check_out_at`                    | `DateTime?`                      |                                                                                                                                                                                 |
| `reason`                                    | `String`                         |                                                                                                                                                                                 |
| `status`                                    | `String` default `PENDING`       | `PENDING \| APPROVED \| REJECTED`                                                                                                                                               |
| `requested_by`                              | `Int` FK → `users`               |                                                                                                                                                                                 |
| `decided_by`                                | `Int?` FK → `users`              |                                                                                                                                                                                 |
| `decided_at`                                | `DateTime?`                      |                                                                                                                                                                                 |
| `decision_note`                             | `String?`                        |                                                                                                                                                                                 |
| `custom_fields`, `is_active`, audit columns | standard                         | identical shape to `LeaveRequest` (§2's model above), which is the closest existing analog and already implements the self-approval-blocked decision pattern this module reuses |

Mirrors `LeaveRequest` field-for-field where the shape matches, specifically so
`attendance-corrections.service.ts` can follow `leave-requests.service.ts`'s `decide()` pattern
almost line-for-line (scope resolution, `.own` approval explicitly denied, 404-not-403 outside
scope).

### 2.4 No separate "attendance exceptions/processing" table in this proposal

The task's Phase 3 lists "attendance processing exceptions" as a candidate table, contingent on a
real automatic-processing job existing. Per `ATTENDANCE_ARCHITECTURE.md` §6 item 4, whether any
scheduled job (auto-checkout, missing-punch alerts) is in scope at all is still an open decision.
No exceptions table is proposed until that's resolved — adding one speculatively would violate the
task's own "create only what is required" instruction.

---

## 3. Relationships to existing HR entities (read-only references, no duplication)

- `attendance_records.employee_id` → existing `Employee` — no denormalized employee name/code
  stored (legacy's `employeeName`/`employeeId`-as-code fields were a Firebase-era denormalization
  need; a relational FK join replaces that outright).
- `attendance_records.shift_assignment_id` → existing `ShiftAssignment`, which itself resolves to
  `Shift` (start/end/working-minutes/overnight flag) — Attendance never stores its own copy of
  shift timing, unlike legacy's hardcoded `SHIFT_CONFIGS`.
- Holiday/weekly-off/leave are **not** foreign-keyed from `attendance_records` at all — they are
  read at status-computation time from the existing `Holiday`, `WeeklyOffRule`, and `LeaveRequest`
  tables (via their existing repositories/services) by `attendance-calculation.service.ts`, then
  the _result_ (`status`) is persisted. This avoids a historical attendance row's meaning silently
  changing if someone edits a holiday calendar after the fact, while still deriving from a single
  source of truth at calculation time — matching the task's instruction to reuse rather than
  duplicate these entities.

## 4. Duplicate prevention & transaction safety

- `@@unique([organizationId, employeeId, attendanceDate])` on `attendance_records` is the single
  business key — directly solves legacy's dual-key duplication problem (parity doc §1.1, §10.1).
- The partial unique index on `attendance_sessions` (at most one open session per record, §2.2)
  replaces legacy's re-read-then-write race mitigation with an actual database constraint.
- Check-in/check-out writes happen inside a single transaction: read-or-create the day's
  `attendance_record`, assert no conflicting open session (constraint above backs this up),
  insert/close the `attendance_session`, recompute and persist `worked_minutes`/
  `overtime_minutes`/`shortfall_minutes`/`status` via `attendance-calculation.service.ts`, write
  the audit row — all or nothing.
- Correction approval is a single transaction: update `attendance_corrections` row, upsert the
  target `attendance_record` + append the correcting `attendance_session`, recompute via the same
  calculation service, write audit — matching `leave-requests.repository.ts`'s `decide()` shape.

## 5. Migration strategy

All migrations are additive (`CREATE TABLE`, `CREATE INDEX`) — no existing table, column, or
migration is touched, renamed, or reordered. Sequence, once §1.4's sign-off is given:

1. (Separate PR, not this task) Platform-wide multi-schema split migration —
   `CREATE SCHEMA platform, hr, scm, crm, finance;` + `ALTER TABLE ... SET SCHEMA ...` for the 23
   existing models, generated and reviewed on its own.
2. Attendance migration: `CREATE TABLE hr.attendance_records`, `hr.attendance_sessions`,
   `hr.attendance_corrections`, with their indexes/constraints, generated via
   `pnpm --filter database exec prisma migrate dev` per the existing convention — never hand-edited,
   never `db push` (`Docs/ARCHITECTURE.md` §9 / `HOW_TO_ADD_A_MODULE.md` checklist).

If §1.4 is rejected in favor of Option B (build in `public` now), step 1 is skipped and step 2's
tables omit `@@schema(...)` entirely, landing in `public` like every other table today — purely
additive either way, so this choice does not block writing the Attendance migration once made;
only the schema-prefix differs.

## 6. Compatibility analysis

- Zero existing rows, tables, or migrations are read, modified, or relocated by the Attendance
  migration itself (step 2 above) under either option.
- No existing Prisma relation changes shape — `Employee`, `ShiftAssignment`, `Holiday`,
  `WeeklyOffRule`, `LeaveRequest` each simply gain one new inverse relation field
  (`attendanceRecords Employee[]`-style) pointing at the new tables, which is additive to the
  model, not a change to any existing column or constraint.
- `packages/database/prisma/permissions/catalog.ts` gains new permission strings
  (`hr.attendance.read/write`, `.own/.team/.all`; `hr.attendance_correction.approve`) following the
  existing `scopedPermission()` helper — no existing permission string changes.
- If Option A (schema split) is approved, that migration is the only one with broader blast
  radius, and it is explicitly scoped as its own reviewed change per §1.4, not something this task
  will execute without separate sign-off.

---

## Summary for sign-off

The one blocking decision is §1: whether to do the platform-wide Postgres schema split as a
prerequisite (recommended, Option A, as its own PR) before Attendance tables are created, or defer
it (Option B) and accept a second migration for Attendance's own tables later. Everything else in
this document — the three proposed tables, their relationships, and the migration/compatibility
plan — is additive and low-risk under either choice, and is ready to implement once (a) this
schema question and (b) the open product decisions in `ATTENDANCE_ARCHITECTURE.md` §6 are answered.

---

## 7. As built: schema and migration

Migration: `packages/database/prisma/migrations/20261005065109_add_hr_attendance` (additive; no
existing migration touched). Applied to `texawave_erp` (dev) and `texawave_erp_test`.
Drift check: empty. Tables are in the `hr` schema. No `attendance` schema exists.

### 7.1 Tables

| Table (hr)               | Purpose                                                                           | Key constraints                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attendance_records`     | one row per employee per IST date that has punches, an HR status, or a correction | UNIQUE (organization_id, employee_id, attendance_date); `status` CHECK in (PRESENT, ABSENT, HALF_DAY) or NULL                                                            |
| `attendance_sessions`    | one punch pair; `source` CHECK in (SELF, HR, CORRECTION)                          | `check_out_at` > `check_in_at` (CHECK); partial UNIQUE on `attendance_record_id` WHERE `check_out_at IS NULL` (one open session per day); FK → records ON DELETE CASCADE |
| `attendance_corrections` | correction request, SUBMITTED → APPROVED / REJECTED                               | type CHECK; status CHECK; decision CHECK (decided fields agree with status; REJECTED requires a note); at least one requested time; requested pair ordered               |

Foreign keys: organization and employee on both top-level tables, record on corrections (nullable,
ON DELETE SET NULL), requester and decider to `platform.users`. Eight FKs in all. Platform FK count
went from 50 to 58.

### 7.2 Deviations from §2

- No derived-hours columns (see architecture §7.9). `attendance_records` has no first/last punch,
  worked, overtime, shortfall or `is_regularized` columns.
- `status` is nullable and holds only explicit values.
- No soft delete on sessions. Manual edit hard-deletes replaced punches; the audit row holds their state.
- The cross-day "one open session per employee" rule is a service-level advisory lock, not a DB constraint.
- Corrections use `SUBMITTED`, not `PENDING`.

### 7.3 Verification on dev (after apply)

- Platform tables 14, hr tables 14 (11 + 3), public `_prisma_migrations` only.
- FKs 58 (was 50). Triggers 9 (unchanged). Exclusion constraints 4 (unchanged). Partial unique index: 1.
- Existing HR and platform row counts were not touched by this migration.
- Permissions synced: catalogue 67. Dev now has 68 rows: the 67 plus one test leftover that is not in the catalogue.

### 7.4 Round 2 (scheduler and reports): no migration

The auto-checkout scheduler and the missing-punch and overtime reports need no schema change. The
scheduler is an in-process timer, and both reports are read-only over the existing tables. No
migration was created in this round, and the migration history is unchanged. Verified after the
round: migration status up to date on dev and test, drift empty on both, schema valid.
