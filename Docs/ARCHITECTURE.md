# TexaWave ERP — System Architecture & Build Guide

**Stack:** Next.js (ui) + NestJS (api) + PostgreSQL, single monorepo, mobile-ready
**Status:** Foundation complete and live-verified — auth (login/refresh/logout, JWT + Redis), tenancy (CLS-based org scoping, `@OrgScoped()`), RBAC (permissions cached in Redis, `PermissionsGuard`), the platform/common/shared split (§3), the frontend structure (§4), and one full reference feature (backend `apps/api/src/modules/_reference/tags/` + frontend `apps/ui/src/features/_reference/tags/`) all exist, are tested (unit + e2e, backend and browser), and were exercised against a real Postgres/Redis and a real browser, not just typechecked. What's explicitly **not** done: Postgres Row-Level Security (§6 point 3 — CLS-based scoping is the implemented first line of defense; RLS is documented future hardening), signup/password-reset flows (business-facing, out of scope), server-verified auth via an httpOnly-cookie BFF (tokens are currently in-memory client-side only — see `Docs/CODING_STANDARDS.md` §13), and business modules (§5.5 Sales/Purchases/Finance/etc. — not started, out of scope for this work).
**Scope:** internal-only, single-organization application for Texawave Innovations (teams: Software, Mechanical, Electrical). HR + Team Management is the active build priority. Sales/Purchases/Finance/Inventory/Vault/Projects remain in this doc's module list and data model — they are **paused, not dropped** — because Texawave has real plans to use them later; don't remove their tables/folders when doing HR work, just don't build them yet.
**Owner:** repository maintainers — assign a named owner/team before business-module work begins.
**Last verified:** 2026-09-18, against the actual repository state (not assumed from prior doc revisions).
**Canonical for:** system/package ownership, dependency direction, backend/frontend boundaries, data model. Coding patterns live in `Docs/CODING_STANDARDS.md`; design tokens/components live in `Docs/DESIGN_SYSTEM.md`. Do not duplicate long rules across these three docs — link instead.

---

## 1. Architectural Decisions

| Decision                       | Choice                                                                                                                                                                                                                         | Why                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo strategy                  | **Monorepo** (pnpm workspaces + Turborepo)                                                                                                                                                                                     | ui, api, mobile, and shared types live together; one PR touches a DTO and both consumers atomically                                                                                                                                                                                                                                                             |
| Backend                        | **NestJS, modular monolith** (not microservices)                                                                                                                                                                               | Small team. Microservices now = distributed-systems tax with no payoff. Clean module boundaries let you peel one off later if you ever need to                                                                                                                                                                                                                  |
| ORM                            | **Prisma**                                                                                                                                                                                                                     | Fast to model, generates types shared with the API layer, solid migration story                                                                                                                                                                                                                                                                                 |
| DB                             | **PostgreSQL**, single schema, `organization_id` on every tenant table                                                                                                                                                         | Kept for schema consistency and to avoid a future migration if scope ever expands — but see Multi-tenancy row, it's a constant here, not a live dimension                                                                                                                                                                                                       |
| Multi-tenancy                  | **Single organization, internal use only.** One `organizations` row (Texawave Innovations), seeded once, never referenced by an org switcher or UI. `organization_id` stays on every table but is a constant, not RLS-relevant | This app is not sold to external clients — it's Texawave's own internal HR/Team Management system. Postgres RLS on `organization_id` is not worth building for a single-row table; skip it. **If this ever changes** (TexaWave becomes multi-client again), the column is already there — that's the one piece of the old multi-tenant design deliberately kept |
| Teams (replaces "multi-plant") | **Built.** `teams` table (Software/Mechanical/Electrical), `employees.team_id`, `user_team_access` (user↔team, `is_lead`)                                                                                                      | This is where the real access boundary lives now — team leads see their own team, HR/Admin see all. See §7A                                                                                                                                                                                                                                                     |
| Primary keys                   | **Auto-incrementing integer (`bigint GENERATED ALWAYS AS IDENTITY`)**, not UUID                                                                                                                                                | Simpler to read/debug, smaller index footprint, faster joins than UUID v4 at this scale. Internal-only app with no public-facing IDs in URLs means the usual "sequential IDs are guessable" objection doesn't apply here — see §5.1 for the one place to still use a non-sequential value (document-facing codes via `document_sequences`, unrelated to the PK) |
| AuthN                          | JWT (access + refresh), Passport strategies, refresh tokens in **Redis** (`refresh:{userId}:{jti}`)                                                                                                                            | Stateless, works for web + future mobile; O(1) revocation, tokens expire via Redis TTL instead of a cleanup job                                                                                                                                                                                                                                                 |
| AuthZ                          | **RBAC**: User → Role → Permission, checked via a NestJS Guard + decorator (`@RequirePermission('sales.invoice.create')`)                                                                                                      | Extensible — new modules just register new permission strings, no schema change                                                                                                                                                                                                                                                                                 |
| Extensibility pattern          | Every domain table: `id (uuid)`, `organization_id`, `custom_fields jsonb`, `created_at/updated_at/created_by/updated_by`, `deleted_at` (soft delete), status via a `statuses` lookup table, not a hardcoded enum               | The single biggest lever for "won't need to rebuild when a client asks for a feature" — see §5                                                                                                                                                                                                                                                                  |
| API style                      | REST (NestJS controllers) + OpenAPI (Swagger) auto-generated, not GraphQL                                                                                                                                                      | Simpler for a CRUD-and-workflow-heavy ERP; `packages/api-types` generated from OpenAPI keeps ui/api in sync                                                                                                                                                                                                                                                     |
| Frontend framework             | Next.js App Router                                                                                                                                                                                                             | SSR for dashboards/reports, route groups map to modules, desktop-first (mobile web is out of scope — native mobile comes later via Expo)                                                                                                                                                                                                                        |
| State/data-fetching            | TanStack Query (server cache) + Zustand (light client/UI state)                                                                                                                                                                | Query handles "ERP is mostly server data"; avoids Redux boilerplate                                                                                                                                                                                                                                                                                             |
| Mobile (future)                | **Expo (React Native)** in `apps/mobile`, sharing `packages/core`                                                                                                                                                              | Scaffolded now, built later — keeps `packages/core` API-agnostic from day one instead of accidentally React-DOM-only                                                                                                                                                                                                                                            |
| Design system                  | `packages/ui-kit/src/theme.css`, Tailwind v4 CSS-first tokens                                                                                                                                                                  | Already in place from Phase 0 — see §6 for the one addition Texa needs beyond a static theme (per-org theming)                                                                                                                                                                                                                                                  |

---

## 2. Monorepo Folder Structure (top level)

```
texawave-erp/
├── apps/
│   ├── api/                     # NestJS backend
│   ├── ui/                      # Next.js frontend (web, desktop-first)
│   └── mobile/                  # Expo scaffold — untouched until mobile work starts
├── packages/
│   ├── core/                    # framework-agnostic business logic, API client, validation (zod)
│   ├── api-types/                # generated OpenAPI TS types + DTOs shared by ui/mobile
│   ├── ui-kit/                   # shared design-system components + theme.css
│   ├── config/                   # shared eslint, tsconfig, tailwind, prettier configs
│   └── database/                 # Prisma schema, migrations, seed scripts
├── deployment/                    # CI plumbing only (CodeBuild/IAM per app)
├── Docs/                          # this file + CODING_STANDARDS.md + DESIGN_SYSTEM.md
├── .github/workflows/
├── docker-compose.yml              # Postgres 16 + Redis 7
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

`packages/database` (Prisma schema) is the single source of truth for the data model.

**`packages/api-types` — current vs. target state.** Target: generated from the NestJS OpenAPI document, never hand-written, so `ui`/`mobile` and `api` cannot silently drift. Current (as of this foundation work): there is no generation pipeline yet — Swagger/OpenAPI is emitted by the API (§ backend foundation) but nothing consumes it into `packages/api-types`. Until that pipeline exists, `packages/api-types` contains **hand-written** wire-contract types for the reference feature only, each file carrying a `// HANDWRITTEN — see packages/api-types/README.md` comment. Do not describe generation as active until a real `openapi-typescript` (or equivalent) script exists in `packages/api-types/package.json` and runs in CI; when it does, delete the hand-written files it replaces in the same PR.

`packages/core` holds logic both web and mobile need so business rules are never implemented twice.

**Browser/E2E testing:** Playwright, run from `apps/ui` (`pnpm --filter ui test:e2e`). Neither Cypress nor Playwright was previously wired up in this repo; Playwright is adopted here as the single browser-test runner — do not add Cypress alongside it without a documented reason two runners are both needed.

---

## 3. Backend — `apps/api/` (NestJS)

One Nest module per business capability, grouped into `platform/` (cross-cutting) and `modules/` (the business modules).

```
apps/api/src/
├── main.ts
├── app.module.ts
│
├── platform/
│   ├── auth/                    # auth.module/controller/service, strategies/, guards/, decorators/
│   ├── organizations/           # tenant CRUD, org settings, theme settings (§6)
│   ├── users/
│   ├── roles-permissions/
│   ├── audit/                   # AuditInterceptor + audit_logs writer, read-only query API
│   ├── tenancy/                 # TenantContext (ClsService), org-scoping interceptor
│   ├── documents-vault/         # Vault module: storage abstraction, access grants, approvals
│   └── notifications/           # email/SMS/push abstraction
│
├── modules/                     # the business modules — ACTIVE first, then paused (kept, not removed)
│   ├── teams/                    # ★ ACTIVE — teams, user-team-access
│   ├── hr/                        # ★ ACTIVE — employees, attendance, leaves, payroll, recruitment,
│   │                              #   exit-requests, tickets, org-chart
│   ├── employee-self-service/     # ★ ACTIVE — employee-portal: check-in/out, leave/timesheet/payslip self-service
│   ├── settings/                  # ★ ACTIVE — access-control browser, privilege manager
│   ├── master-data/             # PAUSED — items, item-categories, uom, warehouses, chart-of-accounts,
│   │                             #   hr-structures (departments/designations/shifts), sales-terms, tax-codes.
│   │                             #   Trim to only what HR needs (departments/designations/shifts) for now;
│   │                             #   the rest stays defined but unbuilt.
│   ├── sales/                   # PAUSED — leads, quotations, sales-orders, customers, invoices,
│   │                             #   delivery-challans, recurring/credit invoices, payments
│   ├── purchases/                # PAUSED — purchase-orders, vendor-bills, vendors
│   ├── finance/                  # PAUSED — journals, banking, expenses, financial-reports
│   ├── inventory/                 # PAUSED — stock-ledger (append-only), stock-adjustments, stock-transfers
│   ├── projects/                  # PAUSED — projects, project-members, tasks, project-reports
│   └── vault/                     # PAUSED — documents, document-folders, document-access-grants
│                                  #   (still wanted for the future; platform/documents-vault below stays
│                                  #   as the platform-level storage abstraction it plugs into)
│
├── common/                      # request-pipeline framework primitives (filters, interceptors,
│                                 # decorators, dto, logger, exceptions, constants, tenancy context)
├── shared/                      # injectable infra providers used by 2+ modules (PrismaService,
│                                 # Redis client, email adapter) — see CODING_STANDARDS.md §3
└── config/                      # env validation (zod), typed config service
```

### One module's internal shape (repeat this pattern everywhere)

```
sales-orders/
├── sales-orders.module.ts
├── sales-orders.controller.ts
├── sales-orders.controller.spec.ts
├── sales-orders.service.ts
├── sales-orders.service.spec.ts
├── sales-orders.repository.ts       # Prisma calls isolated here, not in service
├── dto/
│   ├── create-sales-order.dto.ts
│   ├── update-sales-order.dto.ts
│   └── query-sales-order.dto.ts
├── entities/                        # only if response shape differs from the Prisma model
└── events/                          # sales-order.created.event.ts, etc.
```

**Controller → Service → Repository.** Service holds business rules. Repository is the _only_ place that talks to Prisma. Swapping ORMs, adding caching, or splitting a module into its own service later only touches the repository layer.

**Cross-module communication** goes through NestJS's `EventEmitter2` — never a direct import of another module's repository/service. E.g. `sales` emits `invoice.created`; `finance` listens and posts a journal entry. See CODING_STANDARDS.md §7 for the exact convention.

---

## 4. Frontend — `apps/ui/` (Next.js App Router)

Route groups map 1:1 to business modules.

```
apps/ui/src/
├── app/
│   ├── (auth)/                       # login, forgot-password
│   ├── (dashboard)/                  # authenticated shell: sidebar, no org context (single org)
│   │   ├── teams/                    # ACTIVE
│   │   ├── hr/                       # ACTIVE
│   │   ├── audit/                    # ACTIVE
│   │   ├── admin/                    # ACTIVE — users/roles/permissions
│   │   ├── master-data/              # PAUSED
│   │   ├── sales/                    # PAUSED
│   │   ├── purchases/                # PAUSED
│   │   ├── finance/                  # PAUSED
│   │   ├── inventory/                # PAUSED
│   │   ├── projects/                 # PAUSED
│   │   └── vault/                    # PAUSED
│   ├── (employee-portal)/            # separate route group + separate permission namespace —
│   │                                  # not nested under (dashboard), see §7
│   └── layout.tsx
│
├── features/                         # feature-sliced logic, mirrors app/ modules
│   └── <module>/<sub-module>/
│       ├── components/               # e.g. InvoiceTable, InvoiceForm, StatusBadge
│       ├── hooks/                    # useInvoices(), useCreateInvoice()
│       ├── api.ts                    # calls packages/core api client
│       └── schema.ts                 # zod form schema
│
├── components/                       # truly generic, app-wide (not from ui-kit)
├── lib/                               # api client instance, query-client
├── stores/                            # zustand stores (sidebar open, auth)
├── hooks/                             # generic hooks (useDebounce, usePermission)
└── middleware.ts                      # route-level auth + permission gating
```

`app/` is routing only. `features/<module>/` is where all real code lives — the page file in `app/` is a thin composition layer. This is the same shape `apps/mobile` will mirror once mobile work starts.

---

## 5. Data Model — designed for extensibility

### 5.1 Every table gets this baseline

**Primary keys are auto-incrementing integers, not UUIDs.**

```sql
id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
organization_id  bigint NOT NULL REFERENCES organizations(id),   -- constant single row, kept for schema consistency
custom_fields    jsonb NOT NULL DEFAULT '{}',
created_by       bigint REFERENCES users(id),
updated_by       bigint REFERENCES users(id),
created_at       timestamptz NOT NULL DEFAULT now(),
updated_at       timestamptz NOT NULL DEFAULT now(),
deleted_at       timestamptz            -- soft delete, never hard-delete business records
```

In Prisma: `id Int @id @default(autoincrement())` (or `BigInt` — see the note below on which one). All foreign keys across the schema follow the same type as the table they reference — never mix `Int`/`BigInt` FK types with the PK they point to.

**`Int` vs `BigInt`:** use `Int` (`autoincrement()`, 32-bit, max ~2.1 billion) for every table except `audit_logs` and `status_history`, which use `BigInt` — those two grow unbounded with every mutating request across the app's lifetime and are the only tables realistically at risk of exceeding a 32-bit range over years of operation. Don't default every table to `BigInt` "to be safe" — it doubles storage/index size for no benefit on a table with a few thousand rows.

**Why integer IDs are fine here, deliberately:** the usual objection to sequential PKs — "an attacker can enumerate `/invoices/1`, `/invoices/2`, ..." — assumes IDs are exposed in a public-facing API. This app has no public/external surface; every route sits behind auth + permission checks, and `id` is never used as a public reference number anyone types in or shares (that's what `document_sequences`-generated codes are for, e.g. an employee code or a payslip number — those stay human-readable strings, unrelated to the PK, and are the right place for a "looks sequential to a user" concern if one ever comes up). If this app ever grows a public-facing surface, revisit this — don't quietly reuse internal IDs as public identifiers at that point.

Reserve real columns for fields you query/filter/join on; put "nice to have" fields in `custom_fields`.

### 5.2 Status is a table, not an enum

```sql
statuses (id, module VARCHAR, code VARCHAR, label VARCHAR, sort_order INT, is_terminal BOOLEAN, color_token VARCHAR)
-- color_token is one of the semantic design tokens (Docs/DESIGN_SYSTEM.md): success | warning | error | brand | gray
```

Reference `status_id` on the record. New status = a data insert, not a schema change + deploy. Pair with `status_history` (§5.4) for every module with a workflow.

### 5.3 Numbering as configuration

```sql
document_sequences (id, organization_id, doc_type VARCHAR, prefix VARCHAR, next_number INT, format VARCHAR)
-- doc_type: 'quotation' | 'sales_order' | 'invoice' | 'purchase_order' | 'dc' | ...
```

### 5.4 Reusable cross-module tables (build once, every module plugs in)

```sql
status_history   (id, org_id, entity_type, entity_id, from_status_id, to_status_id, changed_by, changed_at, remarks)
attachments       (id, org_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at)
approvals         (id, org_id, entity_type, entity_id, workflow_id, step, approver_id, decision, decided_at)
audit_logs        (id, org_id, actor_id, entity_type, entity_id, action, before jsonb, after jsonb, ip, at)
comments          (id, org_id, entity_type, entity_id, author_id, body, created_at)
```

`entity_type + entity_id` is a polymorphic reference. When module #12 shows up next year, it gets status history, attachments, approvals, comments, audit logging for free — zero new tables.

### 5.5 Teams model

```sql
teams (id, organization_id, name, code, lead_user_id, ...baseline)
-- rows: Software, Mechanical, Electrical

user_team_access (id, user_id, team_id, is_lead boolean, ...baseline)
-- most users: one row, their own team, is_lead=false
-- a team lead: one row, their team, is_lead=true
-- HR/Admin: no rows needed — see permission scoping below, they bypass the filter entirely

employees (
  ...,
  team_id        bigint NOT NULL REFERENCES teams(id),
  reports_to_id  bigint REFERENCES employees(id),   -- org-chart line, deliberately separate from team_id
  ...baseline
)
```

**Permission scope suffixes**, instead of one permission string per team (which multiplies the catalog by 3 for no reason and gets worse with every new team):

- `hr.employee.read.own` — every employee, sees their own record only
- `hr.employee.read.team` — team leads, filtered via `user_team_access`
- `hr.employee.read.all` — HR/Admin, no filter

Same suffix pattern applies to `hr.attendance.*`, `hr.leave.approve.*`, `hr.payroll.*`. A `TeamScopeGuard` (same shape as `@OrgScoped()` in CODING_STANDARDS.md §10, one level down) resolves which of the three a caller's role holds and applies the matching filter in the repository — mirrors the existing tenancy pattern exactly, nothing new to teach the team.

### 5.6 Table inventory by module

**Platform** — `organizations` (single row), `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `teams`, `user_team_access`, `statuses`, `document_sequences`, `audit_logs`, `status_history`, `attachments`, `approvals`, `approval_workflows`, `approval_steps`, `comments`

**Master Data** — `items`, `item_categories`, `units_of_measure`, `warehouses`, `chart_of_accounts`, `finance_heads`, `departments`, `designations`, `shifts`, `sales_terms`, `tax_codes`

**Sales** — `customers`, `customer_contacts`, `leads`, `quotations`, `quotation_lines`, `sales_orders`, `sales_order_lines`, `invoices`, `invoice_lines`, `delivery_challans`, `dc_lines`

**Purchases** — `vendors`, `purchase_orders`, `purchase_order_lines`, `vendor_bills`, `vendor_bill_lines`

**Finance** — `journal_entries`, `journal_lines`, `bank_accounts`, `bank_transactions`, `expenses`, `currency_rates`. `invoices` lives in Sales but _posts_ a `journal_entry` — never duplicate the invoice table here, reference it.

**Inventory** — `stock_ledger` (append-only: every receipt/issue/transfer/adjustment — the single source of truth; never `UPDATE` a quantity, insert a movement row, current stock = `SUM(quantity_delta)`), `stock_adjustments`, `stock_transfers`. No `boms`/`routings` — nothing in scope consumes them.

**Projects** — `projects`, `project_members`, `tasks` (`parent_task_id` for subtasks, `assignee_id`, `status_id`, `due_date`), `project_reports`. `task_comments` reuses the generic `comments` table (`entity_type='task'`).

**HR** — `employees`, `attendance_records` (+ `check_in_location point`, `check_in_face_match_score`, `check_in_method` via `statuses`), `leave_types`, `leave_requests`, `payroll_runs`, `payslips`, `pf_esi_records`, `bonuses`, `tickets`

**Vault** — `documents`, `document_folders`, `document_access_grants` (+ `encryption_key_ref`, `iso_format_version`), reuses `approvals`/`approval_workflows` from platform

**Audit** — no new tables; a read-only query surface over `audit_logs` + `status_history`, populated by a global `AuditInterceptor`.

### 5.7 Theming

**Dropped, not paused.** `organization_theme_settings` (runtime per-org brand overrides) only made sense when many client organizations shared one deployment. With a single internal org, theming is a compile-time constant in `packages/ui-kit/src/theme.css`, same as any normal single-tenant app — no table, no runtime resolution. If a public-facing multi-client product is ever spun up separately, that's a new decision made then, not a dormant table kept "just in case" here.

### 5.8 Relationship spine (how a lead becomes an invoiced, ledgered, reported job)

```
lead → quotation → sales_order ──┬─→ invoice → journal_entry (Finance)
                                   └─→ delivery_challan
```

Every arrow is a foreign key, not a copy of data.

---

## 6. Multi-Tenancy & RBAC enforcement (concretely)

1. **JWT payload** carries `userId`, `organizationId` (constant), `teamId`, `roleIds`.
2. **`TenancyInterceptor`** populates the CLS context from the JWT — kept for schema/pattern consistency even though `organizationId` never varies today.
3. **`TeamScopeGuard`**, the actual access boundary now: resolves whether the caller's permission set is `.own`/`.team`/`.all`-scoped (§5.5) and filters the repository query accordingly via `user_team_access`. Postgres RLS is **not built** — with a single organization there's no cross-tenant leak to defend against at the DB layer; team-scoping is application-layer only, same rigor as the old `@OrgScoped()` pattern but one level down.
4. **Permissions**: seed strings like `hr.employee.read.team`, `hr.payroll.read.all`. `role_permissions` maps roles to these. `@RequirePermission('hr.employee.read.team')` decorator + guard checks the JWT's resolved permission set (computed at login, cached in Redis, invalidated on role change).
5. **New module later** = new permission strings, seeded against relevant roles. No schema change to `organizations`, `roles`/`permissions`/`role_permissions`, or the tenancy layer required.

---

## 7. Employee Self-Service — a separate surface, not a sub-page

The old app had a self-service portal (GPS check-in/out, payslips, leaves, tickets) alongside the admin HR module. Keep that separation explicit here:

- Own route group: `(employee-portal)`, not nested under `(dashboard)`.
- Own permission namespace: `employee_self_service.*`, distinct from `hr.*`. An employee's JWT should not carry `hr.employee.read` just because they can see their own record.
- Mostly reuses HR's tables (`employees`, `attendance_records`, `leave_requests`, `payslips`) scoped down by permission + `WHERE employee.user_id = :currentUserId`, rather than new tables.

---

## 8. Build order (Phase 1 onward)

1. Prisma schema — platform layer (§5.6's Platform list + §5.1 baseline, with `bigint`/`Int` identity PKs) plus `teams`/`user_team_access`/`employees`. First migration, seed the single org + Software/Mechanical/Electrical teams + a Super Admin role.
2. `platform/auth` end-to-end (login, refresh, password reset), argon2, JWT + Redis refresh, `platform/tenancy`.
3. RBAC + team-scope skeleton — seed roles/permissions with the `.own`/`.team`/`.all` suffix pattern, `PermissionsGuard` + `@RequirePermission()`, `TeamScopeGuard`. Prove both on one dummy protected route — including a negative test (a team-lead-scoped user correctly denied/filtered on another team's data), not just that login works.
4. Master Data, trimmed to what HR needs now (`departments`, `designations`, `shifts`, `leave_types`) — the rest of Master Data's table list stays documented for when Sales/Purchases/Finance resume, not built yet.
5. HR module, full stack: employees, attendance, leaves, payroll, payslips.
6. Employee Self-Service (depends on HR).
7. **Paused, revisit later, in no particular order once resumed:** Sales, Purchases, Finance, Inventory, Projects, Vault. Their tables and module folders stay defined in this doc so resuming one is "build the folder," not "redesign it."
8. Hardening — rate limiting, e2e suite, CI/CD to staging/prod. (RLS is out of scope per §6 point 3 — single org, nothing to isolate at the DB layer.)

**Ongoing:** every new module going forward = a folder in `modules/`, a slice in `features/`, tables following §5.1–5.4, and permission strings. No changes to `organizations`, `users`, `roles`, `teams`, `audit_logs`, or the tenancy layer required — that's the test of whether the architecture held.

---

## 9. Local environment

```bash
cp .env.example .env                      # then fill in JWT_SECRET at minimum
docker compose up -d postgres redis       # matches the DATABASE_URL/REDIS_URL in .env.example
pnpm install --frozen-lockfile
pnpm --filter database exec prisma migrate deploy   # or migrate:dev while iterating on the schema
pnpm --filter database seed                # creates the single "Texawave Innovations" org, three teams
                                            # (Software/Mechanical/Electrical), and a Super Admin user —
                                            # see the seed script for the actual dev credentials, LOCAL DEV ONLY
pnpm --filter api start:dev                # NestJS on :3000 (nest-cli.json uses the swc builder — see below)
pnpm --filter ui dev                       # Next.js on :3000 too by default; pass -p if you need to change it
```

Then `apps/ui`'s `NEXT_PUBLIC_API_URL` (see `.env.example`) must point at wherever `apps/api` is actually listening, and `apps/api`'s `CORS_ORIGIN` must match wherever `apps/ui` is actually listening — the two default ports collide (both default to 3000), so run one of them on a different port explicitly (e.g. `pnpm --filter ui dev -- -p 3001`) and keep both env vars in sync with whatever you chose.

**If `docker compose up` fails with a port already in use:** something else on your machine already has 5432 or 6379 — a system-wide Postgres/Redis install, or another project's containers. Don't stop an unrelated container to free the port; instead run this repo's Postgres/Redis on different host ports (edit the `ports:` mapping in `docker-compose.yml` locally, don't commit that) and update `DATABASE_URL`/`REDIS_URL` in your own `.env` to match.

**Why `apps/api`'s `nest-cli.json` specifies `"builder": "swc"`:** plain `tsc`-then-`node` (the default) fails at runtime with `ERR_UNKNOWN_FILE_EXTENSION` on `packages/database`'s workspace import, because Node's ESM loader can't resolve a `.js`-extension import to a same-named `.ts` file without a transpiling loader in front of it. SWC produces real runtime-loadable output; don't remove the `builder: "swc"` line to "simplify" the config without re-verifying `node dist/main.js` still boots.

**Why `packages/database`'s Prisma generator is `"prisma-client-js"`, not the newer `"prisma-client"`:** the newer generator emits raw `.ts` with no build step of its own, which only a TS-aware runtime (tsx/vitest) can load — the classic generator emits ready-to-run compiled JS, which every consumer in this repo (vitest, the swc-built API, plain `node`) can load uniformly. If you ever change this, re-run `pnpm --filter database build` and re-verify `node apps/api/dist/main.js` actually boots, not just that it typechecks.

---

## 10. Hard-won rules, stated explicitly

- **Never delete business records.** Soft-delete (`deleted_at`) everywhere.
- **`stock_ledger` is append-only.** Never `UPDATE` a quantity — insert a movement row.
- **One migration tool, one direction.** All schema changes through Prisma Migrate, committed to `packages/database/prisma/migrations`, never hand-edited in prod.
- **Don't build microservices to feel "production level."** A modular monolith with clean module/event boundaries is the correct architecture for this team size.
- **No plaintext credentials, ever, anywhere** — this is the single most important thing this rebuild fixes relative to the old app.
- **Payslip/salary reads get audit-logged, not just writes.** `hr.payroll.read.*` is exactly the kind of access that gets scrutinized after the fact — log the read, not only the mutation.
- **PII (Aadhar/PAN/bank account) gets real, narrowly-permissioned columns or its own table** (`employee_sensitive_info`, gated by `hr.employee_sensitive.read.all` only) — never `custom_fields`. Compliance review looks for exactly this separation.
- **GPS/attendance raw location data is the one deliberate exception to "never hard-delete."** State a retention window for raw check-in coordinates (derive attendance status, then age the raw trail out) rather than keeping it indefinitely by the same rule that governs business records.
