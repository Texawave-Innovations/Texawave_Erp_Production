# Projects Master Lists — project-code configuration, not the project registry

**Status:** This is the legacy ERP's "Projects Master Lists" screen — three
sub-masters that configure _how project and task codes are generated_, not a
registry of actual project records (budget/department/manager/status/dates).
A full Project entity with those fields is a separate, not-yet-built module
(Sales/Purchases/Finance/Inventory/Vault/Projects "paused, not removed" per
`CLAUDE.md`).

**Owner:** repository maintainers — assign a named owner before further
Projects-module work begins.

This mirrors `Docs/FINANCE_MASTER_LIST.md`'s shape (controller → service →
repository, one Nest module, hand-written `packages/api-types` mirror) for
tab 1, and `Docs/SALES_SETTINGS_FOUNDATION.md`'s `DocumentNumbering`
singleton-per-org-config pattern for tabs 2 and 3 — read those docs if
something here is underspecified.

## The three tabs

1. **Project Master** — the project type/category registry (code, name,
   description — e.g. `ME` "Mechanical Engineering", `SW` "Software"). This
   is the only tab with multiple rows per org.
2. **Project Code Master** — one row per org, configures
   `[Company Prefix]/[Module Identifier]/[Project Code]/[Financial Year]/[Sequence]`
   (e.g. `TXW/PRJ/ME/26-27/001`). Format only — it does not allocate or
   track actual sequence numbers.
3. **Task Running Number Master** — one row per org, configures
   `[Project Code][Separator][Task Prefix][Sequence]`, appended to the
   generated project code (e.g. `TXW/PRJ/ME/26-27/001-T01`). Format only,
   same scope limit as tab 2.

## Where the code lives

```
apps/api/src/modules/projects-master/
  projects-master.module.ts
  projects-master.{controller,service,repository}.ts            — tab 1
  project-code-master.{controller,service,repository}.ts        — tab 2
  task-running-number-master.{controller,service,repository}.ts — tab 3
  projects-master.service.spec.ts
  dto/{create,update,query}-projects-master.dto.ts
  dto/update-project-code-master.dto.ts
  dto/update-task-running-number-master.dto.ts

apps/api/test/projects-master.e2e-spec.ts   — auth/permission/tenant-isolation proof, all 3 tabs

apps/ui/src/features/projects-master/
  api.ts            — one function per endpoint, all 3 tabs
  hooks.ts          — React Query hooks (org-scoped keys, invalidation)
  schema.ts         — zod validation mirroring each DTO
  permissions.ts    — permission code constants
  components/
    ProjectsMasterView.tsx          — top-level 3-tab shell
    ProjectMasterListTab.tsx        — tab 1 (table + ProjectForm dialog)
    ProjectForm.tsx
    ProjectCodeMasterTab.tsx        — tab 2 (format fields + live preview)
    TaskRunningNumberMasterTab.tsx  — tab 3 (format fields + live preview)

apps/ui/src/app/(dashboard)/settings/masters/projects/page.tsx — the route
apps/ui/src/features/masters/MastersTabBar.tsx  — "Projects Master" tab, now enabled

packages/api-types/src/projects-master.ts   — HANDWRITTEN mirror of the backend DTOs
packages/database/prisma/schema.prisma      — Project, ProjectCodeMaster, TaskRunningNumberMaster models, "projects" schema
packages/database/prisma/permissions/catalog.ts  — projects_master.{project,project_code_master,task_running_number_master}.{read,write}
```

Registered in `apps/api/src/app.module.ts` as `ProjectsMasterModule`.

## Deliberate deviations from the legacy Firebase spec

1. **No customer field on the Project Master row.** No `Customer` model
   exists in this schema yet (the Sales module is paused). Add it only when
   a real `Customer` model exists, as a proper FK — never a denormalized
   string.
2. **Format only, not sequence allocation.** Tabs 2 and 3 store the format
   string's pieces; they do not hand out or track the next actual sequence
   number for a real project/task. That's each caller's job when the future
   Projects module creates real records — same scope limit as
   `DocumentNumbering` in `sales-settings` (see
   `Docs/SALES_SETTINGS_FOUNDATION.md`).

## Prisma models (migration `20261021072240_restructure_project_master`,

building on `20261021063901_add_project_master`)

```prisma
model Project {
  id             Int       @id @default(autoincrement())
  organizationId Int
  code           String    // user-entered, e.g. "ME", "SW"
  name           String
  description    String?
  ... audit columns, soft delete (deletedAt)

  @@unique([organizationId, code])
}

model ProjectCodeMaster {
  id                 Int    @id @default(autoincrement())
  organizationId     Int    @unique
  companyPrefix      String @default("TXW")
  moduleIdentifier   String @default("PRJ")
  defaultProjectCode String @default("")
  financialYear      String @default("")
  sequenceDigits     Int    @default(3)
  ... audit columns
}

model TaskRunningNumberMaster {
  id             Int    @id @default(autoincrement())
  organizationId Int    @unique
  taskPrefix     String @default("T")
  separator      String @default("-")
  sequenceDigits Int    @default(2)
  ... audit columns
}
```

## API

| Method | Path                                          | Body / Query                                                                                  | Notes                                                |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| GET    | `/projects-master/projects`                   | `?page&limit&search`                                                                          | `search` matches name or code                        |
| GET    | `/projects-master/projects/:id`               | —                                                                                             | 404 if missing or another org's                      |
| POST   | `/projects-master/projects`                   | `{ code, name, description? }`                                                                | `code` is user-supplied, unique per org (409 on dup) |
| PATCH  | `/projects-master/projects/:id`               | any create field, partial                                                                     |                                                      |
| DELETE | `/projects-master/projects/:id`               | —                                                                                             | soft delete (`deletedAt`), 204                       |
| GET    | `/projects-master/code-master`                | —                                                                                             | synthesizes defaults before first save               |
| PUT    | `/projects-master/code-master`                | `{ companyPrefix?, moduleIdentifier?, defaultProjectCode?, financialYear?, sequenceDigits? }` | upsert, one row per org                              |
| GET    | `/projects-master/task-running-number-master` | —                                                                                             | synthesizes defaults before first save               |
| PUT    | `/projects-master/task-running-number-master` | `{ taskPrefix?, separator?, sequenceDigits? }`                                                | upsert, one row per org                              |

## Permissions

`packages/database/prisma/permissions/catalog.ts`, `projects_master.*`
prefix — org-wide config, not HR/team data, so `@OrgScoped()` +
`@RequirePermission()` only (no `.own`/`.team`/`.all` scoping, same carve-out
as `sales_settings`/`finance_settings`):

- `projects_master.project.{read,write}`
- `projects_master.project_code_master.{read,write}`
- `projects_master.task_running_number_master.{read,write}`

Not added to any role in `default-roles.ts` — same decision as
`finance_settings`: today only the seeded Super Admin role can see Projects
Master Lists until a real Projects-module role is introduced.

## Tests

- `apps/api/src/modules/projects-master/projects-master.service.spec.ts` —
  unit tests (user-supplied code, duplicate rejection, not-found cases).
- `apps/api/test/projects-master.e2e-spec.ts` — real app, real Postgres:
  unauthenticated rejection, write-without-permission rejection,
  create/list/update/delete round trip, duplicate-code rejection, cross-tenant
  isolation, and the two config-master GET/PUT round trips.

Run:

```bash
pnpm --filter api exec vitest run src/modules/projects-master/projects-master.service.spec.ts
# e2e needs a disposable DB + non-zero Redis index — see apps/api/test/README.md
pnpm --filter api test:e2e
```

## What's NOT built yet

- The actual Project registry (department/manager/status/dates/budget/
  tasks/milestones) — the separate future Projects module. Tabs 2 and 3 here
  only store the _format_, not allocate real sequence numbers for it.
- No menu-tree entry — navigation is the "Projects Master" tab in
  `MastersTabBar.tsx`, same as Finance Master/HR Master.
