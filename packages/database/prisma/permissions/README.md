# Permission catalogue

`permissions` rows are **data**, not schema, so no Prisma migration creates them. Before this
mechanism the only source was `prisma/seed.ts`, which is local-dev only — staging and production
had no way to receive a new permission. This folder is that way. `prisma/menu/` mirrors it for
`MenuItem` (per-organization, hierarchical) — run `permissions:sync` before `menu:sync`, since a
menu item's `permission` must already exist.

| File          | Role                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.ts`  | The single, version-controlled list of permissions (`PERMISSION_CATALOG`) and retired ones (`RETIRED_PERMISSIONS`). **Edit this.** |
| `validate.ts` | Naming (`Docs/CODING_STANDARDS.md` §2a) and scope-completeness rules. Pure, no DB.                                                 |
| `sync.ts`     | `syncPermissions()` — makes the DB match the catalogue, additively.                                                                |
| `sync-cli.ts` | The command a deploy pipeline runs.                                                                                                |

## Add a permission

1. Add it to `catalog.ts` in the same PR as the code that checks it. Team-scoped data uses
   `...scopedPermission("hr.employee.read", "View employees")` — all of `.own`/`.team`/`.all`
   are required together (`validate.ts` rejects a partial set).
2. `pnpm --filter @texawave-erp/database permissions:sync` locally.
3. Give its resource a label and section in the role editor's
   `apps/ui/src/features/settings/roles/utils/access-model.ts` (`RESOURCES`), or it is listed
   under "Other". If its `.own` variant is refused by the API, add the base code to
   `OWN_RESERVED`; if it is high-impact (money, personal data, access), add it to `SENSITIVE`.
4. Grant it to roles in Admin → Roles (Access control). Sync never grants anything to anyone.

## Deploy (every environment)

Run **after** `prisma migrate deploy`, as its own pipeline step:

```bash
pnpm --filter @texawave-erp/database exec prisma migrate deploy
pnpm --filter @texawave-erp/database permissions:sync:dry   # optional: show the plan
pnpm --filter @texawave-erp/database permissions:sync
```

It prints the target host/database (never credentials), takes a Postgres advisory lock (two nodes
starting together serialise), and runs in one transaction. Exit code is non-zero on an invalid
catalogue or any failure. `permissions:check` validates the catalogue without a database.

## Guarantees (what "non-destructive" means here)

- Inserts missing rows and refreshes `description` text — nothing else about a catalogue permission.
- **Never deletes** a row. **Never touches** `roles`, `role_permissions` or `user_roles`.
- **Never re-activates** a permission that was disabled (`is_active = false`); it is reported as
  "kept inactive" — an administrator may have disabled it on purpose.
- Deactivates only codes listed in `RETIRED_PERMISSIONS` (with a reason). Moving a permission out
  of the catalogue without retiring it just makes it an "orphan": reported, left as it is.
- Idempotent: a second run reports `unchanged` and writes nothing.

## Tests

`pnpm --filter @texawave-erp/database test` runs the validation and sync tests (in-memory).
`sync.db.test.ts` additionally checks the real behaviour against Postgres, but **only** when
`TEST_DATABASE_URL` is set (to a disposable database with migrations applied) — it is skipped
otherwise so `turbo run test` can never write to a shared database.

---

## Work Permission Feature — Full Architecture

> Employee short-time leave requests (max 2 hours within work hours 10:00–19:00).
> Added: 2026-11-13.

### Database Table — `hr.work_permissions`

Migration: `packages/database/prisma/migrations/20261113100000_add_work_permissions/migration.sql`

| Column            | Type                                  | Description                         |
| ----------------- | ------------------------------------- | ----------------------------------- |
| `id`              | `SERIAL` (PK)                         | Auto-increment                      |
| `organization_id` | `INT` (FK → organizations)            | Tenant root                         |
| `employee_id`     | `INT` (FK → hr.employees)             | Who requested                       |
| `date`            | `DATE`                                | Permission date                     |
| `from_time`       | `VARCHAR(5)`                          | e.g. `"10:00"`                      |
| `to_time`         | `VARCHAR(5)`                          | e.g. `"12:00"`                      |
| `duration_mins`   | `INT`                                 | Computed (to − from)                |
| `reason`          | `TEXT`                                | Employee's reason                   |
| `status`          | `TEXT`                                | `PENDING` / `APPROVED` / `REJECTED` |
| `hr_note`         | `TEXT` (nullable)                     | HR's note on decision               |
| `requested_by`    | `INT` (FK → platform.users)           | JWT user who submitted              |
| `decided_by`      | `INT` (FK → platform.users, nullable) | HR who decided                      |
| `decided_at`      | `TIMESTAMPTZ` (nullable)              | Decision timestamp                  |
| `created_at`      | `TIMESTAMPTZ`                         | Auto                                |
| `updated_at`      | `TIMESTAMPTZ`                         | Auto                                |

**CHECK constraints:** `status IN ('PENDING','APPROVED','REJECTED')`, `duration_mins` between 1–120, `from_time`/`to_time` match regex `^([01][0-9]|2[0-3]):[0-5][0-9]$`

### Prisma Model — `packages/database/prisma/schema.prisma`

```prisma
model WorkPermission {
  id             Int       @id @default(autoincrement())
  organizationId Int       @map("organization_id")
  employeeId     Int       @map("employee_id")
  date           DateTime  @db.Date
  fromTime       String    @db.VarChar(5)  @map("from_time")
  toTime         String    @db.VarChar(5)  @map("to_time")
  durationMins   Int       @map("duration_mins")
  reason         String
  status         String    @default("PENDING")
  hrNote         String?   @map("hr_note")
  requestedBy    Int       @map("requested_by")
  decidedBy      Int?      @map("decided_by")
  decidedAt      DateTime? @map("decided_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  employee     Employee     @relation(fields: [employeeId], references: [id])
  requester    User         @relation("WorkPermissionRequester", fields: [requestedBy], references: [id])
  decider      User?        @relation("WorkPermissionDecider", fields: [decidedBy], references: [id])

  @@schema("hr")
  @@map("work_permissions")
}
```

Back-relations added to: `Organization.workPermissions`, `Employee.workPermissions`, `User.workPermissionsRequested`, `User.workPermissionsDecided`

---

### API Endpoints

#### Employee Self-Service — `apps/api/src/modules/employee-self-service/work-permissions/`

```
├── dto/work-permission.dto.ts
├── my-work-permissions.controller.ts
├── my-work-permissions.service.ts
├── my-work-permissions.repository.ts
└── my-work-permissions.module.ts
```

| Method | Endpoint                             | Permission required                            | Description                                     |
| ------ | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `GET`  | `/self-service/work-permissions`     | `employee_self_service.work_permission.read`   | My requests (paginated, optional `year` filter) |
| `GET`  | `/self-service/work-permissions/:id` | `employee_self_service.work_permission.read`   | Single request                                  |
| `POST` | `/self-service/work-permissions`     | `employee_self_service.work_permission.create` | Submit new request                              |

#### HR Admin

| Method  | Endpoint                          | Permission required             | Description                                               |
| ------- | --------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `GET`   | `/hr/work-permissions`            | `hr.work_permission.read.all`   | All requests (optional `status`/`year` filter, paginated) |
| `PATCH` | `/hr/work-permissions/:id/decide` | `hr.work_permission.decide.all` | Approve or Reject                                         |

---

### Business Rules (enforced in `my-work-permissions.service.ts`)

- `fromTime` must be `≥ 10:00` (work start)
- `toTime` must be `≤ 19:00` (work end)
- `fromTime` must be strictly `< toTime`
- `durationMins` must be `≤ 120` (2-hour cap)
- Only `PENDING` requests can be decided — already-decided requests throw `ALREADY_DECIDED`
- Reject requires a non-empty `hrNote` — throws `NOTE_REQUIRED` otherwise
- Employee ID is always resolved from JWT via `EmployeeQueryService.getCurrentEmployee()` — never trusted from client input

---

### Permissions (RBAC)

Defined in `catalog.ts`, granted in `default-roles.ts`, applied to live DB via migrations:

| Permission code                                | Granted to              | Migration                                               |
| ---------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| `employee_self_service.work_permission.read`   | Employee                | `20261113110000_grant_work_permission_to_employee_role` |
| `employee_self_service.work_permission.create` | Employee                | `20261113110000_grant_work_permission_to_employee_role` |
| `hr.work_permission.read.all`                  | HR Manager, Super Admin | `20261114100000_grant_hr_work_permission_to_hr_manager` |
| `hr.work_permission.decide.all`                | HR Manager, Super Admin | `20261114100000_grant_hr_work_permission_to_hr_manager` |

---

### Notifications Flow

```
Employee submits request
  → notifyAdmins()  → all HR Manager + Super Admin users receive a bell notification
                       link: /hr/leaves?tab=permissions

HR approves or rejects
  → notifyUser()    → the requesting employee receives a bell notification
                       link: /portal/permissions
```

---

### Frontend Files

```
apps/ui/src/
  features/employee-self-service/work-permissions/
    ├── api.ts        — listMyWorkPermissions, createMyWorkPermission,
    │                   listAllWorkPermissions, decideWorkPermission
    └── hooks.ts      — useMyWorkPermissions, useCreateMyWorkPermission,
                        useAllWorkPermissions, useDecideWorkPermission

  app/(employee-portal)/portal/permissions/page.tsx
    — Employee portal page
      · Custom ERP-themed calendar date picker
      · Custom hour (10 AM–7 PM) + minute (00–59) dropdowns
      · Permission history table with status badges and full HR note

  features/hr/leaves/components/PermissionsSection.tsx
    — HR tab rendered inside /hr/leaves?tab=permissions
      · Status filter (All / Pending / Approved / Rejected)
      · Approve / Reject buttons on PENDING rows
      · DecideDialog with optional (approve) or required (reject) HR note
```

### End-to-end Data Flow

```
1. Employee fills form (date, from/to time, reason)
      → POST /self-service/work-permissions
2. Service validates times and duration
      → INSERT into hr.work_permissions (status = PENDING)
3. notifyAdmins() fires → HR + Admin see bell notification
4. HR clicks notification → /hr/leaves?tab=permissions
5. HR clicks Approve or Reject, adds note
      → PATCH /hr/work-permissions/:id/decide
6. Row updated (status, hr_note, decided_by, decided_at)
7. notifyUser() fires → Employee sees updated status
8. Employee views full result (badge + HR note) at /portal/permissions
```
