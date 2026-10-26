# HR Master — reference/code-table screen

**Status:** Landed. Five reference/code-table cards (Departments, Designations,
Office Locations, Leave Types, Shifts) behind the "HR Master" tab. Unlike
Finance Master and Projects Master, this isn't one new resource behind one
new module — it's a UI aggregation of five _existing_ resources that already
had their own backend modules, each already used by other parts of HR
(employees, shifts, leave requests, holidays). This doc exists so whoever
adds a sixth card, or a new HR module that needs one of these five, knows
where to look instead of re-discovering five different modules.

**Owner:** repository maintainers — assign a named owner before further
HR-module work begins.

Read `Docs/FINANCE_MASTER_LIST.md` and `Docs/PROJECTS_MASTER.md` first if
something about the Masters-tab integration itself (not the five resources
below) is underspecified — all three follow the same `MastersTabBar.tsx`
pattern.

## The five cards — and where each one actually lives

Each card is a thin `MasterListCard` (ui-kit) wired to an **existing**
resource; none of these were built for this screen:

| Card             | Backend module                                     | Prisma model   | Frontend wrappers reused from                 |
| ---------------- | -------------------------------------------------- | -------------- | --------------------------------------------- |
| Departments      | `apps/api/src/modules/departments/`                | `Department`   | `apps/ui/src/features/departments/`           |
| Designations     | `apps/api/src/modules/master-data/designations/`   | `Designation`  | `apps/ui/src/features/designations/`          |
| Office Locations | `apps/api/src/modules/master-data/work-locations/` | `WorkLocation` | `apps/ui/src/features/hr-master/api.ts` (new) |
| Leave Types      | `apps/api/src/modules/hr/leave-types/`             | `LeaveType`    | `apps/ui/src/features/hr-master/api.ts` (new) |
| Shifts           | `apps/api/src/modules/master-data/shifts/`         | `Shift`        | `apps/ui/src/features/hr-master/api.ts` (new) |

Departments and Designations already had frontend API/hook wrappers from
earlier work (`apps/ui/src/features/departments/`,
`apps/ui/src/features/designations/`) — `HrMasterView.tsx` imports those
as-is. Office Locations, Leave Types, and Shifts had no frontend yet, so
`apps/ui/src/features/hr-master/api.ts`/`hooks.ts` add thin wrappers for
them — **do not duplicate those wrappers elsewhere**; a future Attendance or
Leave screen that needs a work-location/shift/leave-type dropdown imports
from here, the same way a future Finance module reuses
`finance-settings/hooks.ts` (`Docs/FINANCE_MASTER_LIST.md` §"How a future
Finance module should read these").

## Where the code lives

```
apps/ui/src/features/hr-master/
  api.ts            — wrappers for the 3 resources with no prior frontend
                       (work locations, leave types, shifts)
  hooks.ts           — React Query hooks for all 5 (wraps departments'/
                       designations' own hooks too, so HrMasterView has one
                       import surface)
  schema.ts          — zod validation
  permissions.ts     — permission code constants for all 5
  utils.ts           — deriveCode() (name -> short code), shared by the
                       cards that create-from-chip-input
  components/HrMasterView.tsx  — the 5 cards

apps/ui/src/app/(dashboard)/settings/masters/hr/page.tsx  — the route
apps/ui/src/features/masters/MastersTabBar.tsx  — "HR Master" tab, enabled

packages/api-types/src/index.ts  — WorkLocation/LeaveType/Shift types
  (Department/Designation types already existed, re-exported, not redefined)
```

The backend side is **not** one module — each resource keeps its own
pre-existing Nest module (`DepartmentsModule`, `DesignationsModule` under
`master-data`, `WorkLocationsModule` under `master-data`,
`LeaveTypesModule` under `hr`, `ShiftsModule` under `master-data`), each
already registered in `apps/api/src/app.module.ts`. There is no
`hr-master.module.ts` — this screen never needed one, since it added no new
backend resource, only new frontend wrappers for three resources that
already existed.

## Scoping — why these are `@OrgScoped()`, not `@TeamScoped()`

`CLAUDE.md`'s rule is that HR _data_ — employee records, leave requests,
attendance — is `@TeamScoped()`, since Software/Mechanical/Electrical are
real boundaries for who can see whom. These five are different: they are
**organization-wide reference/configuration lists**, the same code-table
shape as Finance Master's categories or Projects Master's project-type
registry — every team picks a designation, office location, leave type, or
shift from the _same_ org-wide list; there is no per-team Shift table.
That's why `WorkLocationsRepository`/`ShiftsRepository` (both extending the
shared `MasterDataRepository` base in
`apps/api/src/modules/master-data/shared/`), `LeaveTypesRepository`, and
`DepartmentsRepository` are all `@OrgScoped()`. If a future change makes any
of these team-specific (e.g. per-team shift catalogs), that's a scoping
change requiring review per `CLAUDE.md`'s auth/tenancy rule, not a drive-by
edit.

## Permissions

`packages/database/prisma/permissions/catalog.ts` — note the prefixes are
**not** uniform (pre-existing per-module conventions, not a mistake to
"fix" in a drive-by):

- `departments.department.{read,write}`
- `master.designation.{read,write}`
- `master.work_location.{read,write}`
- `master.shift.{read,write}`
- `hr.leave_type.{read,write}`

Each gates its own card in `HrMasterView.tsx` independently via
`usePermission()` — a user missing `master.shift.write` still sees every
other card's add/delete controls.

## Adding a sixth card

There is no generic "category" shape here the way Finance Master has one
(`Docs/FINANCE_MASTER_LIST.md` §"Categories") — each card is backed by its
own dedicated table/module. Adding a sixth card means:

1. The resource needs its own Prisma model + Nest module (controller/
   service/repository, `@OrgScoped()` unless it's genuinely team-specific
   HR data, in which case `@TeamScoped()` per `CLAUDE.md` and that needs
   review first), **or** it already exists elsewhere in the codebase and
   you're just surfacing it here — check `apps/api/src/modules/` before
   building a new one.
2. Frontend wrappers in `apps/ui/src/features/hr-master/api.ts`/`hooks.ts`
   if none exist yet for that resource (skip this step and import the
   existing feature's hooks if they do, the way Departments/Designations
   are reused as-is).
3. A new `<X>Card()` function in `HrMasterView.tsx`, added to the grid in
   `HrMasterView()`, following the existing cards' shape (permission check →
   query hook → create/deactivate mutations → `MasterListCard`).
4. Permission codes in `catalog.ts`, read/write, following whichever prefix
   convention the resource's existing module already uses (or
   `hr_master.<resource>.{read,write}` if it's new and has no module yet).

## Tests

- `apps/api/test/departments.e2e-spec.ts` — Departments.
- `apps/api/test/master-data.e2e-spec.ts` — Designations, Office Locations,
  Leave Types (tenant isolation, validation, activate/deactivate).
- `apps/api/test/hr-shifts.e2e-spec.ts` — Shifts, including the
  `assertCanDeactivate` in-use check (`shifts.repository.ts`).
- `apps/ui/e2e/hr-master.spec.ts` — Playwright, mocked API: all five cards
  render, add/remove round-trip per card, read-only user sees no add form.

Run:

```bash
pnpm --filter api test:e2e   # needs a disposable DB + non-zero Redis index — see apps/api/test/README.md
pnpm --filter ui test:e2e    # needs apps/api and apps/ui both running against a seeded db
```

## What's NOT built yet

- No menu-tree entry — navigation is the "HR Master" tab in
  `MastersTabBar.tsx`, same as Finance Master/Projects Master.
- Employee Status is intentionally out of scope for this screen (comment in
  `HrMasterView.tsx`) — it's lifecycle state on the Employee record itself,
  not a reference list.
- Shifts created from this screen's chip-add input get a fixed default
  window (09:00–18:00, 480 min) — editing the actual times needs the
  dedicated Shifts admin screen; this is a deliberate scope limit of the
  chip-list UI, not a bug (see the comment above `ShiftsCard()`).
