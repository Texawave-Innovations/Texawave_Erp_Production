# Sales Settings / Sales & Document Masters — backend foundation

**Status:** Backend foundation landed (this doc). Frontend landed
(`apps/ui/src/features/sales-settings/`, `apps/ui/src/app/(dashboard)/settings/sales-settings/`).
Test coverage landed: one `*.service.spec.ts` per service, a backend e2e
spec (`apps/api/test/sales-settings.e2e-spec.ts`), and a UI e2e spec
(`apps/ui/e2e/sales-settings.spec.ts`) — see "Tests" below.

**Owner:** repository maintainers — assign a named owner before further work.

This is the backend for the three tabs/modules shown in the "Sales &
Document Masters" screens: **Sales Settings** (Company / Numbering / Bank &
Signatory / Salespersons), **Seals & Signatures**, and **Terms & Inventory**.
Read this before building the Sales or SCM modules that will reference these
masters, and before building the frontend for this screen.

## Where the code lives

```
apps/api/src/modules/sales-settings/
  sales-settings.module.ts         — one Nest module, 8 controllers (see below)
  sales-settings.constants.ts      — SealSignatureKind, SalesMasterListCategory, SalesDocumentType enums
  company-detail.{controller,service,repository}.ts
  authorized-signatory.{controller,service,repository}.ts
  bank-accounts.{controller,service,repository}.ts
  salespersons.{controller,service,repository}.ts
  seal-signatures.repository.ts            — shared by both masterlists
  seal-signatures.service.ts               — generic; kind/noun fixed by subclass
  company-seals.{controller,service}.ts    — extends SealSignaturesService(kind="seal")
  authorized-signatures.{controller,service}.ts — extends SealSignaturesService(kind="signature")
  master-list-items.{controller,service,repository}.ts — generic; category passed per-request
  document-numbering.{controller,service,repository}.ts
  dto/*.ts
```

Every resource follows Docs/CODING_STANDARDS.md §3's
controller → service → repository shape (same pattern as
`apps/api/src/modules/_reference/tags/`): the repository is the only place
`PrismaService` is called, every repository method is `@OrgScoped()`, all
filters go through `tenantWhere()`.

Registered in `app.module.ts` as `SalesSettingsModule`. Permissions are in
`packages/database/prisma/permissions/catalog.ts` under the
`sales_settings.*` prefix (see "Permissions" below).

## Prisma models (migration `20261015055453_add_sales_settings_foundation`)

New tables, all in a new `sales` Postgres schema
(`packages/database/prisma/schema.prisma`, §"Sales Settings... foundation"):

| Model                 | Table                     | Shape                                   | UI tab                            |
| --------------------- | ------------------------- | --------------------------------------- | --------------------------------- |
| `CompanyDetail`       | `company_details`         | 1 row per org (`organizationId` unique) | Company                           |
| `BankAccount`         | `bank_accounts`           | list                                    | Bank & Signatory (bank half)      |
| `AuthorizedSignatory` | `authorized_signatories`  | 1 row per org (`organizationId` unique) | Bank & Signatory (signatory half) |
| `Salesperson`         | `salespersons`            | list                                    | Salespersons                      |
| `SealSignature`       | `seal_signatures`         | list, `kind` ∈ `seal` \| `signature`    | Seals & Signatures                |
| `SalesMasterListItem` | `sales_master_list_items` | list, `category` ∈ 8 values (below)     | Terms & Inventory                 |

**Document numbering does not get a new table.** It reuses the existing
`DocumentSequence` / `document_sequences` table (already used by HR employee
codes, `docType = 'employee'`). This foundation only adds 8 new `docType`
string values — see `SALES_DOCUMENT_TYPES` in `sales-settings.constants.ts`:
`quotation`, `sales_order`, `packing_list`, `invoice`, `delivery_challan`,
`credit_note`, `retainer_invoice`, `payment_receipt`.

### Design decisions a reviewer/teammate should know about

1. **`SealSignature` is one table for both masterlists**, not two, because
   the UI shows them as the same shape (title + image data URI + delete
   icon) with one field difference (`signatoryName`/`designation` only
   apply to `kind = 'signature'`). `imageDataUri` is a `Text` column storing
   the base64 data URI as uploaded — there is **no file-storage integration**
   here (contrast `apps/api/src/shared/file-storage/`); if a future PR wants
   actual file storage instead of inline base64, that's a deliberate,
   separate migration, not a drop-in swap.
2. **`SalesMasterListItem` is one generic table for all 8 Terms & Inventory
   cards**, not 8 separate tables, and it does **not** reuse HR's
   `master-data/shared/{MasterDataService,MasterDataRepository}` base (the
   code+name, unique-per-org pattern used by Designations/Shifts/Employment
   Types). That base enforces name/code uniqueness; the reference
   screenshots show two identical `"9%"` GST Rate entries, so uniqueness is
   the wrong rule here — these are unstructured value lists, not lookup
   codes. `numericValue` is populated for `category = gst_rate` (the
   percentage) and left `null` for the other 7 categories.
3. **A future Sales/SCM module must reference these rows by `id`**, never
   copy the `value`/`name` text onto its own rows. E.g. a quotation line
   item's GST rate should store `gstRateId: number` pointing at a
   `SalesMasterListItem` row (`category = 'gst_rate'`), not a copied
   percentage string — same rule as any other FK in this codebase.
4. **Company Details is a new table, not new columns on `Organization`.**
   `Organization` stays minimal (tenancy root); org-wide business-profile
   data (name shown on documents, GSTIN, logo, etc.) lives in
   `CompanyDetail`, 1:1 via a unique `organizationId`.
5. **Authorized Signatory is a singleton** (`organizationId` unique), not a
   list — the UI shows one Name/Designation form, unlike `Salesperson`
   (list) or the Seal/Signature masterlists (list). `PUT` always
   upserts — there is no create/delete route for it or for `CompanyDetail`.

## Known pre-existing drift — read before adding more masters

Running `permissions:sync` against the local dev database surfaced **24
orphaned permissions** already present in the DB but absent from the
committed `catalog.ts` and from any module in this codebase:

```
master.payment_term.{read,write}       master.item_group.{read,write}
master.delivery_term.{read,write}      master.raw_material_category.{read,write}
master.dispatch_mode.{read,write}      master.uom.{read,write}
master.gst_rate.{read,write}           master.stock_location.{read,write}
master.item_category.{read,write}      master.expense_type.{read,write}
master.item_type.{read,write}          master.payment_mode.{read,write}
```

These came from a migration (`20261014121833_add_sales_stores_finance_master_lists`)
that was applied to the local dev database at some point but was **never
committed** — no migration file exists in git on any branch, and no
`sales`/`stores`/`finance` schema or tables actually exist in the database
today. It was stray local-only bookkeeping (resolved via
`prisma migrate resolve` before this foundation's own migration could run,
not a data loss — no tables existed to lose).

The permission names imply **someone already sketched a different, broader
design**: separate code+name tables per type (`master.*` naming, matching
HR's `master-data` module convention) covering not just Sales Terms &
Inventory but also Stores (raw materials, stock locations, UOM) and Finance
(expense types, payment modes). That design was never merged. If you're
building Stores or Finance masters next, **check with the team before
re-doing this work** — reconcile with whatever that attempt intended rather
than inventing a third shape. `permissions:sync` leaves these 24 orphaned
rows untouched (never deletes/retires them unilaterally); only retire them
via `RETIRED_PERMISSIONS` in `catalog.ts` once you've confirmed with the
team they're genuinely superseded by `sales_settings.master_list_item.*`.

## Permissions

All `sales_settings.*`, org-scoped + `@RequirePermission()` only — **no**
`@TeamScoped()` (this is org-wide configuration, not team-owned data,
Docs/CODING_STANDARDS.md §10a):

```
sales_settings.company_detail.{read,write}
sales_settings.document_numbering.{read,write}
sales_settings.bank_account.{read,write}
sales_settings.authorized_signatory.{read,write}
sales_settings.salesperson.{read,write}
sales_settings.seal_signature.{read,write}        — covers BOTH masterlists
sales_settings.master_list_item.{read,write}      — covers ALL 8 categories
```

Grant these to a role via Settings → Roles before testing any endpoint —
every route 403s without it. `permissions:sync` has already been run against
the local dev database for this change.

## API reference

All routes are relative to the API base path, authenticated, org-scoped.

| Tab                | Method & path                                                                                  | Notes                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Company            | `GET /sales-settings/company-detail`                                                           | Returns `null` if unsaved, not 404                                                        |
| Company            | `PUT /sales-settings/company-detail`                                                           | Upsert                                                                                    |
| Numbering          | `GET /sales-settings/document-numbering`                                                       | Always returns all 8 `SALES_DOCUMENT_TYPES`, synthesizing defaults for ones not yet saved |
| Numbering          | `PUT /sales-settings/document-numbering/:docType`                                              | Upsert prefix/padding; `nextNumber` untouched                                             |
| Bank & Signatory   | `GET/POST /sales-settings/bank-accounts`, `GET/PATCH/DELETE /sales-settings/bank-accounts/:id` | Standard paginated CRUD                                                                   |
| Bank & Signatory   | `GET /sales-settings/authorized-signatory`, `PUT /sales-settings/authorized-signatory`         | Singleton, like Company                                                                   |
| Salespersons       | `GET/POST /sales-settings/salespersons`, `GET/PATCH/DELETE /sales-settings/salespersons/:id`   | Standard paginated CRUD                                                                   |
| Seals & Signatures | `GET/POST /sales-settings/company-seals`, `.../:id`                                            | `kind = 'seal'` fixed server-side                                                         |
| Seals & Signatures | `GET/POST /sales-settings/authorized-signatures`, `.../:id`                                    | `kind = 'signature'` fixed server-side                                                    |
| Terms & Inventory  | `GET /sales-settings/master-list-items?category=<cat>&page=&limit=`                            | `category` required                                                                       |
| Terms & Inventory  | `POST/PATCH/DELETE /sales-settings/master-list-items[/:id]`                                    | `category` set on create, immutable after                                                 |

`SalesMasterListCategory` values for the `category` param/field:
`payment_term`, `delivery_term`, `dispatch_mode`, `gst_rate`,
`item_category`, `item_type`, `item_group`, `unit`.

## How a future Sales/SCM module should connect to this

- **Document numbering**: when creating a Quotation/SO/Invoice/etc., read the
  matching `DocumentSequence` row for the org (`docType` = one of
  `SALES_DOCUMENT_TYPES`) **inside the same transaction** that inserts the
  document, increment `nextNumber`, and format
  `prefix + String(number).padStart(padding, "0")` — same pattern already
  used by HR employee codes (`Docs/ARCHITECTURE.md` §5.3). Don't build a
  second numbering mechanism.
- **GST rate / payment term / delivery term / dispatch mode / item
  category/type/group / unit on a document line or header**: store the
  `SalesMasterListItem.id` as a foreign key column (e.g. `gstRateId`,
  `paymentTermId`), filtered by the right `category` when populating a
  dropdown. Never copy the `value` string.
- **Bank account / authorized signatory / company seal / signature on a
  printed document**: reference by `id` the same way (e.g.
  `invoice.bankAccountId`, `invoice.sealId`), resolved at render time — don't
  duplicate the data onto the document row.
- **Salesperson** on a quotation/order: `salespersonId` FK, same pattern.

## Tests

- **Unit** — one `apps/api/src/modules/sales-settings/<resource>.service.spec.ts`
  per service (company-detail, document-numbering, bank-accounts,
  authorized-signatory, salespersons, seal-signatures, master-list-items),
  following the `_reference/tags` pattern (construct the class directly with
  `vi.fn()` repository/tenant-context doubles, no Nest testing module, no
  DB). Covers: tenant-scope passthrough, pagination wrapping,
  `ResourceNotFoundException` on a missing/foreign row, the two
  singletons (`CompanyDetail`/`AuthorizedSignatory`) returning `null` instead
  of throwing, `DocumentNumberingService` synthesizing defaults for
  unconfigured `docType`s and rejecting an unknown one with
  `BadRequestException`, and `SealSignaturesService` threading its
  constructor-fixed `kind`/`noun` into every repository call and error.
- **Backend e2e** — `apps/api/test/sales-settings.e2e-spec.ts`, modeled on
  `reference-tags.e2e-spec.ts`: two seeded orgs, 401/403, full CRUD/upsert
  round trips for all 8 resources, whitelist 400s (including the immutable
  `category` field on master list item update), and tenant isolation via 404
  (not just list-filtering) for every non-singleton resource plus the
  singletons' "never leaks to another org" check.
- **UI e2e** — `apps/ui/e2e/sales-settings.spec.ts`, modeled on
  `hr-payroll-settings.spec.ts`: fully mocked API (`signInWithMockedApi`),
  proves the three top-level tabs render and the Company Detail form sends
  only its declared fields and shows a success toast — the backend's own
  rules stay proven by the e2e spec above, not re-asserted here.

## What's deliberately NOT done yet

- No activate/deactivate (soft delete only, via the standard
  `DELETE` → `deletedAt` pattern) — none of these resources showed an
  activate/deactivate control in the reference screenshots.
- The 24 orphaned `master.*` permissions above are untouched, not
  reconciled — see "Known pre-existing drift".
