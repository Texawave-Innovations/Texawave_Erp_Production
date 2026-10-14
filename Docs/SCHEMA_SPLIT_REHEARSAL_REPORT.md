# Schema-Split Migration — Rehearsal Report

**Status:** rehearsed on an isolated disposable database only. Nothing applied to the development
database. Awaiting explicit approval before any real deploy.

**Repo state:** branch `feature/HR`, HEAD `7e69123`. Nothing committed, pushed, or merged. `main`
untouched. `TexaWave_ERP` untouched.

**Rehearsal target (verified before every SQL run):** Postgres 16 container
`schema-split-rehearsal-pg`, `localhost:5544`, database `texawave_erp_schema_split_test`. Distinct
from the development container (`localhost:5432`, `texawave_erp`), which was never connected to by
any rehearsal command.

## 1. Migration diff

New migration: `packages/database/prisma/migrations/20261001120154_split_platform_hr_schemas/migration.sql`
(hand-authored; see §4 for why Prisma's generated diff was rejected).

| Step                 | Statements                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas              | `CREATE SCHEMA IF NOT EXISTS` for `platform`, `hr`                                                                                                                                                                                     |
| Platform tables (14) | `ALTER TABLE "public".x SET SCHEMA "platform"` — organizations, users, permissions, roles, role_permissions, user_roles, departments, teams, user_team_access, password_reset_tokens, tags, menu_items, audit_logs, document_sequences |
| HR tables (11)       | `ALTER TABLE "public".x SET SCHEMA "hr"` — designations, employment_types, work_locations, employees, employee_status_history, shifts, shift_assignments, holidays, weekly_off_rules, leave_types, leave_requests                      |
| Functions (4)        | `ALTER FUNCTION … SET SCHEMA` — `prevent_row_mutation` → platform; `employees_protect_identity`, `employees_no_reporting_cycle`, `leave_requests_protect` → hr                                                                         |
| Function body fix    | `CREATE OR REPLACE FUNCTION "hr"."employees_no_reporting_cycle"()` — body references `"hr"."employees"` instead of unqualified `"employees"`                                                                                           |

Owned sequences move automatically with their tables (no explicit statements).

Repo code changed alongside the migration (working tree, uncommitted):

- Six raw-SQL call sites qualified (`hr.` / `platform.` prefixes): `employee-code.ts`,
  `employee-lock.ts`, `employee-references.ts`, `leave-requests.repository.ts`,
  `shift-assignments.repository.ts`, `weekly-off-rules.repository.ts`.
- `apps/api/test/audit.e2e-spec.ts`: three raw SQL strings against `audit_logs` qualified as
  `platform.audit_logs`. (Not in the original inventory; found by the test run.)
- `packages/database/prisma/schema.prisma`: `schemas = ["platform", "hr"]` on the datasource;
  `@@schema("platform")` on 14 models, `@@schema("hr")` on 11. The `multiSchema` preview flag is
  not needed on Prisma 6.19.3 (it emits a deprecation warning), so it is omitted.

## 2. Verification results

**Baseline** (pre-migration, 13 migrations applied, seeded plus HR fixture rows): 23 non-empty
tables with row counts, 73 constraints, 25 indexes, 9 triggers, 4 exclusion constraints, 23
sequences, all in `public`.

**Post-migration** (14 migrations applied):

| Check                                                                 | Result                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Row counts, every table with baseline data                            | identical (e.g. organizations 1→1, permissions 49→49, role_permissions 84→84, employees 1→1, leave_requests 1→1) |
| Tables outside `hr`/`platform`                                        | none; only `_prisma_migrations` remains in `public`                                                              |
| Constraints per table (CHECK/FK/PK)                                   | identical counts, 73 rows in both                                                                                |
| Indexes per table                                                     | identical                                                                                                        |
| Triggers                                                              | all 9 present, on the same tables, now schema-qualified                                                          |
| Exclusion constraints                                                 | all 4 present                                                                                                    |
| Foreign keys                                                          | 30 FKs, including cross-schema `hr.* → platform.*`, all resolve                                                  |
| Sequences                                                             | 23 moved: 11 hr, 12 platform, none left in `public`                                                              |
| Append-only protection, `audit_logs` UPDATE                           | rejected (`restrict_violation`)                                                                                  |
| Append-only protection, `employee_status_history` DELETE              | rejected                                                                                                         |
| Cross-schema FK enforcement (`hr.employees.team_id → platform.teams`) | rejected on bad value                                                                                            |
| Exclusion constraint (`shift_assignments` overlap)                    | rejected                                                                                                         |
| Reporting-cycle trigger, multi-hop                                    | works after the body fix (failed before it, see §4)                                                              |

**Test suites** (against the rehearsal database, `REDIS_URL` DB index 5):

| Suite                                                                                                      | Result                                   |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Backend e2e (`pnpm --filter api test:e2e`), 16 files                                                       | **567/567 passed**                       |
| API unit tests (excluding e2e), 33 files                                                                   | **370/370 passed**                       |
| API typecheck (`tsc --noEmit`)                                                                             | exit 0                                   |
| API lint (`eslint src test`)                                                                               | exit 0                                   |
| Migration drift (`prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`, shadow DB) | "No difference detected", exit 0         |
| `prisma migrate status`                                                                                    | 14 migrations found, database up to date |
| `permissions:sync --check`                                                                                 | catalogue valid, 49 permissions          |

Lint and typecheck were run on the `api` package only. The full `turbo run lint typecheck test build`
across all packages was not run.

## 3. Recovery steps

Rehearsal recovery is a drop and rebuild: `DROP DATABASE texawave_erp_schema_split_test`, recreate,
`prisma migrate deploy`, re-seed. The migration is transactional, so a mid-run error rolls back fully.
This was observed: a deliberately failing first attempt left zero residue.

For the eventual development deploy (not yet approved):

1. `pg_dump` of the development database before anything else.
2. Confirm the migration file is final. Prisma checksums migration files, so editing one after it
   has been applied to a database causes a mismatch.
3. `prisma migrate deploy` only. Never `migrate dev` or `db push`.
4. Run the verification queries above against the development database.
5. If anything fails, restore from the dump. Do not hand-patch.

## 4. Corrections to the approved plan

Each item below was found by the rehearsal and contradicts `Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md`:

1. **`prisma migrate dev` cannot generate this migration.** Its diff emits 25 `CREATE TABLE`
   statements in the new schemas and zero `ALTER TABLE … SET SCHEMA`. Applied, that would leave all
   data orphaned in `public` while the app reads empty `hr`/`platform` tables. The file was
   hand-authored. The generated version was never applied anywhere.
2. **Owned sequences move automatically.** The plan's §5 implied they would need explicit moves.
   Explicit `ALTER SEQUENCE` statements error, because the sequence has already moved.
3. **Function bodies are a separate risk from triggers.** A trigger binds to its function by object
   id, so moving the trigger's table is safe. A PL/pgSQL body resolves unqualified table names at
   execution time, so `employees_no_reporting_cycle` broke once `employees` left `public`. Failure
   seen in the test run: 2 `hr-employees` tests. Fixed by qualifying the body.
4. **Test files contain raw SQL too.** `audit.e2e-spec.ts` had three unqualified `audit_logs`
   statements. Failure seen: 3 `audit` tests.
5. **Prisma's `multiSchema` is GA on 6.19.3.** The preview flag is unnecessary.
6. **Stale generated client.** `seed.ts` failed halfway after a rebuild because `packages/database/generated`
   predated the `MenuItem` and `PasswordResetToken` models that arrived with the merged branch
   work. Fix: `prisma generate` before seeding. This was a rehearsal-process error, not a migration
   defect. It produced an inaccurate first baseline, which was discarded and rebuilt.
7. **Two models not in the approved 23.** `PasswordResetToken` and `MenuItem` arrived with the
   merged branch work. Both are classified platform, the same category as `User` and `Role`. This
   was not separately approved and is flagged for confirmation.
8. **`apps/api` dependencies were stale.** `@nestjs/throttler` was declared in `package.json` and the
   lockfile, but not installed. Fixed by `pnpm install --frozen-lockfile`. No dependency was added
   or changed.

## 5. Open risks

- **Hand-authored migration.** Future migrations in this repo must be reviewed as raw SQL and cannot
  be trusted from `prisma migrate dev` alone whenever a schema move or a function is involved.
- **Cross-schema dependencies.** `hr` tables reference `platform` tables by FK and by shared
  functions. Any future schema move must check both directions.
- **`migration_lock.toml` shows as modified.** Line endings only (CRLF written by Prisma on Windows).
  No content change. Not reverted, to avoid touching a file the user did not ask about.
- **Not tested here:** CI on a clean runner, the web UI, the other business-module schemas (SCM, CRM,
  Finance), and the `attendance` work, which is design-only and unaffected by this migration.
- **Database-level append-only protection** is only as strong as the trigger; a superuser can drop it.
  This was already noted in the original design.

## 6. Decisions needed before development deploy

1. Approve the hand-authored migration content in §1.
2. Confirm `PasswordResetToken` and `MenuItem` as platform.
3. Confirm the six raw-SQL edits and the test-file edit are acceptable in the same change.
4. Confirm whether the rehearsal container should be kept for review or torn down.
