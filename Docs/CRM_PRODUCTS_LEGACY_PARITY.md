# CRM Products — Legacy Parity Audit

**Status:** Audit only. No schema, permission, backend, or frontend code was written for Products
in this pass. No file outside this document was changed.
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP`. Not modified.
**Production source:** `D:\New folder\Texawave_Erp_Production`, branch `feature/HR`. Not modified
(this document is the only new file).
**Methodology:** same as `Docs/CRM_LEGACY_PARITY.md` — _Confirmed_ = read directly in legacy
source. _Absent (verified)_ = actively checked for and not found, stated so it is never confused
with "not yet looked at." _Open decision_ = a choice the implementation phase must make, not a
legacy behavior to copy.

---

## 1. Files inspected

**Legacy (read-only).** Paths below are relative to `TexaWave_ERP/src/modules/crm/`. They were
read via the reference copies under `Texawave_Erp_Production/apps/api/src/modules/crm/`, and all
13 files listed were then confirmed **byte-identical** to the originals in `TexaWave_ERP` with
`diff -q`, so every finding below applies to the real legacy source.

- `Products.tsx` (417 lines) — the only Products screen; no separate
  list/detail/create route exists, all three are in-component state swaps.
- `domain/productsService.ts` (41 lines, read in full) — CRUD + delete-guard.
- `domain/types.ts` lines 466–503 — `CrmProduct`, `CrmProductInput`, `CrmDealProduct`,
  `CrmDealProductInput`.
- `domain/dealProductsService.ts` (73 lines, read in full) — the shared line-item money math
  (`computeLineBreakdown`/`computeDealProductTotal`) plus deal-line add/update/remove.
- `domain/AddDealProductsDialog.tsx` (149 lines, read in full) — multi-select picker that attaches
  Products to an Opportunity as `CrmDealProduct` rows.
- `domain/QuoteProductPicker.tsx` (70 lines, read in full) — single-select combobox that attaches
  a Product to one Quote line item.
- `domain/roles.ts` — `canManageProducts`/`canManagePipelineConfig`/`isCrmAdmin` (read in full
  during the Leads audit; the relevant lines 42–51 were re-checked for this one).
- `domain/currency.ts` (52 lines, read in full) — confirms Product carries no currency field of
  its own; currency lives on the _consuming_ record (Opportunity/Quote/Quota).
- `domain/config.ts` lines 190–195 — `CRM_PRODUCTS_PATH`, `CRM_DEAL_PRODUCTS_PATH`,
  `CRM_QUOTATION_ITEMS_PATH`.
- `domain/useCrmDomainData.tsx` — confirms `products`/`dealProducts`/`quotationItems` are each a
  full, unfiltered Firebase collection subscription (no server-side pagination anywhere).
- `importExport/types.ts` — `DuplicateStrategy`, `FieldSchema` (the shared bulk import/export
  contract Products uses).
- `intelligence/components.tsx` lines 286–330 — `DeleteConfirmDialog`, confirming the
  delete-usage warning is informational text, not a disabled button; the actual block is the
  service throw, surfaced as an inline dialog error.
- `CRMLayout.tsx` lines 123–249 — the CRM tab list, confirming Products' nav position and route.

**Legacy data export (read-only, aggregate statistics only):**
`TexaWave_ERP/texa-erp-aug-default-rtdb-export.json` was parsed by a read-only script that printed
only node names, key sets, counts and booleans — no names, codes, prices or any individual
record. Findings are in §2.9.

**Not read line-by-line (out of scope, touchpoints only):** `QuoteForm.tsx`, `Quotes.tsx`,
`domain/quotationsService.ts`, `domain/quotasService.ts` — Quotes/Quotas module internals;
Products' only surface there is `QuoteProductPicker.tsx`, which was read in full.

**New repository (read, not modified) — conventions reused for the mapping in §4:**

- `packages/database/prisma/schema.prisma` — `Account`, `Contact`, `Lead`, `PipelineStage`,
  `Opportunity`, `OpportunityStageHistory` (all six already in this codebase from prior phases).
- `packages/database/prisma/permissions/catalog.ts` — `crm.account.*`, `crm.pipeline_stage.*`
  (org-wide, non-scoped) vs `crm.contact.*`, `crm.lead.*`, `crm.opportunity.*` (team-scoped
  `.own/.team/.all`) permission shapes.
- `apps/api/src/modules/crm/accounts/` and `apps/api/src/modules/crm/pipeline-stages/` (dto,
  repository, service, controller, module) — the two existing org-wide-reference-data modules,
  the closest architectural precedent for Products.
- `apps/api/src/modules/crm/opportunities/opportunities.repository.ts` — `Decimal` money-field
  convention (`estimatedValue Decimal @db.Decimal(14,2)`) and the delete-blocked-while-referenced
  pattern already implemented once for `PipelineStage` (`softDelete` refuses while any
  `Opportunity` still references it) — directly reusable precedent for Product's identical rule.
- `Docs/CRM_LEGACY_PARITY.md`, `Docs/HOW_TO_ADD_A_MODULE.md` — process/format precedent.

---

## 2. Functional inventory

### 2.1 Pages, views, dialogs, navigation (item 1)

- **One nav entry:** CRM top tab "Products" (`Package` icon), route `/crm/products`, positioned
  after Accounts/Pipeline/Contacts and before Quotation/Target in the "CRM Core Domain" tab group
  (`CRMLayout.tsx:227-228`).
- **No separate routes for list/create/edit/view.** All four are the _same_ component
  (`Products.tsx`) swapping its own rendered body based on local state (`dialogOpen`,
  `viewingProduct`), each with its own "← Back to Products" button — not React Router
  sub-routes, not modal dialogs (confirmed: no `<Dialog>` wrapper on the create/edit or view
  forms; they fully replace the page content).
- **List view:** gradient-header table (Product/Category/Vendor/Unit Price/Tax %/Status/Action
  columns), a search box, an `ImportExportBar`, an "Add Product" button (gated), and a
  paginated footer.
- **View (read-only) screen:** name/code/category/vendor/unit price/tax %/"Used In Deals"
  count/description, an Active/Inactive badge, an Edit button (gated).
- **Create/Edit screen:** the same form for both; `editingId` distinguishes them.
- **Delete:** an `AlertDialog`-based confirm (`DeleteConfirmDialog`), triggered inline from the
  list row, not a separate page.

### 2.2 Fields, types, defaults, constraints (item 2)

From `CrmProduct` (`domain/types.ts:466-480`) and the create/edit form (`Products.tsx:230-263`):

| Field         | Type      | Default | Required                                                                                                                                                       | Constraint                                                                                                                                                                                                                                                                                                                     |
| ------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | `string`  | `''`    | **Yes** (client-side: `!form.name.trim()` blocks save)                                                                                                         | none beyond non-empty                                                                                                                                                                                                                                                                                                          |
| `code`        | `string`  | `''`    | **Yes** (client-side: `!form.code.trim()` blocks save)                                                                                                         | **No uniqueness check on manual create/edit** — verified by reading `createCrmProduct`/`updateCrmProduct` in full; they never query for an existing code. Uniqueness is only _advisory_, inside the bulk-import duplicate matcher (`Products.tsx:303-311`: case-insensitive trim match used to decide import create-vs-update) |
| `category`    | `string?` | `''`    | No                                                                                                                                                             | free text, no master list/dropdown anywhere in the codebase (verified absent)                                                                                                                                                                                                                                                  |
| `vendor`      | `string?` | `''`    | No                                                                                                                                                             | free text, no master list/dropdown (verified absent)                                                                                                                                                                                                                                                                           |
| `unitPrice`   | `number`  | `0`     | Labeled "Unit Price \*" on the form, but **not enforced** — the save guard checks only `name`/`code`, and the default of `0` always satisfies "present" anyway | HTML `min={0}` on the input only (does not stop a typed or pasted negative value); no service-layer validation                                                                                                                                                                                                                 |
| `taxPercent`  | `number?` | `0`     | No                                                                                                                                                             | HTML `min={0}` only, same caveat as `unitPrice`                                                                                                                                                                                                                                                                                |
| `description` | `string?` | `''`    | No                                                                                                                                                             | none                                                                                                                                                                                                                                                                                                                           |
| `active`      | `boolean` | `true`  | —                                                                                                                                                              | toggled via a `Switch`, independent of delete                                                                                                                                                                                                                                                                                  |

**Absent (verified, not merely unchecked):** SKU auto-generation/format pattern, barcode/UPC,
stock/quantity/warehouse fields, product images/attachments, variants/bundles/kits, a currency
field on the product itself, a max-length constraint on any text field, a tax-rate upper bound
(e.g. ≤100%).

### 2.3 Supported actions — only where actually implemented (item 3)

| Action               | Implemented?             | Detail                                                                                                                                                                                                                    |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create               | Yes                      | Via the inline form; `canManageProducts` gated                                                                                                                                                                            |
| Read (list)          | Yes                      | Full collection subscription (`subscribeCrmProducts`), client-side only                                                                                                                                                   |
| Read (single/"view") | Yes                      | Inline state, not a route                                                                                                                                                                                                 |
| Update               | Yes                      | Same form as create; `canManageProducts` gated                                                                                                                                                                            |
| Archive (deactivate) | Yes                      | Via the `active` boolean toggle on the edit form — not a distinct action, just a field edit through Update; same `canManageProducts` gate                                                                                 |
| Delete               | Yes                      | **Soft delete into the CRM Recycle Bin**, `isCrmAdmin`-only (stricter than Create/Update's `canManageProducts`), refused (throws) when `usageCount > 0` (any live `CrmDealProduct` or quotation line item referencing it) |
| Search               | Yes                      | Client-side substring match across `name`/`code`/`category`/`vendor`, case-insensitive                                                                                                                                    |
| Filtering            | **No (verified absent)** | No category/vendor/active-status filter control anywhere in `Products.tsx`, despite those fields existing                                                                                                                 |
| Sorting              | **No (verified absent)** | No clickable/sortable column headers (contrast with `Leads.tsx`, which has explicit sort state); list order is `createdAt` descending, fixed in `subscribeCrmProducts`                                                    |
| Pagination           | Yes                      | **Client-side only** (`usePagination`, default page size 10, over the already-fully-loaded array), page-size selector included                                                                                            |
| Bulk import          | Yes                      | Excel-based, via the shared `ImportExportBar`/`commitFirebaseImport` infra, duplicate-matched on `code` (case-insensitive trim); strategy `skip`/`update`/`create` chosen by the importing user                           |
| Bulk export          | Yes                      | Same `ImportExportBar`; exports all fields, with `active` formatted as "Yes"/"No"                                                                                                                                         |
| Bulk delete          | **No (verified absent)** | No multi-select/bulk-delete UI                                                                                                                                                                                            |

### 2.4 Categories, codes, pricing, currency, tax, discount, stock (item 4)

- **Categories:** free-text string field on the product row. No separate category entity,
  no hierarchy, no color/icon.
- **SKU/code:** free-text string, user-entered, no generated sequence, no uniqueness enforcement
  outside import-duplicate matching (see §2.2).
- **Pricing:** single `unitPrice: number`, no price tiers, no cost-price vs sell-price split.
- **Currency:** **none on the product itself.** `currency.ts`'s own comment confirms currency is
  carried per-_consuming_-record (Opportunity/Quote/Quota), defaulting to INR. The Products list
  and view screens hardcode the ₹ (`IndianRupee`) icon and `en-IN` number formatting regardless
  of what currency a deal using that product might actually be in — an **observed UI
  inconsistency in legacy**, not a feature to deliberately reproduce or silently "fix" without a
  decision (see §6, Risk R1).
- **Tax:** single `taxPercent: number?`, flat percentage, no tax-class/jurisdiction concept, no
  upper-bound validation.
- **Discount:** **not a product field.** Discount is per-line-item, entered when a product is
  added to a Deal (`AddDealProductsDialog.tsx`, clamped client-side to 0–100) — the catalog
  product itself carries no default or suggested discount.
- **Stock/quantity:** **absent (verified).** `CrmProduct` has no quantity-on-hand, reorder-point,
  or warehouse field of any kind — this is a price list, not an inventory system.
  `productsService.ts`'s own header comment states the CRM catalog is deliberately separate from
  the Sales module's `sales/products` table ("different owning module, no shared tax/stock
  model"). No link to SCM inventory exists either.

### 2.5 Permissions and role behavior (item 5)

- **View (list + detail):** anyone who can reach the CRM module at all — no additional gate on
  reading.
- **Create / Update / Archive (the `active` toggle):** `canManageProducts(user)`, which
  (`roles.ts:49-51`) is a direct delegation to `canManagePipelineConfig` — i.e. **CRM Admin or
  Sales Head only** (the same two-role gate already governing Pipeline Stage management and
  Opportunity-wide access in legacy).
- **Delete:** `isCrmAdmin(user)` only — strictly narrower than Create/Update, same split already
  established (and already simplified away once, for Lead/Contact/Opportunity/PipelineStage) in
  this production codebase's permission model, which has no separate "CRM Admin" role concept.
  The **Delete button itself is only rendered** for an admin (`Products.tsx:386`); a non-admin
  with `canManageProducts` sees Edit but not Delete.
- **Enforcement layer:** entirely client-side in legacy (no backend exists) — `isCrmAdmin`/
  `canManageProducts` gate which buttons render, and `deleteCrmProduct`'s own `usageCount` check
  is the only server-adjacent (still client-executed) enforcement.

### 2.6 Relationships and dependencies (item 6)

- **`CrmDealProduct`** (`domain/types.ts:486-503`): `opportunityId`, `productId`, a **snapshot**
  of `productName`/`unitPrice`/`taxPercent` taken at add-time (so a later product rename/price
  change never retroactively alters a historical deal line), `quantity`, `discountPercent?`,
  and a precomputed `total`. Written via `AddDealProductsDialog.tsx` → `addCrmDealProducts`,
  which inserts one row per selected product **sequentially, not atomically** (a mid-batch
  failure leaves the earlier rows written — `dealProductsService.ts:43-53`), followed by one
  `deal_product_added` audit entry. Lines can later be edited (`updateCrmDealProduct`) or removed
  (`removeCrmDealProduct` — a soft delete into the Recycle Bin, which takes the row _out_ of the
  live `crm/dealProducts` collection, so a removed line no longer counts toward its product's
  usage). **Production equivalent does not exist yet** — `Opportunity` in `schema.prisma` has
  no line-item relation at all today.
- **Quotation line items** (`CRM_QUOTATION_ITEMS_PATH = 'crm/quotationItems'`): referenced only
  by id/count in `Products.tsx`'s `usageCount` (`quotationItems.filter((qi) => qi.productId ===
productId)`); the full `CrmQuotationLineItem` shape lives in the Quotes module, not inspected
  line-by-line here since Quotes itself is out of scope. **Production equivalent does not exist
  yet** either (no Quotation model in `schema.prisma`).
- **Delete-block invariant:** `deleteCrmProduct` throws if `usageCount > 0`
  (`dealProducts.length + quotationItems.length` referencing this product). Today, in
  production, that count is _structurally always zero_ (neither referencing table exists), so
  implementing Products now cannot yet exercise this rule end-to-end — it becomes real once
  Opportunity line items (or Quotation line items) are added. The check should still be written
  now, against whichever reference table(s) exist at the time, so it isn't forgotten later.
- **Only-active-selectable rule:** both `AddDealProductsDialog` and `QuoteProductPicker` filter to
  `product.active === true` before listing — an inactive product cannot be newly attached to a
  deal or quote (existing line items keep their already-snapshotted data regardless).

### 2.7 Calculations and business rules (item 7)

From `dealProductsService.ts:21-28` (read in full for this audit), Products' only real
"calculation":

```
gross           = round2(quantity * unitPrice)
discountAmount  = round2(gross * (discountPercent / 100))
taxableAmount   = round2(gross - discountAmount)
taxAmount       = round2(taxableAmount * (taxPercent / 100))
total           = round2(taxableAmount + taxAmount)
```

Each step is rounded independently (not just the final total) — `round2` uses
`Math.round((n + Number.EPSILON) * 100) / 100` (`currency.ts:28-30`) to avoid classic
floating-point drift. The same function is used by the Deal Products tab and by `QuoteForm.tsx`'s
line table (verified: `QuoteForm.tsx:53` imports it, `:115` calls it), so both must
agree bit-for-bit on identical inputs — any Postgres re-implementation must preserve this exact
step order and rounding-per-step behavior, not just the final formula, or a deal's total and a
converted quote's total could silently diverge by a rounding cent.

**Edge cases confirmed from source:**

- `quantity` is clamped to a minimum of 1 in the add-to-deal picker (`Math.max(1, ...)`), but
  **not** in `CrmDealProduct`'s type itself — nothing stops a 0 or negative quantity from being
  written through any other path (there is only the one UI path, so this is a theoretical gap,
  not an observed bug).
- `discountPercent` is clamped 0–100 in the same picker.
- `taxPercent` has no clamp anywhere (could exceed 100 without rejection).
- No rule for what happens to an existing `CrmDealProduct`/quotation line item if the catalog
  product it was snapshotted from is later deactivated or deleted — by design, nothing happens
  (the snapshot is intentionally frozen).

### 2.8 UI layout, styling, screenshot-parity (item 8)

- List: a single `Card` with a gradient (`#4D9F4B → #72B84A → #9FCA48`) table header row, white
  body rows, `Package` icon in the card title, search input with a `brand`-colored focus ring,
  `ImportExportBar` and "Add Product" button in the header's right-hand cluster.
- Status badges: Active = emerald outline with a check icon; Inactive = slate outline with an X
  icon. Production's `ui-kit` `StatusBadge` (`success`/`gray` tokens, already used by
  `LeadList`/`PipelineBoard`) covers this directly.
- Row actions: View (blue outline), Edit (brand outline, gated), Delete (red outline, gated,
  admin-only) — all small (`h-8`) outline buttons with an icon + label.
- Create/Edit/View screens: a rounded-3xl white card with a `Package` icon badge, a 2-column
  form grid, and a second card below holding the Cancel/Save (or "Fields marked with * are
  required") footer — this exact two-card-stack layout is reused by every "inline page swap"
  screen in the legacy CRM, not specific to Products.
- No screenshot of the Products screen was available for this audit, so there is nothing to
  pixel-match against beyond the source code itself. Visual fidelity should target the same Tailwind-utility-class structure
  already established for Accounts/Contacts/Leads in the production Next.js app (card + table +
  form-field layout via `ui-kit`'s `Card`/`DataTable`/`FormField`), not a literal recreation of
  legacy's hand-written class strings.

### 2.9 Legacy Firebase data shapes (item 9, reference-only)

**Shapes, from source:**

- `crm/products` — flat collection, keyed by Firebase push id, shape = `CrmProduct` minus `id`.
- `crm/dealProducts` — flat collection (not nested under its opportunity), filtered client-side
  by `opportunityId`, the same pattern `contactsService.ts` uses for `accountId`.
- `crm/quotationItems` — flat collection, same filter-in-memory pattern (not read in depth; out
  of scope).

**Actual data, from the RTDB export (aggregate only, verified):**

- The export's `crm` node contains only `accounts`, `activities`, `auditLogs`,
  `coldCallingStatus`, `customFieldDefs`, `leads`, `notifications`. **`crm/products`,
  `crm/dealProducts` and `crm/quotationItems` do not exist in it at all.**
- Of the 40 entries in `crm/auditLogs`, **none** has a product-related action (no
  `product_created`/`_updated`/`_deleted`, no `deal_product_*`), so no product was ever created
  and later deleted either.
- `crm/customFieldDefs` defines custom fields only for `accountsMining` — none for products.
- **Consequence:** there is no legacy Product data to migrate, so nothing in Products'
  implementation needs a data-migration path, and decisions D1–D3 below cannot be informed by
  real-world data — they rest on the source code alone. (Side observation, outside Products'
  scope: the export also has no `opportunities`, `pipelineStages` or `contacts` nodes, though
  the audit log records one contact and one opportunity event — those records were presumably
  removed before the export was taken.)
- No Firebase project, credential, rule, or live database was accessed. The export file was only
  read, never modified.

---

## 3. Existing new-repository conventions reused for the mapping in §4 (item 11)

| Convention                                                                                         | Where established                                                                          | Applies to Product because                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org-wide reference data, no team dimension, plain `crm.<x>.read`/`.write` (no `.own/.team/.all`)   | `Account`, `PipelineStage`                                                                 | Product has no owner/assignee/team concept in legacy, same as Account and PipelineStage                                                                                                                                                                                                                                                                                                                                                                              |
| `Decimal @db.Decimal(14,2)` for money fields                                                       | `Opportunity.estimatedValue`/`closingAmount`                                               | `unitPrice` is money; legacy's bare `number` is a weaker type production already chose not to copy once                                                                                                                                                                                                                                                                                                                                                              |
| Soft-delete refused while referenced, enforced in the repository, not just the UI                  | `PipelineStage.softDelete` (refuses while any `Opportunity` has that `stageId`)            | Identical shape to Product's "refuse delete while `usageCount > 0`" rule                                                                                                                                                                                                                                                                                                                                                                                             |
| `.write` stands in for legacy's separate "CRM Admin only" delete gate                              | `crm.contact.write`, `crm.lead.write`, `crm.opportunity.write`, `crm.pipeline_stage.write` | Legacy's Product delete is `isCrmAdmin`-only, stricter than Create/Update's `canManageProducts` — same gap every other CRM entity already closed the same way                                                                                                                                                                                                                                                                                                        |
| `@@unique([organizationId, code])`                                                                 | `PipelineStage.code`                                                                       | Reusable for `Product.code` if D1 is adopted (legacy never enforced it — see Risk R2). **Only the constraint carries over, not `PipelineStage`'s collision-retry-with-timestamp-suffix:** that retry exists because a stage code is a slug _generated_ from its label, whereas a product code is a SKU the _user typed_ — silently rewriting it would be wrong. A collision should surface as a 409, the way `AccountsRepository` surfaces its own unique violations |
| Scaffold file shape: `dto/`, `<name>.repository.ts`, `.service.ts`, `.controller.ts`, `.module.ts` | every CRM module so far                                                                    | No deviation needed                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 4. Proposed PostgreSQL / Prisma mapping (item 10) — NOT YET IMPLEMENTED

```prisma
model Product {
  id             Int       @id @default(autoincrement())
  organizationId Int       @map("organization_id")
  name           String
  code           String
  category       String?
  vendor         String?
  unitPrice      Decimal   @db.Decimal(14, 2) @map("unit_price")
  taxPercent     Decimal?  @db.Decimal(5, 2) @map("tax_percent")
  description    String?
  isActive       Boolean   @default(true) @map("is_active")
  customFields   Json?     @map("custom_fields")
  createdBy      Int?      @map("created_by")
  updatedBy      Int?      @map("updated_by")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, code])
  @@index([organizationId])
  @@map("products")
  @@schema("crm")
}
```

No existing model is reusable for Product itself (it is a genuinely new catalog entity); the
_pattern_ is reused from `Account`/`PipelineStage` as shown in §3. The only change to an existing
model would be the standard `crmProducts Product[]` back-relation on `Organization` (the same kind
`Account`/`Contact`/`Lead`/`Opportunity` each added); no `Team` relation, since Product has no
team dimension.

**Field provenance:** every field above maps 1:1 to a `CrmProduct` field (`active` → `isActive`,
renamed to the repo's existing `isActive` convention), **except** `customFields`,
`organizationId`, `createdBy`/`updatedBy` (as integer user ids rather than legacy's display-name
strings), and `deletedAt`. Those are this repository's standard baseline columns (present on
`Account`/`Contact`/`Lead`/`Opportunity` alike), not legacy fields — in particular, legacy
`CrmProduct` has **no** `customFields`, and Products never used the custom-fields import feature
(§2.9). Dropping `customFields` from Product is equally defensible; it is included only to keep
the baseline uniform.

**Fields deliberately not modeled**, same "additive, add later" convention as every prior phase:

- No `dealProducts`/`quotationItems` relation on `Product` yet — those junction tables don't
  exist (see §2.6); add `OpportunityProduct`/`QuotationLineItem` (or similar) in whichever future
  phase implements the Opportunity Products tab or Quotes, each with its own `productId` FK and
  a snapshot of `name`/`unitPrice`/`taxPercent` at add-time, mirroring `CrmDealProduct` exactly.
- No currency field on `Product` — confirmed absent in legacy (§2.4); do not add one.

**Open decisions for the implementation phase (not resolved by this audit):**

- **D1 — `code` uniqueness:** legacy never enforces it on manual create/edit (§2.2). Recommend
  enforcing `@@unique([organizationId, code])` as a safety improvement (same category as every
  other "production is stronger" deviation already documented), surfaced as a 409 on collision
  (same `classifyDbError`/`ResourceConflictException` pattern `AccountsRepository` already uses)
  — but this is a product decision about whether two legitimately different lines ever
  legitimately share a code in practice, not something this audit can answer from source alone.
  What the audit _can_ say: the legacy export has zero product records (§2.9), so enforcing
  uniqueness would reject no existing data.
- **D2 — `taxPercent` type and range:** `Decimal(5,2)` (allows fractional rates) vs `Int`
  (nothing in legacy forbids a decimal, but nothing shows one either). Either is defensible;
  `Decimal` was chosen above for consistency with `Opportunity`'s money-adjacent fields, not
  because legacy requires fractional tax rates. Separately, legacy has **no upper bound** on
  `taxPercent` (§2.7); whether to add `@Max(100)` is a choice, not a parity requirement.
- **D3 — negative/zero `unitPrice`:** legacy has no server-side floor; recommend a DTO-level
  `@Min(0)` (same posture as every other money field already validated this way in production),
  which is stricter than legacy but consistent with the codebase's existing validation standard.
- **D4 — bulk import/export:** Products' own import/export is just an instance of the
  shared `ImportExportBar`/`FieldSchema` infra, which is itself still entirely unmigrated
  (flagged as a cross-cutting gap in `Docs/CRM_LEGACY_PARITY.md` §3). Recommend deferring
  Products' bulk import/export to whenever that shared infra is tackled, exactly as every other
  CRM entity audited so far has deferred it, rather than building a one-off import path.

---

## 5. UI-parity checklist

| Legacy element                                                  | Production target                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List table (gradient header, search, status badge, row actions) | `DataTable` + `StatusBadge` + `Input` search, same composition as `LeadList`/`ContactList`                                                                                                                                                                                                                                      |
| Create/Edit as a full inline page swap                          | Recommend a `Dialog`-based form instead, matching the CRM screens already built in production (`ContactList`, `LeadList` and `PipelineBoard` all render their forms inside a `ui-kit` `Dialog`) — a deliberate deviation from legacy's page-swap pattern, consistent with what production already does, not a new inconsistency |
| View-only detail screen                                         | Recommend folding into the Edit dialog (read-only until "Edit" is clicked) or a small `Dialog`-based drawer, same reasoning as above                                                                                                                                                                                            |
| Active/Inactive `Switch`                                        | `ui-kit` has no `Switch` component (checked — only `Checkbox` exists); recommend a `Checkbox` labeled "Active", consistent with `ContactForm`'s existing `isPrimary`/`isDecisionMaker` checkboxes, or add a `Switch` to `ui-kit` if visual parity with legacy's toggle justifies a new shared component                         |
| Admin-only Delete, manager-or-admin Edit/Create                 | `crm.product.write` (single tier, per the precedent in §3) gates Create/Update/Delete; document the collapsed admin-only-delete distinction the same way `contacts.controller.ts`'s comment already does                                                                                                                        |
| No sort, no filters, client-side pagination                     | Recommend real server-side pagination via the existing `PaginationDto`/`@Paginate()` convention (an improvement, not a parity requirement) — do not add sort/filter UI merely because other CRM screens have it; legacy genuinely has none for Products                                                                         |

---

## 6. Risks

- **R1 (currency display inconsistency):** legacy hardcodes ₹ for Products regardless of the
  currency a consuming Opportunity/Quote might use. Decide explicitly whether production's
  Product screens do the same (faithful) or show a currency-neutral format (defensible
  improvement) — do not silently pick one without noting it, since it's the kind of visible
  change a product owner may want to weigh in on.
- **R2 (code uniqueness):** see D1. Enforcing uniqueness where legacy never did is a behavior
  change (a legitimate duplicate-code import/create that legacy would have silently allowed will
  now be rejected). Low risk in practice (duplicate SKUs are almost always a data-entry mistake),
  but it is a change, not a strict parity copy.
- **R3 (vacuous delete-guard until Deal/Quote line items exist):** implementing the
  usage-count delete block now is correct-but-untestable-end-to-end until a line-item table
  exists; the test matrix below marks this explicitly rather than skipping it.
- **R4 (no screenshot):** nothing to pixel-verify against for Products specifically; visual
  review will need the running legacy app side-by-side.

---

## 7. Test matrix (for the implementation phase)

| Area                       | Case                                                                          | Expected                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Auth                       | Unauthenticated `GET /crm/products`                                           | 401                                                                                                  |
| Permission                 | No `crm.product.read`                                                         | 403 on read endpoints                                                                                |
| Permission                 | No `crm.product.write`                                                        | 403 on create/update/delete                                                                          |
| Validation                 | Missing `name`                                                                | 400                                                                                                  |
| Validation                 | Missing `code`                                                                | 400                                                                                                  |
| Validation                 | Negative `unitPrice`                                                          | 400 (D3)                                                                                             |
| Validation                 | Negative `taxPercent`; above 100 only if a `@Max(100)` bound is adopted (D2)  | 400                                                                                                  |
| Tenant isolation           | Org B reads/updates/deletes Org A's product by id                             | 404, not 403, row left unchanged (same convention as every prior CRM entity)                         |
| CRUD                       | Create → read → update → list reflects it                                     | 200/201 round-trip                                                                                   |
| Uniqueness (if D1 adopted) | Create with a `code` already used in the same org                             | 409                                                                                                  |
| Uniqueness (if D1 adopted) | Same `code` in two different orgs                                             | both succeed (scoped per `organizationId`)                                                           |
| Archive                    | Toggle `isActive` false via update                                            | reflected on read; does not soft-delete                                                              |
| Delete                     | Soft-delete an unreferenced product                                           | 204, row has `deletedAt` set, excluded from list                                                     |
| Delete                     | Soft-delete a product referenced by a line item (once that table exists — R3) | 422, refused with a business-rule error, same as `PipelineStage`'s "currently in this stage" refusal |
| Search                     | Query matches name/code/category/vendor substrings                            | filtered results only                                                                                |
| Scope                      | `.own`/`.team`/`.all`                                                         | **Not applicable** — Product has no team/owner dimension (§3), unlike Lead/Opportunity               |

---

## 8. Proposed bounded implementation plan (for approval, not started)

1. `Product` Prisma model + additive migration (§4), decisions D1–D3 resolved before writing it.
2. `crm.product.read`/`crm.product.write` permissions (non-scoped, §3/§5).
3. NestJS module: DTO (`CreateProductDto`/`UpdateProductDto`/`QueryProductDto`), repository
   (`OrgScoped`, same shape as `AccountsRepository`), service, controller, e2e tests per §7.
4. Next.js feature: list (`DataTable` + search + pagination), create/edit `Dialog` form, no
   sort/filter UI (§5).
5. **Explicitly out of scope for this slice:** `OpportunityProduct`/Deal-line-items,
   `QuotationLineItem`, the Opportunity "Products" tab, Quotes/Quotations entirely, and
   Products' own bulk import/export (D4) — each is its own future phase.

---

## 9. Verified vs. inferred — summary

**Verified by direct source reading** (all 13 files confirmed byte-identical to the original
legacy repo): every field and its default/required-ness; the complete create/edit/view/delete UI
flow; the exact permission gate split (Create/Update vs Delete); the usage-count delete-block
rule; that `code` uniqueness is not enforced on manual create/edit; the line-item money-math
formula and its per-step rounding; the sequential, non-atomic deal-line insert; the
active-only-selectable rule in both consumer pickers; the Firebase path names; the nav tab
position; the absence of sort/filter UI, stock fields, a currency field, category/vendor master
data, and SKU generation.

**Verified from the RTDB export (aggregate statistics only):** no product, deal-line or
quotation-line data exists; no product audit-log event ever occurred; no product custom fields
are defined.

**Inferred / recommended, not verified against legacy (because legacy has no backend to
verify a "should" against):** D1 (code uniqueness), D2 (taxPercent type and range), D3
(unitPrice floor), D4 (import/export deferral), the inclusion of the repo-baseline
`customFields` column (§4), and the Dialog-vs-page-swap UI recommendation in §5. Each is called
out explicitly above rather than presented as if legacy required it.

**No assumption was made about fields or functionality a "typical" product catalog might have
(images, variants, stock, barcodes, multi-currency pricing) — all were checked for and confirmed
absent, not merely omitted for convenience.**
