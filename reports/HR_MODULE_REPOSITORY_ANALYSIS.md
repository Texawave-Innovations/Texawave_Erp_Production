# HR Module — Repository Analysis (analysis only, nothing implemented)

|                                           |                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository analysed**                   | `Texawave_Erp_Production`, branch `main`, HEAD `73bbb16` ("Architecture md changes"), working tree clean before this report was written                                                                   |
| **Purpose**                               | Establish what exists, what does not, and what the HR backend (then the Attendance backend) must build on                                                                                                 |
| **Status**                                | **Analysis only.** No application code, Prisma schema, migration, dependency or configuration was changed. Implementation is waiting for approval.                                                        |
| **Related documents (outside this repo)** | `TexaWave_ERP/reports/HR_ATTENDANCE_MODULE_AUDIT.md` (old app audit) and `TexaWave_ERP/reports/NEW_POSTGRESQL_ATTENDANCE_IMPLEMENTATION_BLUEPRINT.md` (attendance design, includes tested PostgreSQL DDL) |

## Labels used

- **[Verified]** — confirmed by reading source/schema/config in this repo, or by a command I ran (results in §0.2).
- **[Docs only]** — stated in `Docs/` or `CLAUDE.md` but **not** found in the code/schema. Never treated as existing.
- **[Recommendation]** — my proposal.
- **[Blocker]** — must be resolved before the dependent work can start.
- **[Decision]** — needs a human/business choice (collected in §12).

---

## 0. Verification performed

### 0.1 What I read

`CLAUDE.md`; `Docs/ARCHITECTURE.md`, `CODING_STANDARDS.md`, `HOW_TO_ADD_A_MODULE.md`, `DESIGN_SYSTEM.md` (headings); the whole of `apps/api/src` (auth, tenancy, roles-permissions, users, organizations, health, shared, common, config, `_reference/tags`, `settings/roles`), `apps/api/test`, `apps/api` package/eslint/tsconfig/vitest configs; `packages/database` (schema, all 4 migrations, seed, prisma config); `packages/core`, `packages/api-types`, `packages/ui-kit` (file list), `apps/ui` (package, api-client, auth store, dashboard layout, providers, roles feature, Playwright config), `apps/mobile` (package list), `.github/workflows/ci.yml`, `docker-compose.yml`, `commitlint.config.js`, `CODEOWNERS`, `scripts/scaffold-module.mjs` (header), env examples, `.gitignore`.

### 0.2 What I executed (all read-only with respect to the repository)

| Command                                                                                                                             | Result                                                                                                | Notes                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short` before and after                                                                                               | empty before; after this report only `?? reports/`                                                    | see §0.3                                                                                                                                                                                                                                        |
| `prisma validate`                                                                                                                   | schema valid                                                                                          |                                                                                                                                                                                                                                                 |
| `prisma migrate status` against the local dev DB                                                                                    | "Database schema is up to date" (4 migrations)                                                        | read-only                                                                                                                                                                                                                                       |
| `pnpm --filter api typecheck`                                                                                                       | exit 0                                                                                                |                                                                                                                                                                                                                                                 |
| `pnpm --filter api lint`                                                                                                            | exit 0                                                                                                |                                                                                                                                                                                                                                                 |
| `pnpm --filter api test` (unit)                                                                                                     | **2 files, 8 tests passed**                                                                           |                                                                                                                                                                                                                                                 |
| `pnpm --filter api test:e2e`                                                                                                        | **3 files, 16 tests passed**                                                                          | run against a **throw-away database** (`analysis_e2e`, migrations applied by `migrate deploy`) and **Redis DB index 5**, both dropped/flushed afterwards, so the dev database and its Redis keys were untouched (see §3.5 for why this matters) |
| `typecheck` + `lint` for `database`, `core`, `api-types`, `ui-kit`, `ui`                                                            | completed with no errors reported (`ui` typecheck runs `next typegen`, which writes gitignored files) | exit codes were not individually captured for these five; api's were                                                                                                                                                                            |
| **CI's exact drift command**: `prisma migrate diff --from-migrations … --to-schema-datamodel … --shadow-database-url … --exit-code` | **exit code 2 — drift detected on the current `main`**                                                | see §3.4. Reproduced twice (once on a copy, once on the real files; only a scratch shadow DB was used)                                                                                                                                          |

Not executed: `turbo run build`, `next build`, Playwright UI e2e (needs a running API/UI; documented as not in CI), mobile.

### 0.3 Repository-safety statement

- **Modified:** nothing tracked. `git status` was empty before I started and, after writing this file, shows only the new untracked `reports/` folder.
- **Created inside the repo:** `reports/HR_MODULE_REPOSITORY_ANALYSIS.md` (this file) only.
- **Gitignored local artefacts that already existed from an earlier setup session (not part of this analysis, not tracked):** `.env`, `apps/api/.env`, `apps/ui/.env.local`, `packages/database/.env`, generated Prisma client, `dist/`, `.next/`.
- **Outside the repo:** Docker Desktop was started (it had stopped); scratch databases `analysis_e2e` and `analysis_shadow` were created and dropped in the local dev Postgres container; Redis DB 5 was flushed (it only held the e2e run's keys). The `TexaWave_ERP` project was not touched by this task.

---

## 1. Repository architecture overview [Verified]

pnpm workspaces + Turborepo monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`; `packageManager` pnpm 9.15.4; `engines.node >=20`).

```
apps/api        NestJS 12 modular monolith (type: module, swc builder, Vitest)
apps/ui         Next.js 16.3.5 (App Router) + React 19, Tailwind 4, TanStack Query, Zustand, Playwright
apps/mobile     Expo scaffold only (no shared-package usage yet)
packages/database   Prisma 6.19.3 schema, migrations, seed, generated client (classic engine)
packages/core       framework-agnostic API client, ApiError, query keys, zod schemas
packages/api-types  HAND-WRITTEN wire types (no OpenAPI generation)
packages/ui-kit     Tailwind design-system primitives
packages/config     shared eslint/tsconfig/prettier
deployment/         CodeBuild plumbing (api, ui)
Docs/  scripts/scaffold-module.mjs  .github/workflows/ci.yml  docker-compose.yml (Postgres 16 + Redis 7)
```

### 1.1 What is implemented vs. planned

| Area             | Implemented in code                                                                                                                                                                                          | Documented but **absent** [Docs only]                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Platform         | `auth` (login/refresh/logout), `users` (repo only), `organizations` (repo only), `roles-permissions` (guard/service/repo), `tenancy` (interceptor + `TenantContextService` + `TeamContextService`), `health` | `platform/audit`, `platform/notifications`, `platform/documents-vault`; users/organizations **controllers/services**                      |
| Business modules | `_reference/tags` (fixture), `settings/roles`                                                                                                                                                                | `modules/teams`, **`modules/hr`**, `modules/employee-self-service`, `modules/master-data`, everything paused                              |
| Tables           | `organizations, users, permissions, roles, role_permissions, user_roles, departments, teams, user_team_access, tags`                                                                                         | `employees, designations, shifts, leave_*, statuses, status_history, audit_logs, approvals, attachments, comments, document_sequences, …` |
| Frontend         | login page, dashboard shell, `settings/roles` screen, `_reference/tags` screen                                                                                                                               | `(employee-portal)` route group, `middleware.ts`, `usePermission` hook, any HR screen                                                     |
| Infra            | Redis (refresh tokens + permission cache), pino logging, swagger at `/docs`                                                                                                                                  | EventEmitter2, queue/scheduler, rate limiting, helmet, argon2                                                                             |

**Verified by search:** no file under `apps/`, `packages/` or `scripts/` contains the words _employee, designation, shift or attendance_ (code, schema or scripts). `apps/api/src/modules/` contains only `_reference` and `settings`.

---

## 2. Verified existing backend stack

| Concern               | Verified fact                                                                                                                                                                                                                                                                                                                             | Evidence                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Framework             | NestJS 12, Express platform, `@nestjs/swagger`, `class-validator`/`class-transformer`, `zod` for env                                                                                                                                                                                                                                      | `apps/api/package.json`                                        |
| Language settings     | TS 6.0.3, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (hence `?: T \| undefined` in filters), `nodenext` modules (imports end in `.js`), decorators enabled                                                                                                                                                        | `packages/config/tsconfig.base.json`, `apps/api/tsconfig.json` |
| Build/test            | swc builder with `typeCheck`, Vitest 4 (`*.spec.ts` unit, `*.e2e-spec.ts` via `vitest.config.e2e.ts`), supertest, `globals: true`                                                                                                                                                                                                         | `nest-cli.json`, `vitest.config*.ts`                           |
| Bootstrap             | `NestFactory.create`, `nestjs-pino` logger, CORS from env, Swagger at `/docs`; **no global route prefix, no versioning, no helmet, no shutdown hooks**                                                                                                                                                                                    | `src/main.ts`                                                  |
| Global pipeline       | `ValidationPipe({whitelist, forbidNonWhitelisted, transform, enableImplicitConversion})` via `APP_PIPE`; `ResponseInterceptor` → `{data, meta?}`; `AllExceptionsFilter` → `{statusCode, message, error, path, timestamp, correlationId}`; global `JwtAuthGuard` (opt-out `@Public()`), then `PermissionsGuard`, then `TenancyInterceptor` | `app.module.ts`, `auth.module.ts`, `tenancy.module.ts`         |
| Layering              | controller → service → repository (only place `PrismaService` is used). ESLint enforces: controllers cannot import Prisma; no import cycles; a **top-level** `modules/<name>` may not import a sibling top-level module's `*.repository.ts`                                                                                               | `apps/api/eslint.config.cjs`                                   |
| Errors                | `BusinessException(message, status, errorCode)` base; only `ResourceNotFoundException`, `ResourceConflictException` exist                                                                                                                                                                                                                 | `common/exceptions/business.exception.ts`                      |
| Pagination            | `PaginationDto` (`page` default 1, `limit` default 20 max 100, `order`), `@Paginate(QueryDto)` param decorator, `PaginatedResponseDto`                                                                                                                                                                                                    | `common/dto`, `common/decorators`                              |
| Transactions          | Prisma `$transaction([...])` array form used in `roles.repository.ts`; no interactive-transaction or CLS-transaction helper exists                                                                                                                                                                                                        | `roles.repository.ts`                                          |
| Redis                 | `ioredis` provider `REDIS_CLIENT` (global): refresh tokens (`refresh:{userId}:{jti}`, TTL = refresh TTL, rotated on use) and permission cache (`permissions:{userId}`, 15 min TTL, invalidated on role/grant change and at login)                                                                                                         | `shared/redis`, `auth.service.ts`, `permissions.service.ts`    |
| Background processing | **None.** No queue, no scheduler, no cron, no worker                                                                                                                                                                                                                                                                                      | `package.json`, source search                                  |
| Config/secrets        | zod-validated env (`NODE_ENV, PORT, LOG_LEVEL, DATABASE_URL, REDIS_URL, JWT_SECRET (min 32), JWT_*_TTL_SECONDS, CORS_ORIGIN`); fail-fast at start; per-package `.env.example`; pino redacts `authorization`/`cookie`                                                                                                                      | `config/env.validation.ts`, `logger.module.ts`                 |
| Logging               | `nestjs-pino`, correlation id from `x-correlation-id` or UUID, copied into CLS and error bodies                                                                                                                                                                                                                                           | `logger.module.ts`, `tenancy.interceptor.ts`                   |

### 2.1 Doc/code discrepancies found (fix docs in the same PR that touches the area)

| Docs say                                                                                               | Code says                                                                                          | Impact on HR                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Passwords hashed with **argon2** (`ARCHITECTURE.md` §8)                                                | **`bcrypt`** (`auth.service.ts`, seed)                                                             | New employee-account creation must use bcrypt (or the platform must switch)                                              |
| JWT carries `userId, organizationId, teamId, roleIds` (§6)                                             | payload is `sub, organizationId, roleIds, type` only                                               | `teamId`/`employeeId` must be resolved per request, not read from the token                                              |
| PKs `bigint GENERATED ALWAYS AS IDENTITY` (§1 table, §5.1 SQL) and "uuid" (§1 "Extensibility pattern") | `Int @id @default(autoincrement())`; `CODING_STANDARDS.md` §2/§17 and the schema agree on `Int`    | Use `Int` (schema is authoritative)                                                                                      |
| Baseline columns are `timestamptz` (§5.1)                                                              | Prisma `DateTime` without `@db.Timestamptz` ⇒ **`TIMESTAMP(3)` (no time zone)** in every migration | For anything time-critical (attendance) use `@db.Timestamptz(6)` explicitly; decide consistency for HR tables [Decision] |
| `TeamScopeGuard` (§6 point 3)                                                                          | no such guard; instead `TeamContextService.resolveScope()` + `@TeamScoped()` + `teamWhere()`       | Same idea, different shape (see §4.4)                                                                                    |
| "`api:test` includes the e2e suite" (§17)                                                              | CI runs e2e as a **separate** step                                                                 | none                                                                                                                     |
| Seed contains starter catalogue                                                                        | seed is **local-dev only, "NOT run in CI, NOT a migration"**                                       | see §3.6 (production permission seeding)                                                                                 |

---

## 3. Current database schema and migration conventions

### 3.1 Tables that exist [Verified: `packages/database/prisma/schema.prisma`, 266 lines]

`organizations`, `users`, `permissions`, `roles`, `role_permissions`, `user_roles`, `departments`, `teams`, `user_team_access`, `tags` (fixture).

Relationships relevant to HR: `users.organization_id`; `teams.department_id → departments` (nullable, `SetNull`); `teams.lead_user_id → users`; `user_team_access(user_id, team_id, is_lead)` with `@@unique([userId, teamId])`; `roles`/`user_roles`/`role_permissions` for RBAC.

### 3.2 Conventions in the schema (follow these)

- `id Int @id @default(autoincrement())`; FKs are `Int`; `BigInt` reserved for `audit_logs`/`status_history` (neither exists yet).
- snake_case tables/columns through `@@map`/`@map`; PascalCase singular models.
- Baseline columns on tenant tables: `organization_id`, `custom_fields Json @default("{}")`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at @updatedAt`, `deleted_at` (soft delete). Not every table has all of them (`permissions` has no `organization_id`/`deleted_at`; join tables have audit columns but no `deleted_at`; `users` has no `custom_fields`).
- Composite uniques are org-scoped (`@@unique([organizationId, email])`, `[organizationId, name]`, `[organizationId, code]`).
- Soft delete is done with `updateMany({deletedAt: new Date()})` in repositories; queries add `deletedAt: null` by hand (no Prisma middleware/extension).
- No Prisma enums; docs prefer a `statuses` lookup table (which does not exist yet).
- **`DateTime` columns are `TIMESTAMP(3)` without time zone** (see §2.1).

### 3.3 Migrations [Verified]

Four migrations under `packages/database/prisma/migrations/`: `20260918070103_init`, `20260920175508_int_pks_and_teams`, `20260922031430_add_department_above_team`, `20260922075614_add_baseline_audit_columns`. Workflow rules (`CLAUDE.md`): always `prisma migrate dev`, commit the generated migration, **never `prisma db push`**; migrations require reviewer sign-off.

### 3.4 ⚠ Pre-existing migration drift on `main` [Verified, blocker for the first PR]

CI runs `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`. Run against the current files it **exits 2** and reports:

```
[*] Changed the `permissions` table       Altered column `updated_at` (default changed from `Some(Now)` to `None`)
[*] Changed the `role_permissions` table  (same)
[*] Changed the `user_roles` table        (same)
```

Cause: `20260922075614_add_baseline_audit_columns` deliberately adds `DEFAULT CURRENT_TIMESTAMP` to `updated_at` on those three tables (to back-fill existing rows) but `schema.prisma` uses `@updatedAt` (no default) and no later migration drops it. I could not see CI results, so whether the check is currently red on `main` is **not verified**; the local reproduction is. **Any new migration PR will fail this CI step until a small migration drops those three defaults** (I confirmed in a scratch copy that adding `ALTER TABLE … ALTER COLUMN "updated_at" DROP DEFAULT` for the three tables makes the diff empty). That fix touches `packages/database/prisma/migrations/` (reviewer sign-off) and is proposed as Phase 0.

### 3.5 Test database configuration [Verified]

There is **no dedicated test database or Redis DB**. e2e tests boot `AppModule` against whatever `DATABASE_URL`/`REDIS_URL` the environment provides (in CI: an ephemeral service container; locally: the dev database). Tests create their own organisations and delete them in `afterAll`, but two consequences matter for HR:

1. Locally they write into the dev DB; and
2. they share the dev Redis: cache keys are `permissions:{userId}` / `refresh:{userId}:{jti}` keyed by numeric user id, so user ids from a scratch test DB **collide with real dev users' cache entries**. I therefore ran the suite against a separate DB _and_ `redis://…/5`. Recommend documenting/using a separate Redis DB index for e2e [Recommendation].

### 3.6 Seeding [Verified] — a production-permissions gap [Blocker/Decision]

`packages/database/prisma/seed.ts` upserts the org, three teams (+1:1 departments), the permission catalogue (`reference.tags.*`, `settings.role.*`) and a "Super Admin" role/user, and states it is **local-dev only — not a migration, not run in CI**. Permissions are **data**, and there is no production mechanism that inserts new permission rows (a migration would, or a prod-safe seed step). HR will add dozens of permission strings; how they reach staging/production must be decided (§12 D-04).

### 3.7 Raw-SQL support in the drift check [Verified experiment, scratch copy only]

Adding a scratch model plus raw-SQL objects in a migration — partial unique index, `CHECK`, `EXCLUDE USING gist` (+ `btree_gist`), trigger — still produced "No difference detected" from CI's drift command (after the §3.4 fix). Prisma surfaces constraint violations from `$executeRaw/$queryRaw` as `PrismaClientKnownRequestError` **code `P2010`** with the SQLSTATE in `error.meta.code` (`23505`, `23P01`, `23514`, `23502` observed); advisory locks and `FOR UPDATE SKIP LOCKED` worked inside `$transaction(async tx => …)` and rolled back correctly. This de-risks the Attendance design; it is not needed for a plain HR schema.

---

## 4. Authentication and RBAC integration requirements

### 4.1 Verified behaviour

- **Login** `POST /auth/login` takes `{organizationSlug, email, password}`; org resolved by slug, user by `(organizationId, email)`, `bcrypt.compare`; generic error message; returns access + refresh tokens. Refresh tokens rotate and live in Redis. `POST /auth/logout` deletes the user's refresh keys and invalidates the permission cache. **No signup, no password reset, no change-password, no invite flow** (explicitly out of scope in `auth.service.ts`).
- **JWT payload** `{sub: userId, organizationId, roleIds, type}`; `request.user = {userId, organizationId, roleIds}`; `TenancyInterceptor` copies them (and `correlationId`) into CLS.
- **Authorisation**: `@RequirePermission("x.y.z")` (single string) → `PermissionsGuard` checks `granted.includes(required)` where `granted` is the cached permission-code set (joins `role_permissions → roles → user_roles`, honouring `isActive` at all three levels).
- **Tenancy**: `TenantContextService.getOrgScope()/getUserId()`; repositories are `@OrgScoped()` + `tenantWhere(scope, filter)`.
- **Team scope** (`common/tenancy/team-*.ts`, `platform/tenancy/team-context.service.ts`): `TeamContextService.resolveScope(prefix)` returns the most permissive of `<prefix>.all|.team|.own` the caller holds (throws if none) and, for `.team`, loads the caller's `teamIds` from `user_team_access`. `@TeamScoped()` asserts the first repository argument; `teamWhere(scope, filter)` produces `{}` / `{teamId: {in}}` / `{userId}`.

### 4.2 Verified gaps that HR (and later Attendance) will hit

| #   | Gap                                                                                                                                                                                                                                                                 | Evidence                                                                         | Consequence                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G-1 | **`@RequirePermission` accepts one exact string.** A route that must admit `.own`, `.team` **or** `.all` holders cannot say so. `TeamContextService` even assumes the guard "already rejected" callers holding none of the three                                    | `permissions.guard.ts` (`granted.includes(required)`), `team-context.service.ts` | Needs a shared-code change: an "any of / scope-prefix" form of the decorator + guard, with tests. Shared platform code ⇒ reviewer sign-off (CODEOWNERS path `apps/api/src/common/`, `platform/`) |
| G-2 | **The team-scope machinery is unused and untested.** No module calls `resolveScope`, `@TeamScoped()` or `teamWhere`; no test references them. The build-order step "prove both on one dummy route incl. a negative test" (`ARCHITECTURE.md` §8 step 3) was not done | grep of `src` and `test`                                                         | HR employees will be its **first consumer**; expect to find and fix bugs there. Needs negative e2e tests (team lead cannot read another team's employee; `.own` sees only self; `.all` sees all) |
| G-3 | `teamWhere` hard-codes the column names `userId` and `teamId`                                                                                                                                                                                                       | `team-where.ts`                                                                  | Fine for `employees` (`user_id`, `team_id`). **Not** usable as-is for tables keyed by `employee_id` (attendance, leave) — needs a field-path option (`employee: {teamId…}`)                      |
| G-4 | JWT has no `employeeId`/`teamId`                                                                                                                                                                                                                                    | `jwt-payload.interface.ts`                                                       | Resolve `user → employee` per request in a service (cache in Redis with invalidation), do not widen the JWT casually (auth/tenancy change ⇒ review)                                              |
| G-5 | No `users` write API and no user-provisioning flow                                                                                                                                                                                                                  | `users.repository.ts` has only `findByEmail/findById`                            | Creating an employee's login needs new platform capability (create user, assign role, set initial credential) — see §7.3                                                                         |
| G-6 | No password-reset / invite / notification channel                                                                                                                                                                                                                   | absent                                                                           | Initial-credential delivery for new employees is undecided (D-05)                                                                                                                                |
| G-7 | No audit logging                                                                                                                                                                                                                                                    | `platform/audit` absent                                                          | Audit requirement (§7.6) needs a platform module first                                                                                                                                           |
| G-8 | No rate limiting, helmet, or lockout on login                                                                                                                                                                                                                       | absent                                                                           | Out of HR scope but relevant to security posture                                                                                                                                                 |

### 4.3 Permission naming to follow (`CODING_STANDARDS.md` §2a, verified consistent with `seed.ts`)

`<module>.<entity>.<action>[.<scope>]`, scope ∈ `own|team|all` only for team-scoped data, all three variants seeded even if one is used. Employee self-service uses its own namespace `employee_self_service.*` (docs) so an employee's token never needs `hr.*`.

---

## 5. Existing modules and assets HR can reuse

| Asset                                                             | Reuse for HR                                                                                                                                                                                                                     | Notes                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `_reference/tags`                                                 | Shape for every new module (controller/service/repository/DTOs, `@OrgScoped`, permission strings, pagination)                                                                                                                    | It is a fixture — copy the shape, do not extend it                                               |
| `settings/roles`                                                  | **Directly reusable** for assigning HR permissions to roles (the screen and API already exist); also the reference for `PermissionsService.invalidate()` after grant changes and for soft "revoke = `isActive:false`" grant rows | Nested layout `modules/settings/roles/` is the precedent for `modules/hr/employees/`             |
| `platform/auth`                                                   | Login/refresh for employees; org resolved by slug                                                                                                                                                                                | bcrypt cost 10 in seed                                                                           |
| `platform/roles-permissions`                                      | Permission cache + guard                                                                                                                                                                                                         | needs G-1 change                                                                                 |
| `platform/tenancy` (`TenantContextService`, `TeamContextService`) | Scope resolution                                                                                                                                                                                                                 | untested (G-2)                                                                                   |
| `teams`, `departments`, `user_team_access` tables                 | HR employee → team/department; team leads                                                                                                                                                                                        | `departments` has a table and seed rows but **no API or module** (docs assign it to Master Data) |
| Common pipeline                                                   | `PaginatedResponseDto`, `BusinessException`, filters, interceptors, validation pipe                                                                                                                                              | Add subclasses as needed (e.g. `InvalidStateTransitionException`)                                |
| `pnpm scaffold:module <name>`                                     | Skeleton generation; **does not** create Prisma models, permission strings or wire the module into `app.module.ts`                                                                                                               | Generates `apps/ui/src/features/<name>` too — do not use for UI in this phase                    |
| `packages/core` / `api-types` / `ui-kit`                          | Future UI: `ApiClient`, `orgScopedKey`, zod schemas, `DataTable`, `Dialog`, `Select`, `FormField`, `StatusBadge`, `Pagination`, `Toast`                                                                                          | ui-kit has **no** date picker, time picker, calendar or tabs (relevant to attendance UI later)   |
| Redis                                                             | Cache/invalidation pattern (`permissions:{userId}`)                                                                                                                                                                              | reuse the pattern for `user→employee` lookup cache                                               |

---

## 6. Missing dependencies and blockers

### 6.1 Blockers (must exist before dependent work)

| ID  | Item                                                                                           | Why                                                                                              | Owner/approval                    |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| B-1 | Migration drift fix (§3.4)                                                                     | Every later migration PR fails CI's drift step                                                   | Reviewer sign-off (migrations)    |
| B-2 | Commit scopes for `hr`, `master-data`, `employees`, `attendance` in `commitlint.config.js`     | `scope-enum` is frozen; a commit with a new scope is rejected. Adding one **must be its own PR** | Reviewer (shared tooling)         |
| B-3 | `@RequirePermission` "any-scope" support (G-1) + team-scope negative tests (G-2)               | HR is the first team-scoped module                                                               | Reviewer (`common/`, `platform/`) |
| B-4 | Decision on how permission rows reach non-dev environments (§3.6)                              | HR ships many permissions                                                                        | Architecture decision             |
| B-5 | `employees` cannot exist without decisions D-01…D-03 (id/code scheme, status model, PII split) | schema design                                                                                    | Product + architecture            |
| B-6 | Audit log platform module (G-7) — or an explicit decision to defer audit                       | requirement lists audit logging; docs mandate audit for HR/payroll access                        | Architecture                      |

### 6.2 Missing dependencies (each new package needs reviewer sign-off — `CLAUDE.md`)

| Package                                                                  | Need                                                                                                                                     | Alternatives                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `@nestjs/event-emitter` (EventEmitter2)                                  | Cross-module events are **mandated** by `CODING_STANDARDS.md` §11 (employee.created, employee.status_changed, leave events → attendance) | none acceptable under the current standard |
| Scheduler/queue: `@nestjs/schedule` or BullMQ (BullMQ can reuse ioredis) | Not needed for HR itself; needed by Attendance (auto-checkout, roll-up jobs)                                                             | decide at Attendance kickoff (D-11)        |
| Rate limiter (`@nestjs/throttler`)                                       | Login/check-in hardening                                                                                                                 | optional now                               |
| Excel/CSV export library                                                 | HR/attendance reports                                                                                                                    | optional; CSV can be hand-written          |

`argon2`, `helmet`, `class-transformer` (present), `zod` (present) — no action unless the argon2 doc/code mismatch is resolved toward argon2.

### 6.3 Docs-only items that are **not** present (do not assume)

`statuses` and `status_history`, `audit_logs` + `AuditInterceptor`, `approvals`/`approval_workflows`, `document_sequences`, `designations`, `shifts`, `leave_types`/`leave_requests`, `employees`, `platform/notifications`, `modules/teams`, `(employee-portal)`, `middleware.ts`, `usePermission`.

---

## 7. Proposed HR database entities and relationships [Recommendation]

Scope: what the HR backend needs first, designed so Attendance/Leave/Payroll can plug in without redesign. All tables follow the §3.2 baseline (`Int` ids, org-scoped uniques, soft delete, snake_case). Column lists are indicative, to be finalised after §12 decisions.

### 7.1 New tables

| Table (Prisma model)                                     | Purpose                                                                                      | Key columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `designations` (`Designation`)                           | Master data                                                                                  | `name`, `code`, `level?`, unique `(organization_id, name)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `employees` (`Employee`)                                 | The person record; the anchor for attendance/leave/payroll                                   | `employee_code` (human code, unique per org, **not** the PK), `user_id` (**nullable, unique**, FK `users` — 1:1 account mapping), `team_id` (FK `teams`, required per ARCHITECTURE §5.5), `department_id` (FK `departments`), `designation_id` (FK), `reports_to_id` (self-FK, deliberately separate from `team_id`), `employment_type` (permanent/contract/intern/…), `status` (see D-02), `date_of_joining`, `probation_end_date?`, `date_of_exit?`, `exit_reason?`, `full_name`, `work_email`, `phone`, plus baseline. Checks: `date_of_exit IS NULL OR date_of_exit >= date_of_joining`; `id <> reports_to_id` |
| `employee_sensitive_info` (`EmployeeSensitiveInfo`)      | PAN/Aadhaar/bank details — **separate table**, never `custom_fields` (`ARCHITECTURE.md` §10) | 1:1 `employee_id`; gated by `hr.employee_sensitive.read.all`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `shifts` (`Shift`)                                       | Master data. Needed by attendance; HR owns assignment                                        | `code`, `name`, `start_time`, `end_time`, `is_overnight`, `target_minutes`, break/grace/threshold columns as in the attendance blueprint §7 (can be introduced in stages)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `employee_shift_assignments` (`EmployeeShiftAssignment`) | Which shift an employee follows over time                                                    | `employee_id`, `shift_id`, `effective_from`, `effective_to?`; **no-overlap exclusion constraint** (raw SQL; tested in the blueprint)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `holidays` (+ `holiday_departments`), `weekly_off_rules` | HR calendar. **Decision D-08:** owned by HR (recommended) or by Attendance                   | as in the blueprint §7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `leave_types`, `leave_requests`, `leave_balances`        | Needed by attendance; separate phase (§10 Phase 6)                                           | out of the first HR cut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `audit_logs` (BigInt id)                                 | Platform; required for HR auditing                                                           | `actor_id`, `entity_type`, `entity_id`, `action`, `before/after jsonb`, `ip`, `at`, `correlation_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `statuses`, `status_history`                             | **Only if** D-02 chooses the docs' lookup-table approach                                     | see D-02                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `document_sequences`                                     | **Only if** D-01 chooses generated codes via config                                          | see D-01                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 7.2 Relationships

```
organizations 1─* employees          users 1─0..1 employees (employees.user_id UNIQUE, nullable)
teams 1─* employees                  departments 1─* employees (also via teams.department_id)
designations 1─* employees           employees 1─* employees (reports_to_id)
employees 1─* employee_shift_assignments *─1 shifts
employees 1─0..1 employee_sensitive_info
users 1─* user_team_access *─1 teams   (kept in sync with employees.team_id — see 7.4)
```

### 7.3 Employee ID and user-account mapping

- **Two identifiers:** the surrogate `employees.id` (Int PK, used by every FK in attendance/leave/payroll) and the human `employee_code` (e.g. `EMP0001`, immutable, unique per org). Never key attendance/leave on the code (the old app's dual-key problem — see the attendance audit).
- **1:1 optional account link:** `employees.user_id` nullable+unique. Not every employee needs a login; every login-holder who uses self-service must map to exactly one employee. A user with no employee gets 403 `NOT_AN_EMPLOYEE` on self-service routes.
- **Provisioning flow** (new; G-5, G-6): create employee → optionally create `users` row (`email`, bcrypt hash of a generated/one-time credential, `full_name`) → assign the "Employee" role (`user_roles`) → create `user_team_access` (team, `is_lead=false`) → invalidate the permission cache → emit `employee.created`. All in one transaction (except the event). Credential delivery is undecided (D-05).
- **Lookup service:** `EmployeeQueryService.findByUserId(userId)` exported from the HR module (public service, not repository — §11 rule), cached in Redis, invalidated on employee/user changes. Attendance and self-service call this.

### 7.4 Team/department/designation relationships

- `employees.team_id` is the access boundary; `user_team_access` must mirror it for team-scope resolution (`TeamContextService` reads that table, **not** `employees`). Changing an employee's team, or making someone a lead, updates `user_team_access` (and `teams.lead_user_id`) in the same transaction and invalidates caches. [Decision D-06: single source of truth — recommend `user_team_access` is derived from `employees` by the service, never edited independently.]
- `departments` currently 1:1 with `teams` only in seed data; the schema allows many teams per department and `teams.department_id` is nullable (documented as not-yet-required). `employees.department_id` should default from the team's department but stay explicit.
- `designations` are master data with no team dimension → permissions without a scope suffix (`master.designation.read/write`).

### 7.5 Employment status [Decision D-02]

Statuses needed: at least `ACTIVE`, `PROBATION`, `ON_NOTICE`, `INACTIVE/EXITED`, `SUSPENDED`. Options: (a) docs' `statuses` lookup + `status_history` (extensible, repo standard, but needs two new platform tables now and prevents DB-level `CHECK`s that name statuses); (b) `text` + `CHECK` (simple, DB-enforceable, deviates from `ARCHITECTURE.md` §5.2). Whichever is chosen, attendance needs "is this employee employable/active on date D", exposed via `EmployeeQueryService`.

### 7.6 Audit logging

Docs mandate a global `AuditInterceptor` writing `audit_logs` for mutations, and additionally logging **reads** of payroll/sensitive data. Nothing exists. Recommendation: build `platform/audit` (module, writer service, interceptor, `audit_logs` model with `BigInt id`) as a prerequisite PR, then HR services add explicit `before/after` for employee, status, team, shift-assignment and account-linking changes. If deferred (D-09), HR mutations must at least record `created_by/updated_by` (baseline) and emit events so the audit writer can subscribe later.

---

## 8. Proposed HR APIs and business logic [Recommendation]

Conventions: no global prefix; controllers named per area (precedent `@Controller("settings")` → `/settings/roles`). Responses use `{data, meta}`; errors use `BusinessException` subclasses; DTOs validated with class-validator (`whitelist`, `forbidNonWhitelisted`); integer `:id` with `ParseIntPipe`; list endpoints use `@Paginate(QueryDto)`.

### 8.1 Master data (Phase 1)

| Route                                             | Permission                           | Notes                                                                               |
| ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `GET/POST/PATCH/DELETE /master-data/designations` | `master.designation.read` / `.write` | soft delete; conflict on duplicate name                                             |
| `GET/POST/PATCH/DELETE /master-data/departments`  | `master.department.read` / `.write`  | table already exists; add API only                                                  |
| `GET/POST/PATCH/DELETE /master-data/shifts`       | `master.shift.read` / `.write`       | validation of times/overnight/target; cannot delete a shift with active assignments |

### 8.2 Employees (Phase 2)

| Route                                                 | Permission (scope-aware)                                               | Behaviour                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /hr/employees`                                   | `hr.employee.read.{own,team,all}`                                      | filters: `search`, `teamId`, `departmentId`, `designationId`, `status`; scope applied by `teamWhere`                                          |
| `GET /hr/employees/:id`                               | same                                                                   | 404 (not 403) when outside scope                                                                                                              |
| `POST /hr/employees`                                  | `hr.employee.write.all` (team-lead create only if D-07 allows `.team`) | validates team/department/designation exist in org; generates `employee_code`; optional account provisioning; emits `employee.created`        |
| `PATCH /hr/employees/:id`                             | `hr.employee.write.{team,all}`                                         | optimistic-lock `version`? (D-10); field-level rules (e.g. only `.all` may change team or status)                                             |
| `POST /hr/employees/:id/status`                       | `hr.employee.write.all`                                                | validated state machine (e.g. ACTIVE→ON_NOTICE→EXITED; no reactivation without reason); writes history/audit; emits `employee.status_changed` |
| `POST /hr/employees/:id/account` / `DELETE …/account` | `hr.employee.write.all` (+ `settings.role.write` semantics for role)   | create/link/unlink login; deactivates `users.is_active` on exit                                                                               |
| `GET /hr/employees/:id/sensitive`                     | `hr.employee_sensitive.read.all`                                       | **read is audit-logged**                                                                                                                      |
| `GET /hr/employees/me` (or under self-service)        | `employee_self_service.employee.read`                                  | resolves from JWT user                                                                                                                        |
| `GET /hr/org-chart`                                   | `hr.employee.read.*`                                                   | `reports_to_id` tree, scope-filtered                                                                                                          |

### 8.3 Shift assignments (Phase 3)

`GET/POST/DELETE /hr/employees/:id/shift-assignments`, permission `hr.shift_assignment.read/write.{team,all}`; server validates no overlap (DB exclusion constraint + friendly error mapping of SQLSTATE `23P01` via `error.meta.code`, see §3.7).

### 8.4 Business rules

- Employee code uniqueness per org; immutable after creation.
- One employee per user; account creation and role assignment are atomic; account is deactivated (not deleted) on exit.
- Team change ⇒ `user_team_access` re-sync + permission/scope cache invalidation; reporting line must not create a cycle.
- Joining/exit dates gate everything downstream (attendance rows only inside `[date_of_joining, date_of_exit]`).
- Soft delete only; PII in its own table with its own permission; sensitive reads audited.
- Permissions never widened by the client; employee id never accepted from a self-service request body.

### 8.5 Events (need `@nestjs/event-emitter`, §6.2)

`employee.created`, `employee.updated`, `employee.status_changed`, `employee.team_changed`, `employee.exited`, `shift_assignment.changed`. Each event carries ids + a few fields; listeners live in subscribing modules (§11 rule).

---

## 9. Required tests and acceptance criteria

### 9.1 Test conventions to follow [Verified]

Service unit tests with mocked repositories/context (`roles.service.spec.ts` pattern, Vitest `vi.fn()`); e2e tests boot `AppModule`, seed two organisations and users with different permission sets, log in via `/auth/login`, and assert on `{data}` envelopes, status codes and cache behaviour (`reference-tags` and `settings-roles` e2e specs). A PR must include the e2e test **before** review (`CLAUDE.md`).

### 9.2 Required for HR

| Area                     | Tests                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employees service (unit) | code generation, duplicate conflicts, account-provisioning atomicity (repository mocked to fail mid-way), status state machine incl. invalid transitions, team-change resync, reporting-cycle prevention                                                                                                                                          |
| Employees e2e            | unauthenticated ⇒ 401; missing permission ⇒ 403; **team lead sees only own team (list and by-id ⇒ 404 for another team)**; `.own` sees only self; `.all` sees all; org isolation (404 across orgs); whitelist rejects unknown fields; pagination meta; soft delete hidden; sensitive read requires the special permission and writes an audit row |
| Account mapping e2e      | new employee can log in and gets only self-service permissions; user without employee ⇒ 403 on self-service; deactivating the employee blocks login and clears refresh/permission caches                                                                                                                                                          |
| Shift assignments        | overlap ⇒ 409/422 mapped from `23P01`; adjacent ranges allowed; cannot assign an inactive shift                                                                                                                                                                                                                                                   |
| DB constraint tests      | unique employee code per org, `user_id` unique, date and self-reference checks — as an e2e-style spec using raw Prisma (pattern proven in the attendance blueprint)                                                                                                                                                                               |
| Platform changes         | "any-scope" permission decorator/guard tests; `teamWhere` field-path option tests; `TeamContextService.resolveScope` matrix (`all` > `team` > `own`, none ⇒ error)                                                                                                                                                                                |
| Migration                | CI drift step green; `migrate deploy` on an empty DB; seed idempotent                                                                                                                                                                                                                                                                             |
| Lint/typecheck           | `pnpm exec turbo run lint typecheck test build` and `pnpm --filter api test:e2e` green                                                                                                                                                                                                                                                            |

### 9.3 Acceptance criteria (HR backend)

1. No HR route is reachable without JWT + permission; every read/write on employee data is org- **and** team-scoped in the repository (`@TeamScoped()`), proven by negative tests.
2. Every employee has exactly one stable surrogate id and one immutable code; account link is 1:1 and consistent with `user_team_access`.
3. CI drift check, lint, typecheck, unit and e2e all pass on a clean database.
4. Docs updated in the same PRs (inventory in `ARCHITECTURE.md` §5.6, permission list, argon2/bcrypt and JWT-payload corrections where touched).
5. `EmployeeQueryService`, `ShiftQueryService` (and events) exist and are documented so Attendance can build without touching HR repositories.

---

## 10. Phased HR backend implementation plan (exact paths)

All phases follow: one module per PR, e2e test before review, migrations via `prisma migrate dev` (never `db push`), conventional commits with an allowed scope, docs updated in the same PR. Paths are proposals; nothing has been created.

### Phase 0 — Unblockers (small PRs, mostly review-gated)

| PR                                              | Files                                                                                                                                                                                                                                                                                                              | Sign-off needed                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 0a Fix migration drift                          | `packages/database/prisma/migrations/<timestamp>_drop_updated_at_defaults/migration.sql` (3× `ALTER COLUMN "updated_at" DROP DEFAULT`)                                                                                                                                                                             | migration reviewer                  |
| 0b Commit scopes                                | `commitlint.config.js` (+ `Docs/CODING_STANDARDS.md` §2 list): add `hr`, `master-data`, `employees`, `attendance`                                                                                                                                                                                                  | shared tooling reviewer; **own PR** |
| 0c Any-scope permissions + team-scope proof     | `apps/api/src/common/decorators/require-permission.decorator.ts`, `apps/api/src/platform/roles-permissions/permissions.guard.ts`, `apps/api/src/common/tenancy/team-where.ts` (field-path option), new `apps/api/test/team-scope.e2e-spec.ts` (uses a temporary test controller or the first HR route), unit specs | `common/` + `platform/` reviewer    |
| 0d Event emitter                                | `apps/api/package.json` (+ lockfile) add `@nestjs/event-emitter`; `apps/api/src/app.module.ts` register `EventEmitterModule.forRoot()`                                                                                                                                                                             | dependency reviewer                 |
| 0e Audit platform (or record decision to defer) | `apps/api/src/platform/audit/{audit.module,audit.service,audit.interceptor}.ts`, `packages/database/prisma/schema.prisma` (`AuditLog`, `BigInt id`), migration                                                                                                                                                     | platform + migration reviewer       |
| 0f Permission-delivery decision implemented     | e.g. `packages/database/prisma/permissions.catalog.ts` + idempotent upsert used by `seed.ts` and a prod-safe entry point, or permission-inserting migrations                                                                                                                                                       | migration reviewer                  |
| 0g Docs corrections                             | `Docs/ARCHITECTURE.md` (bcrypt vs argon2, JWT payload, PK/timestamptz wording), `Docs/CODING_STANDARDS.md` if touched                                                                                                                                                                                              | docs owner                          |

### Phase 1 — Master data (trimmed, per `ARCHITECTURE.md` §8 step 4)

- `packages/database/prisma/schema.prisma`: `Designation`, `Shift` (+ migration).
- `apps/api/src/modules/master-data/designations/{designations.module,designations.controller,designations.service,designations.repository}.ts`, `dto/{create,update,query}-designation.dto.ts`, `designations.service.spec.ts`
- `apps/api/src/modules/master-data/departments/…` (API over the existing table)
- `apps/api/src/modules/master-data/shifts/…`
- `apps/api/src/app.module.ts` (import the modules), `packages/database/prisma/seed.ts` (permissions `master.*`, default shifts)
- `apps/api/test/master-data.e2e-spec.ts`; `packages/api-types/src/master-data.ts` (hand-written mirror), `packages/core/src/schemas/*` only when UI starts
- ESLint privacy zone regenerates automatically from folder names.

### Phase 2 — Employees, account mapping, permissions

- `packages/database/prisma/schema.prisma`: `Employee`, `EmployeeSensitiveInfo` (+ optional `Status`/`DocumentSequence` per D-01/D-02), constraints via raw SQL in the migration; relations added to `User`, `Team`, `Department`, `Designation`.
- `apps/api/src/modules/hr/employees/{employees.module,employees.controller,employees.service,employees.repository}.ts`, `employee-account.service.ts`, `employee-query.service.ts` (exported), `dto/*`, `events/employee.*.event.ts`, specs.
- Platform additions (reviewed): `apps/api/src/platform/users/users.service.ts` + write methods on `users.repository.ts` for account creation/deactivation; role assignment through the existing roles/permissions module APIs (service, not repository).
- Seed: `hr.employee.read|write.{own,team,all}`, `hr.employee_sensitive.read.all`, `employee_self_service.employee.read`; roles "HR Manager", "Team Lead", "Employee" (dev seed) and the prod mechanism from 0f.
- Tests: `apps/api/test/hr-employees.e2e-spec.ts`, `apps/api/test/hr-employee-account.e2e-spec.ts`, `apps/api/test/hr-employees-constraints.e2e-spec.ts`.
- `packages/api-types/src/hr-employees.ts`; docs (`ARCHITECTURE.md` §5.6 inventory).

### Phase 3 — Shift assignments

- Schema: `EmployeeShiftAssignment` (+ raw-SQL exclusion constraint, `btree_gist`).
- `apps/api/src/modules/hr/shift-assignments/…`, `shift-query.service.ts` (exported), events, tests `hr-shift-assignments.e2e-spec.ts`.

### Phase 4 — HR calendar (per D-08)

- Schema: `Holiday`, `HolidayDepartment`, `WeeklyOffRule`; `apps/api/src/modules/hr/holidays/…`, `apps/api/src/modules/hr/weekly-off-rules/…`; tests.

### Phase 5 — Self-service read surface

- `apps/api/src/modules/employee-self-service/profile/…` (`employee_self_service.*` permissions, resolves employee from JWT user via `EmployeeQueryService`).

### Phase 6 — Leave foundation (needed before Attendance can integrate leave)

- Schema: `LeaveType`, `LeaveRequest`, `LeaveBalance`; `apps/api/src/modules/hr/leave-types/…`, `hr/leave-requests/…`; events `leave.request.approved|cancelled`; approval flow (maker/approver rules) — separate design pass.

### Out of this plan

UI screens (roles feature is the only UI precedent), payroll, recruitment, tickets, mobile.

---

## 11. Attendance dependency plan (future) [Recommendation]

What Attendance (see the companion blueprint) needs from HR, and where each item comes from:

| Attendance need                                                                                                | Provided by                                                                                     | Must exist first   |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| Who is checking in (JWT user → employee)                                                                       | `EmployeeQueryService.findByUserId()`                                                           | Phase 2            |
| Employee id as FK on records/sessions                                                                          | `employees.id` (Int)                                                                            | Phase 2            |
| Active/joining/exit window (no rows outside it; auto-exit)                                                     | `employees.status`, `date_of_joining`, `date_of_exit` + `employee.status_changed/exited` events | Phase 2            |
| Team/department for scoping reports & approvals                                                                | `employees.team_id/department_id`; `teamWhere` field-path option                                | Phase 0c, 2        |
| Shift target, window, grace, overnight for working-hours, late, overtime, half/full day, auto-checkout cut-off | `shifts` + `employee_shift_assignments` via `ShiftQueryService.shiftFor(employeeId, date)`      | Phase 1, 3         |
| Weekly off / holiday resolution                                                                                | HR calendar (`weekly_off_rules`, `holidays`) via a query service                                | Phase 4 (D-08)     |
| Approved leave days (leave integration) and events                                                             | `LeaveQueryService` + `leave.request.*` events                                                  | Phase 6            |
| Correction/approval permissions (`hr.attendance.*`, `.attendance_regularization.*`, month approval)            | seed + any-scope decorator + team scope                                                         | Phase 0c           |
| Audit trail for corrections                                                                                    | `platform/audit`                                                                                | Phase 0e           |
| Scheduler for auto-checkout / roll-up / alerts                                                                 | `@nestjs/schedule` or BullMQ (D-11)                                                             | Attendance kickoff |
| Monthly summaries and payroll hand-off                                                                         | Attendance-owned `attendance_month_summaries`; payroll module consumes                          | after Attendance   |
| Concurrency/constraints (one open session, no overlap)                                                         | raw-SQL migration support — **already verified compatible with the CI drift check** (§3.7)      | none               |
| Timestamps with time zone                                                                                      | `@db.Timestamptz(6)` on attendance columns (repo default is `TIMESTAMP(3)`)                     | decision D-12      |

HR design choices that keep Attendance simple: immutable `employee_code` + surrogate id; `employees.user_id` nullable-unique; date-effective shift assignments (never a single "current shift" column); status + dates rather than deleting exited employees; events for team/status/shift changes so attendance can lock or re-evaluate future days.

---

## 12. Risks, unresolved decisions and recommendations

### 12.1 Risks

| ID   | Risk                                                                                                                                                    | Mitigation                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R-1  | Migration drift check likely red on `main` (§3.4)                                                                                                       | Phase 0a first; confirm CI history                                                                               |
| R-2  | Team-scope code is unproven (G-2); HR is its first user; a mistake leaks data across teams                                                              | Negative e2e tests before any HR business logic; keep repository methods `@TeamScoped()` with scope as first arg |
| R-3  | `@RequirePermission` limitation (G-1) tempts workarounds (granting all three variants to a role)                                                        | Fix the platform properly (0c)                                                                                   |
| R-4  | Permission rows not deliverable to production (B-4)                                                                                                     | Decide and implement 0f before the first HR permission                                                           |
| R-5  | Employee account provisioning without password-reset/notification (G-5/G-6) — initial-credential handling is a security-sensitive design                | Decide D-05 explicitly; do not invent ad-hoc password emailing                                                   |
| R-6  | Docs inconsistent with code (argon2/JWT/PK/timestamps) — new contributors follow the wrong one                                                          | Fix docs alongside first touching PR                                                                             |
| R-7  | e2e tests share dev Redis/DB (§3.5) — cache-key collisions and data mixing                                                                              | Use a separate DB and Redis index for tests; document it                                                         |
| R-8  | `TIMESTAMP(3)` without tz vs docs' `timestamptz`                                                                                                        | Decide D-12 before creating time-critical tables                                                                 |
| R-9  | Sensitive PII and reads of it require audit; audit platform absent                                                                                      | 0e before sensitive-info endpoints                                                                               |
| R-10 | ESLint module-privacy rule works on top-level folders only: sub-features inside `modules/hr/` can import each other's repositories without lint failure | Review discipline; consider tightening the rule (shared config ⇒ review)                                         |
| R-11 | Business logic depends on unmade product decisions (probation, notice, employment types, org chart rules)                                               | Collect answers before Phase 2 schema is frozen                                                                  |

### 12.2 Decisions required (with recommended defaults)

| ID   | Decision                                                                                             | Recommended default                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | `employee_code` scheme and generator (`document_sequences` table vs a Postgres sequence vs app-side) | `document_sequences` per docs, prefix `EMP`, 4-digit padding; generated in the create transaction                                                                      |
| D-02 | Employment status model (`statuses` lookup + history vs `text`+`CHECK`)                              | Lookup + `status_history` if you want to honour the docs; otherwise `text`+`CHECK` with an ADR                                                                         |
| D-03 | Which HR PII fields exist and who can read them                                                      | separate `employee_sensitive_info`, `.all`-only                                                                                                                        |
| D-04 | How permissions/roles reach staging & production                                                     | idempotent catalogue upsert run as a deploy step                                                                                                                       |
| D-05 | Initial credential/invite flow for new employee accounts                                             | invite token via a notification channel (needs `platform/notifications`); until then, admin-set temporary password with forced change (needs change-password endpoint) |
| D-06 | Source of truth for team membership                                                                  | `employees.team_id`; `user_team_access` derived by the service                                                                                                         |
| D-07 | May team leads create/edit employees in their team (`.team`) or read-only?                           | read-only; HR/Admin write                                                                                                                                              |
| D-08 | Who owns holidays/weekly-off rules (HR vs Attendance)                                                | HR (calendar master), attendance consumes                                                                                                                              |
| D-09 | Build `platform/audit` before HR, or defer                                                           | before (mandated for HR/payroll)                                                                                                                                       |
| D-10 | Optimistic locking (`version`) on employee updates                                                   | yes                                                                                                                                                                    |
| D-11 | Scheduler for Attendance: BullMQ vs `@nestjs/schedule`                                               | BullMQ (Redis already present) with a Postgres advisory lock as a second guard                                                                                         |
| D-12 | Timestamp type for new tables                                                                        | `timestamptz` (`@db.Timestamptz(6)`) for anything time-critical; ADR to align the baseline                                                                             |
| D-13 | Who owns `employees`/`shifts`/Leave delivery order and timelines                                     | needs a named owner (CODEOWNERS is a placeholder single account)                                                                                                       |
| D-14 | Employment types, probation/notice rules, reporting-line rules                                       | to be provided by HR                                                                                                                                                   |

### 12.3 Recommendation summary

1. Start with **Phase 0** (0a drift fix, 0b commit scopes, 0c permission/team-scope proof, 0d events, then 0e/0f), because HR is the first consumer of several unproven platform pieces.
2. Freeze §7's schema only after D-01/D-02/D-03/D-05 are answered.
3. Build Master Data (designations, shifts) → Employees + account mapping → shift assignments → HR calendar → self-service read → leave, each as its own reviewed PR with e2e tests, matching the repo's conventions.
4. Reuse the tested attendance DDL and concurrency findings when Attendance starts; nothing in the HR design blocks them.

---

**Stopping here.** No HR or Attendance code, schema, migration, dependency or configuration has been written. Awaiting approval and answers to §12.2 before implementation.
