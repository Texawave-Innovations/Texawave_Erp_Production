# Finance Master — master list backend/frontend

**Status:** Master list foundation landed (this doc) — the "Finance Master"
page's two cards, Expense Types and Payment Modes. The rest of the Finance
module (expenses, payments, and whatever else lives under it) has not been
built yet; this doc is written for whoever builds it next, so they know
exactly how to read these masters instead of re-inventing them.

**Owner:** repository maintainers — assign a named owner before further
Finance-module work begins.

This mirrors `Docs/SALES_SETTINGS_FOUNDATION.md`'s "Terms & Inventory"
master-list-items resource almost exactly — read that doc if something here
is underspecified, the two were built from the same pattern.

## Where the code lives

```
apps/api/src/modules/finance-settings/
  finance-settings.module.ts        — one Nest module (currently one resource)
  finance-settings.constants.ts     — FinanceMasterListCategory enum
  master-list-items.{controller,service,repository}.ts — generic; category passed per-request
  master-list-items.service.spec.ts
  dto/create-master-list-item.dto.ts
  dto/update-master-list-item.dto.ts
  dto/query-master-list-item.dto.ts

apps/api/test/finance-settings.e2e-spec.ts   — auth/permission/tenant-isolation proof

apps/ui/src/features/finance-settings/
  api.ts            — one function per endpoint
  hooks.ts           — React Query hooks (org-scoped keys, invalidation)
  schema.ts          — zod validation mirroring the create DTO
  permissions.ts      — permission code constants
  components/FinanceMasterView.tsx  — the two cards, uses ui-kit's MasterListCard

apps/ui/src/app/(dashboard)/settings/masters/finance/page.tsx  — the route
apps/ui/src/features/masters/MastersTabBar.tsx  — "Finance Master" tab, now enabled

packages/api-types/src/finance-settings.ts   — HANDWRITTEN mirror of the backend DTOs
packages/database/prisma/schema.prisma       — FinanceMasterListItem model, "finance" schema
packages/database/prisma/permissions/catalog.ts  — finance_settings.master_list_item.{read,write}
```

Registered in `apps/api/src/app.module.ts` as `FinanceSettingsModule`.

Follows Docs/CODING_STANDARDS.md §3's controller → service → repository
shape: the repository is the only place `PrismaService` is called, every
repository method is `@OrgScoped()`, all filters go through `tenantWhere()`.

## Prisma model (migration `20261017085131_add_finance_master_list_items`)

One table, in a new `finance` Postgres schema (added to
`datasource.schemas` per `Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md` §2 — the first
model in that schema, created exactly the way that plan describes for
SCM/CRM/Finance's eventual first tables):

| Model                   | Table                       | Shape                               | UI card    |
| ----------------------- | --------------------------- | ----------------------------------- | ---------- |
| `FinanceMasterListItem` | `finance_master_list_items` | list, `category` ∈ 2 values (below) | both cards |

```prisma
model FinanceMasterListItem {
  id             Int       @id @default(autoincrement())
  organizationId Int
  category       String    // "expense_type" | "payment_mode"
  value          String
  numericValue   Decimal?  // unused today — reserved, same as GST Rates' use of it in sales
  customFields   Json      @default("{}")
  isActive       Boolean   @default(true)
  createdBy      Int?
  updatedBy      Int?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime? // soft delete
}
```

**Same design decision as `SalesMasterListItem`:** one generic table behind
a `category` discriminator, not one table per card. Values are **not**
unique per category — this is an unstructured value list (a user can add
"Travel" to Expense Types twice if they want), not a unique code+name
lookup. Don't add a unique constraint on `(organizationId, category, value)`
without checking with whoever owns the UI first.

## Categories

`FINANCE_MASTER_LIST_CATEGORIES` (`finance-settings.constants.ts` on the
backend, `finance-settings.ts` in `packages/api-types` on the frontend —
**keep both in sync by hand**, nothing generates one from the other yet,
Docs/ARCHITECTURE.md §2):

- `expense_type` — "Expense Types" card
- `payment_mode` — "Payment Modes" card

**Adding a third card** (e.g. a future "Tax Codes" or "Cost Centers" card):
add one value to both `FINANCE_MASTER_LIST_CATEGORIES` arrays, one
`CategoryCard` in `FinanceMasterView.tsx`. No new table, no new
controller/service/repository — this is the entire point of the generic
`category` shape. Only reach for a dedicated table/resource (the way
`BankAccount`/`Salesperson` are dedicated in sales-settings, instead of
folding into the master-list-items shape) if the new thing needs its own
fields beyond `value`/`numericValue`.

## API

Base path: `/finance-settings/master-list-items`. Every endpoint requires
auth; the two permission codes below gate read vs. write.

| Method | Path                                                        | Body / Query                                        | Notes                                                                                                               |
| ------ | ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GET    | `/finance-settings/master-list-items?category=expense_type` | —                                                   | `category` is **required** on list (400 without it)                                                                 |
| GET    | `/finance-settings/master-list-items/:id`                   | —                                                   | 404 if missing or another org's row                                                                                 |
| POST   | `/finance-settings/master-list-items`                       | `{ category, value, numericValue?, customFields? }` | `category` fixed at create                                                                                          |
| PATCH  | `/finance-settings/master-list-items/:id`                   | `{ value?, numericValue?, customFields? }`          | `category` is **immutable** — sending it is a 400. Move a value to another category by deleting and re-creating it. |
| DELETE | `/finance-settings/master-list-items/:id`                   | —                                                   | soft delete (`deletedAt`), 204                                                                                      |

List responses are the standard paginated envelope
(`PaginatedResponseDto` / `PaginatedEnvelope<FinanceMasterListItem>`).

### How a future Finance module should read these

**Reference a row by its `id`, never copy `value` into another table.** If
an Expense Claim record needs an expense type, store
`expenseTypeId: number` pointing at this table's row, not a denormalized
string — the same rule `Docs/SALES_SETTINGS_FOUNDATION.md` sets for Sales
referencing Terms & Inventory rows. This is what lets a user rename
"Travel" to "Travel & Transport" without silently orphaning every record
that already used the old string.

A dropdown/select in a future Expenses or Payments form fetches
`GET /finance-settings/master-list-items?category=expense_type&limit=100`
(or `payment_mode`) and lists `.value`, submitting `.id`.

### Step-by-step for a new business module (e.g. Expense Claims)

1. **Schema:** add an `Int` FK column pointing at `FinanceMasterListItem`,
   not a copied string:

   ```prisma
   model ExpenseClaim {
     id             Int      @id @default(autoincrement())
     organizationId Int
     expenseTypeId  Int
     paymentModeId  Int?
     amount         Decimal
     ...

     expenseType FinanceMasterListItem @relation("ExpenseClaimExpenseType", fields: [expenseTypeId], references: [id])
     paymentMode FinanceMasterListItem? @relation("ExpenseClaimPaymentMode", fields: [paymentModeId], references: [id])

     @@schema("finance")
   }
   ```

2. **Service-level category check is required — the FK alone doesn't
   enforce it.** Postgres only knows `expenseTypeId` points at _some_ row in
   `finance_master_list_items`; nothing stops it pointing at a
   `payment_mode` row instead of an `expense_type` one. Before accepting an
   `expenseTypeId`/`paymentModeId` on create/update, the new module's
   service must call `MasterListItemsService.findOne(id)` (or inject
   `MasterListItemsRepository` directly) and check
   `.category === "expense_type"` (or `"payment_mode"`), throwing the same
   `ResourceNotFoundException` the master-list service already uses if it
   doesn't match or doesn't belong to the caller's org.

3. **Frontend dropdown — reuse the existing hook, don't add a new
   endpoint:**

   ```ts
   import { useMasterListItems } from "@/features/finance-settings/hooks";

   const expenseTypes = useMasterListItems({
     category: "expense_type",
     page: 1,
     limit: 100,
   });
   // render item.value as the label, submit item.id as expenseTypeId
   ```

4. **Module boundary:** the new module (e.g.
   `apps/api/src/modules/finance/expense-claims/`) stays its own Nest
   module/feature folder that _depends on_ `finance-settings` — it does not
   get folded into `finance-settings.module.ts`. Same direction
   `apps/api/src/modules/hr` depends on `apps/api/src/modules/master-data`
   for designations/shifts/work-locations: the business module reads the
   master, the master doesn't know the business module exists.

## Permissions

`packages/database/prisma/permissions/catalog.ts`, `finance_settings.*`
prefix:

- `finance_settings.master_list_item.read` — view both cards
- `finance_settings.master_list_item.write` — create/update/delete

Synced into the `permissions` table by `packages/database/prisma/seed.ts`
on every environment.

**Role wiring (decision, not an oversight):** these two codes are not added
to any role in `packages/database/prisma/permissions/default-roles.ts` —
today only the seeded "Super Admin" role can see Finance Master, since
`seed.ts` grants Super Admin every permission in the catalog automatically.
No other default role (HR Manager, Team Lead, Employee) gets it. When a
real Finance-module role (e.g. "Finance Manager") is introduced, add
`finance_settings.master_list_item.read`/`.write` to it in
`default-roles.ts` — same pattern `DEFAULT_ROLES` already uses for HR.

## Tests

- `apps/api/src/modules/finance-settings/master-list-items.service.spec.ts`
  — unit tests for the service (mocked repository/tenant context).
- `apps/api/test/finance-settings.e2e-spec.ts` — real app, real Postgres:
  unauthenticated rejection, write-without-permission rejection,
  create/list/update/delete round trip, `category` required-on-list /
  immutable-on-update, and cross-tenant isolation (org B can't see/edit/
  delete org A's rows).

Run:

```bash
pnpm --filter api exec vitest run src/modules/finance-settings/master-list-items.service.spec.ts
# e2e needs a disposable DB + non-zero Redis index — see apps/api/test/README.md
pnpm --filter api test:e2e
```

`apps/ui/e2e/finance-settings.spec.ts` — Playwright, mocked API (Masters tab
bar active, both cards render, add/delete round-trip, read-only user sees no
add form). Needs `apps/ui` running (`pnpm --filter ui dev`) — the API itself
is fully mocked, so it doesn't need to be up.

## What's NOT built yet

- No menu-tree entry (see below).
- No dedicated resources beyond the generic master-list-items one — nothing
  in the Finance module needs its own fields yet, so there's no
  `ExpenseClaimsModule`-style backend for actual expenses/payments. That's
  the next layer, built the same way `apps/api/src/modules/sales-settings`
  grew beyond its first resource (one controller/service/repository per new
  resource, same Nest module).
- No menu-tree entry (`packages/database/prisma/menu/catalog.ts`) —
  navigation to this page is the hardcoded "Finance Master" tab in
  `MastersTabBar.tsx` plus the "Master List" top-nav item in
  `HorizontalNavbar.tsx`, same as sales-settings and HR Master.
