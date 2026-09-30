# Backend e2e tests

The e2e suites boot the real `AppModule` against a real Postgres and Redis. They create
organizations, users, employees and audit rows. Some of that is **permanent by design**: `audit_logs`
and `employee_status_history` are append-only (database triggers reject UPDATE/DELETE), so a test
organization that produced audit rows can never be deleted. The suites also use Redis keys derived
from numeric user ids (`permissions:{id}`, `refresh:{id}:*`), which collide with real users' entries.

So they must run on a **disposable database and their own Redis DB index** — never the shared dev or a
production one.

## The guard

`vitest.config.e2e.ts` loads `test/support/e2e-setup.ts`, which **refuses to start** unless

- the database name contains `test` or `e2e` (as a whole word, e.g. `texawave_erp_test`), and
- the Redis URL uses a non-zero DB index (e.g. `redis://localhost:6379/5`).

CI is exempt (`CI=true`, set automatically by GitHub Actions, on an ephemeral service container).
`NODE_ENV` is **not** used: Vitest sets `NODE_ENV=test` on every machine, which is exactly how a first
version of this guard let a local run reach the dev database. `ALLOW_E2E_ON_SHARED_DB` exists as an
escape hatch but only accepts one deliberately long phrase (see `e2e-guard.ts`); do not use it.

## Running

```bash
# once: create the database and apply the migrations to it
docker exec <postgres-container> psql -U texawave -d postgres -c "CREATE DATABASE texawave_erp_test;"
DATABASE_URL="postgresql://texawave:<pw>@localhost:5432/texawave_erp_test?schema=public" \
  pnpm --filter @texawave-erp/database exec prisma migrate deploy

# every time
DATABASE_URL="postgresql://texawave:<pw>@localhost:5432/texawave_erp_test?schema=public" \
REDIS_URL="redis://localhost:6379/5" \
  pnpm --filter api test:e2e
```

Shell variables win over `apps/api/.env`, so nothing in `.env` needs to change.

To start clean, drop and recreate `texawave_erp_test` and re-run `migrate deploy` (this also
re-proves the whole migration chain). Nothing in the suites flushes Redis or deletes rows they did
not create; each suite removes only the cache keys of the users it made.

## Conventions the HR suites follow

- Each suite creates its own organizations with a random slug, so suites and re-runs never collide.
- Anything that must be unique per test (date ranges for leave, shift, weekly-off) uses its own
  employee/year — overlap prevention is a feature, so reusing a window makes a test fail correctly.
- `it.each` tables are built before `beforeAll` runs: rows that need ids created there are passed as
  thunks (`() => ({ teamId })`).
- DB-level invariants are asserted with raw Prisma calls, independent of the API, next to the API tests
  that rely on them. Where a test proves a constraint matters, temporarily dropping the constraint
  should make it fail (the concurrency/overlap/audit tests were checked this way).
