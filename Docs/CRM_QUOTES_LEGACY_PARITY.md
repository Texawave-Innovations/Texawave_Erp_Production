# CRM Quotes / Quotations — Legacy Parity Audit

**Status:** Audit only. No schema, permission, backend, or frontend code was written for Quotes
in this pass. No file outside this document was changed. Products and Opportunities (including
`OpportunityProduct` deal line items) are already migrated and are the direct dependency/precedent
for this module — **audit completion does not authorize implementation.**
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP`. Not modified.
**Production source:** `D:\New folder\Texawave_Erp_Production`, branch `feature/HR`. Not modified
(this document is the only new file).
**Methodology:** same as `Docs/CRM_PRODUCTS_LEGACY_PARITY.md`. _Confirmed_ = read directly in
legacy source. _Absent (verified)_ = actively checked for and not found. _Open decision_ = a
choice the implementation phase must make, not a legacy behavior to copy.

---

## 0. Files inspected

**Legacy, inside the copied reference tree** (`apps/api/src/modules/crm/`, confirmed
byte-identical to `TexaWave_ERP` via `diff -q` for every file below except the one noted as
missing from the copy):

- `QuoteForm.tsx` (815 lines, read in full) — create/edit/view page (one route serves all three;
  legacy has no separate read-only detail screen — see §1.3).
- `Quotes.tsx` (222 lines, read in full) — the global Quotes list.
- `domain/quotationsService.ts` (118 lines, read in full) — CRUD, status-change audit, the
  replace-all line-item writer.
- `domain/QuoteProductPicker.tsx` (70 lines, read in full during the Products audit) — single-select
  combobox, reused here as the line-item product picker.
- `domain/types.ts` lines 381–462 — `CrmQuotationStatus`, `CrmQuotation`, `CrmQuotationInput`,
  `CrmQuotationLineItem`.
- `domain/currency.ts` (read in full during the Products audit) — `QUOTATION_STATUS_STYLE`,
  `formatMoney`, `round2`, `formatMultiCurrencyTotal`.
- `domain/config.ts` lines 190–195 — `CRM_QUOTATIONS_PATH`, `CRM_QUOTATION_ITEMS_PATH`.
- `domain/roles.ts` (read in full during the Leads audit) — re-checked: **no `canManageQuotes`
  function exists anywhere in this file** (see §4).
- `DealDetail.tsx` lines 253–285 — the Opportunity's "Quotes" tab (read-only list +
  admin-delete + "New Quote" link).
- `CRMLayout.tsx` (read in full during the Products audit) — nav entry: label "Quotation", icon
  `Receipt`, route `/crm/quotes`.

**Legacy, NOT inside the copied reference tree — read directly from `TexaWave_ERP` (read-only,
never written to):**

- `src/components/QuotationPrintTemplate.tsx` (861 lines). **This file was missed by the
  original wholesale copy of `src/modules/crm/` into the new repo's reference tree** — it lives
  at `src/components/`, one level up, because it is also reachable from the (separate, unrelated)
  Sales module's own quotation screens. It was read directly from the legacy repo for this audit;
  nothing was copied or written anywhere. Confirmed purely presentational — grepped for
  `pdf|PDF|email|Email|download|window.print` inside it and found zero matches; the actual
  print mechanism lives in `QuoteForm.tsx` (see §1.6).

**Legacy data export** (read-only, aggregate statistics only, same method as the Products audit):
`texa-erp-aug-default-rtdb-export.json` parsed by a script printing only node names, key sets,
counts, and booleans. Findings in §1.8.

**New repository (read, not modified) — conventions and dependencies reused for §6:**

- `packages/database/prisma/schema.prisma` — `Account`, `Contact`, `Opportunity`, `Product`,
  `OpportunityProduct` models (all already migrated).
- `packages/database/prisma/permissions/catalog.ts` — the `crm.product.*` (org-wide, non-scoped)
  vs `crm.opportunity.*`/`crm.lead.*` (`.own/.team/.all`) permission shapes.
- `apps/api/src/modules/crm/shared/money.ts` — the already-ported `round2`/`computeLineBreakdown`
  (see §2.4 for why this file, not a new one, is the reuse target).
- `apps/api/src/modules/crm/opportunities/opportunity-products.repository.ts` — the existing
  line-item (`OpportunityProduct`) pattern: snapshot-at-add-time, per-line `@TeamScoped()` access
  following the parent record.
- `apps/api/src/modules/crm/products/products.repository.ts` — the existing
  usage-count delete-guard (`Docs/CRM_PRODUCTS_LEGACY_PARITY.md` Risk R3 already flags that it
  cannot yet see quotation references — this audit is the other half of closing that gap).
- `Docs/CRM_PRODUCTS_LEGACY_PARITY.md`, `Docs/CRM_LEGACY_PARITY.md` — process/format precedent.

**Not implemented, not modified, during this audit:** no Prisma model, migration, permission,
controller, DTO, or UI component was added. `git status` on both repos is unchanged from before
this audit (verified in §8).

---

## 1. Page / component / source inventory (deliverable item 1) and business rules (item 2)

### 1.1 Navigation and routes

- One nav tab: "Quotation" (`Receipt` icon), route `/crm/quotes` (`CRMLayout.tsx`).
- `/crm/quotes` → `Quotes.tsx` (list).
- `/crm/quotes/new` → `QuoteForm.tsx` in create mode. Accepts `?accountId=&dealId=` query params
  to preselect Account/Deal (used by the "New Quote" link from a Deal's Quotes tab —
  `DealDetail.tsx:255`).
- `/crm/quotes/:quotationId/edit` → `QuoteForm.tsx` in edit mode. **Also the only "view" route** —
  `Quotes.tsx`'s "View" and "Edit" row buttons navigate to the identical URL (`Quotes.tsx:188,197`
  are the same `navigate()` call). Confirmed in `QuoteForm.tsx`'s own header comment: "the CRM has
  no separate read-only record page pattern... a saved quote is both viewed and edited from this
  same route."

### 1.2 List view (`Quotes.tsx`)

- Table columns: Quote #, Account, Deal, Status (badge), Valid Until, Grand Total, Action.
- Search: substring, case-insensitive, across `quotationNumber`/`subject`/account name
  (`Quotes.tsx:82`).
- **Filter: a Status dropdown (All + the 5 statuses) — Quotes HAS a status filter**, unlike
  Products (verified absent there) and unlike Leads' many filters (verified absent for most of
  them). This is specific to Quotes.
- **Sorting: absent (verified)** — no clickable/sortable column headers.
- **Pagination: client-side only** (`usePagination`, same convention as every other CRM list).
- Row click anywhere, "View", or "Edit" all navigate to the same edit route (§1.1).
- Delete: `isCrmAdmin`-only, via `DeleteConfirmDialog` (see §1.5).
- Bulk import/export: see §1.7.
- Amount column reads `quote.grandTotal ?? quote.amount` — the fallback exists for quotes saved
  before the line-item/grandTotal system existed; `amount` is the older, simpler total.

### 1.3 Create/Edit/View (`QuoteForm.tsx`)

One component, three roles. Hydration: in edit mode, header fields are set from the existing
record once it and its line items have both arrived (`hydrated` flag, `QuoteForm.tsx:174-215`);
line items are only loaded once a quote is actually opened (confirmed in `Quotes.tsx`'s own
comment: "line items... are only loaded when a quote is opened for edit, not in this list").

**Selecting a Deal** (optional) auto-fills the quote's `contactId` and `currency` from that
Opportunity, both on initial URL-param preselect and on manual reselect (`QuoteForm.tsx:220-235`).
The Deal dropdown itself is pre-filtered to `opportunities.filter(o => o.accountId === accountId
&& o.status === 'OPEN')` (`:238`) — **only OPEN deals of the already-selected account are
selectable, enforced client-side only** (no server exists to enforce it any other way).
Changing Account clears both Contact and Deal (`:529`).

**Fields** (from `CrmQuotation`, `domain/types.ts:383-436`, cross-checked against the form at
`QuoteForm.tsx:526-740`):

| Field                                                                  | Required?                               | Notes                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `accountId`                                                            | **Yes** (validated, `errors.accountId`) | Select from all accounts                                                        |
| `opportunityId`                                                        | No                                      | Optional; see Deal-filter rule above                                            |
| `contactId`                                                            | No                                      | Select filtered to the selected account's contacts                              |
| `subject`                                                              | **Yes** (validated, non-empty trimmed)  | —                                                                               |
| `status`                                                               | —                                       | Defaults `'Draft'`; freely settable via dropdown at any time (see §1.4)         |
| `quoteOwner`                                                           | No                                      | Free text, defaults to the current user's display name                          |
| `currency`                                                             | No                                      | One of a hardcoded 5: INR/USD/EUR/GBP/AED (`QuoteForm.tsx:64-70`); defaults INR |
| `quoteDate`                                                            | No                                      | Defaults today                                                                  |
| `validUntil`                                                           | **Yes** (validated)                     | Must be `>= quoteDate` (`:264`); defaults today+30 days                         |
| `customerReference`                                                    | No                                      | Free text ("Customer PO / Reference")                                           |
| billing/shipping (5 fields each: street/city/state/postalCode/country) | No                                      | A "Copy Billing to Shipping" button exists (`:344`); no reverse button          |
| `carrier`, `deliveryNotes`                                             | No                                      | Free text                                                                       |
| `termsConditions`, `paymentTerms`, `deliveryTerms`, `notes`            | No                                      | Free text/textarea                                                              |
| `adjustment`                                                           | No, defaults 0                          | Manual +/- number applied after tax, before grand total                         |

**Line items** (`DraftLine` in-memory shape, `CrmQuotationLineItem` persisted shape):

| Field                                           | Editable how                                                  | Notes                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`/`productCode`                       | Set only via `QuoteProductPicker`                             | Picking a product also sets `description`/`listPrice`/`unitPrice`/`taxPercent` from it (`setLineProduct`, `:331-340`) — but **a line can exist with no product at all**, just free-text `description` (validation accepts either)             |
| `description`                                   | Free-text `Input`, always editable                            | Pre-filled from `product.description \|\| product.name` on pick, but independently editable after — can diverge from the product                                                                                                              |
| `quantity`                                      | Numeric `Input`, clamped to a minimum of 1 on every keystroke | —                                                                                                                                                                                                                                             |
| `uom`                                           | Free-text `Input`, placeholder "Nos"                          | Unit of measure                                                                                                                                                                                                                               |
| `listPrice`                                     | **Read-only display** (`formatMoney`, not an `Input`)         | The catalog price at pick-time, for reference only                                                                                                                                                                                            |
| `unitPrice`                                     | **Editable `Input`, min 0, no max**                           | **Confirmed: this is a genuine manual price override** — the user can quote a different price than the catalog, unlike `OpportunityProduct`'s frozen-snapshot-only model. This is the single biggest behavioral difference from Deal Products |
| `discountPercent`                               | Editable, clamped 0–100                                       | Same clamp as `OpportunityProduct`                                                                                                                                                                                                            |
| `taxPercent`                                    | Editable, min 0, **no upper bound**                           | Same as Product's own unbounded tax                                                                                                                                                                                                           |
| `discountAmount`, `taxAmount`, `amount` (total) | Computed, not entered                                         | Via `computeLineBreakdown` (see §2)                                                                                                                                                                                                           |

A row can always be removed except when it is the only row (`lines.length === 1` disables the
button, `:729`) — but the validation rule (§1.4) means an all-empty single row still fails submit.

### 1.4 Status lifecycle (deliverable item 3, partially — full mapping in §3)

`CrmQuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'`
(`domain/types.ts:381`).

**Verified: there is NO transition guard of any kind.** The Status `<Select>` offers all 5 values
at all times (`QuoteForm.tsx:599-602`); any value can be chosen from any current value and saved.
There is no "Accepted quotes can't go back to Draft" rule, no required-reason-for-Rejected field,
no expiry-date-driven auto-transition to `Expired` (nothing reads `validUntil` to flip status —
confirmed by grep: no code path sets `status: 'Expired'` automatically anywhere).

Three save actions, not one (`handleSave(mode)`, `:370-473`):

- **"Save Draft"** — forces `finalStatus = 'Draft'` regardless of what the dropdown shows.
- **"Save Changes" / "Create Quote"** — uses whatever the Status dropdown currently shows.
- **"Save & New"** — same as above, then resets the entire form and navigates to `/crm/quotes/new`.

A status **change** (vs. the general save) gets its own additional audit entry
(`changeCrmQuotationStatus`, `quotationsService.ts:36-56`) — on create, only if the brand-new
quote isn't `Draft`; on update, only if `existing.status !== finalStatus`. That function also
silently logs a `Proposal`-type CRM activity against the linked Opportunity (or Account, if no
Opportunity) — part of the same cross-entity "activity feed" infrastructure already flagged as
unmigrated in `Docs/CRM_LEGACY_PARITY.md` (Lead's Rating/Touched columns, same gap).

**Verified absent — do not invent:**

- No revision/version history of any kind (no "v2", no snapshot-on-status-change, no diff view).
- No approval workflow (no approver field, no multi-step sign-off).
- No "Convert to Sales Order" or any Sales-module integration beyond the single never-populated
  `linkedSalesQuotationId` forward-compat field (`domain/types.ts:395`; `quotationsService.ts:1-4`
  explicitly says "never populated automatically").
- No customer-facing accept/reject action (no public link, no portal) — status is changed only by
  an internal CRM user editing the dropdown.
- No duplicate/"Clone Quote" action.

### 1.5 Delete

`deleteCrmQuotation` (`quotationsService.ts:58-64`): soft-delete via
`softDeleteCrmRecordWithRelated`, cascading to the quote's own line-item sub-tree
(`{ items: '${CRM_QUOTATION_ITEMS_PATH}/${id}' }`) in the same call — same cascade-and-recycle
pattern already used for `Opportunity`'s stage history. `isCrmAdmin`-only, exactly like Products'
delete gate — **confirmed the only permission check anywhere in Quotes/QuoteForm is `isCrmAdmin`
on Delete** (grep for `canManage|isCrmAdmin` in both files returns only the two Delete-button
guards). The confirm dialog's own copy states explicitly: "the linked Account, Contact, Deal, and
Products are never affected."

### 1.6 Print / PDF / email (deliverable item 1/UI)

**Verified: there is no PDF generation and no email feature of any kind.** "Print / PDF"
(`handlePrint`, `QuoteForm.tsx:299-325`) opens a new browser window, writes the
`QuotationPrintTemplate` component's rendered HTML into it verbatim with print-specific CSS
(`@page { size: A4 portrait; }`), and calls the browser's native `window.print()` after a 250ms
delay, then closes the popup. There is no PDF library (no jsPDF/html2canvas/puppeteer), no
server-side rendering, and no "Email this quote" button or mailto link anywhere — "Contact Email"
in the form is a read-only display field, not a send action. A user can "Save as PDF" only via
their own browser's native print dialog, which is outside the application's control.

`QuotationPrintTemplate.tsx` (861 lines, read directly from the legacy repo — see §0) renders: a
letterhead, Quote #/date/validity, customer billing/shipping blocks, a line-item table
(S.No/description/qty/unit rate/net amount — note it uses `unitRate`/`netAmount`, not the same
field names as `CrmQuotationLineItem`; `QuoteForm.tsx:286-297` maps between the two), a totals
block (subtotal/tax/round-off/grand total — "round-off" is computed as
`grandTotal - subtotal - totalTax + totalDiscount`, i.e. whatever residual the adjustment/rounding
produces, not a separate stored field), payment/delivery terms, and terms & conditions text.

### 1.7 Bulk import/export

Same shared `ImportExportBar`/`FieldSchema` infrastructure as Products (still entirely
unmigrated — `Docs/CRM_LEGACY_PARITY.md` §3). Quote-specific behavior, verified:

- Export fields: quotationNumber, accountId (exported as account name, re-imported via
  case-insensitive name lookup), opportunityId (same pattern, by deal title), subject, status,
  validUntil, quoteDate, currency, amount, quoteOwner, customerReference, paymentTerms,
  deliveryTerms, carrier, notes.
- Duplicate detection key: `quotationNumber`, case-insensitive trim match (`Quotes.tsx:133-139`),
  same convention as Product's `code` matching.
- **Explicit, UI-stated limitation: bulk import creates/updates HEADER fields only — line items
  are never touched by import.** The `ImportExportBar`'s own `helperNote` prop states this
  verbatim: "Bulk Import creates quote header details only... Line items are not supported here —
  open the quote afterward to add products, so existing quote/line-item data is never corrupted."

### 1.8 Legacy data (reference-only, aggregate statistics)

The RTDB export's `crm` node contains `accounts`, `activities`, `auditLogs`,
`coldCallingStatus`, `customFieldDefs`, `leads`, `notifications` only —
**`crm/quotations` and `crm/quotationItems` do not exist in it**, and none of the 40
`crm/auditLogs` entries is quotation-related (no `quotation_created`/`_updated`/
`_status_changed`/`_deleted`/`_items_updated`). Same "clean slate" finding as the Products audit:
there is no legacy Quotes data to migrate, and the implementation's open decisions below cannot be
informed by real-world data, only by source code. No Firebase project, credential, rule, or live
database was accessed; the export file was only read.

---

## 2. Calculations and business rules (deliverable item 2, financial detail)

### 2.1 Per-line breakdown — direct reuse target confirmed

`computeLine()` (`QuoteForm.tsx:114-116`) calls `computeLineBreakdown` **imported from
`./domain/dealProductsService`** — i.e., legacy's Quotes module already reuses the exact same
function Deal Products uses, not a re-derived copy. This is the direct, already-verified basis
for the task's instruction to reuse `apps/api/src/modules/crm/shared/money.ts`: that file is
already the ported form of this exact function (ported during the Products implementation
specifically so a future Quotes phase could import it — see that file's own doc comment). **No
new financial logic needs to be derived; `computeLineBreakdown` from `shared/money.ts` is a
straight import for quote line items too.**

### 2.2 Aggregate totals — a SECOND, separately-duplicated `round2`

`QuoteForm.tsx:72-74` defines its **own local `round2`**, byte-identical to the one in
`domain/currency.ts` (which `shared/money.ts` already ports) and to `dealProductsService.ts`'s.
This is legacy's own internal duplication (three copies of the same 2-line function across the
codebase), not something introduced by this audit. The aggregate computation (`QuoteForm.tsx:242-257`):

```
subtotal      = round2(Σ line.gross)            // sum of every line's pre-discount gross
totalDiscount = round2(Σ line.discountAmount)
totalTax      = round2(Σ line.taxAmount)
grandTotal    = round2(subtotal - totalDiscount + totalTax + adjustment)
```

Each line's `gross`/`discountAmount`/`taxAmount` is itself already rounded once (via
`computeLineBreakdown`'s own internal `round2` calls), and the sums above are rounded again. **A
faithful port must reuse `round2` from `shared/money.ts` for this aggregate step too** — importing
the one function for both the per-line and per-aggregate rounding, rather than reproducing
`QuoteForm.tsx`'s own local copy, is a one-line simplification already consistent with
`shared/money.ts`'s stated purpose ("do not duplicate or change this").

### 2.3 What is cached vs. recomputed

Legacy's `CrmQuotation.subtotal`/`totalDiscount`/`totalTax`/`adjustment`/`grandTotal`/`amount` are
**written by the client on every save** (`setCrmQuotationItems`, `quotationsService.ts:98-118`) —
there is no server to recompute them, so the client's math is trusted. **Open decision D4 (§7)**:
production has a real server, so it can (and per this codebase's established posture on financial
data, arguably should) recompute these from the submitted line items server-side rather than
trust client-submitted totals — the same posture already taken for `Opportunity`/`Product`
pricing fields (DTOs validate, the server computes `OpportunityProduct.total`, never trusting a
client-submitted total). This is flagged as a decision, not decided here.

### 2.4 Line-item persistence model — "replace all," not row-by-row CRUD

**Verified, and a real structural difference from `OpportunityProduct`:** `setCrmQuotationItems`
takes the ENTIRE line-item array and writes it as one unit (`ref.set(...)`, overwriting whatever
was there), simultaneously updating the quotation header's cached totals. There is no per-line
add/update/remove operation anywhere for quote items — the UI's add/remove/edit buttons all only
mutate local `DraftLine[]` state; nothing is persisted until the whole-form Save. This is the
opposite of `OpportunityProduct`'s model (individual `POST`/`PATCH`/`DELETE` per line, each
persisted immediately). **Open decision D2 (§7)** is whether production's Quotes API should
replicate this "replace-all on save" shape (one endpoint, matching the actual UI interaction) or
adopt `OpportunityProduct`'s incremental-CRUD shape (already-established pattern, but a UX change
from legacy's single-Save-button model).

---

## 3. Lifecycle and relationship mapping (deliverable item 3)

```
Account (required)
  └─ Opportunity (optional, must be the account's own OPEN deal — UI-enforced only)
       └─ Quotation (0..N per Opportunity; 0..N per Account; opportunityId nullable)
            ├─ Contact (optional, must belong to the same Account — UI-enforced only)
            └─ QuotationLineItem (0..N; each optionally references a Product — snapshot only)
```

- `Quotation.accountId` → `Account` — **required**, confirmed.
- `Quotation.opportunityId` → `Opportunity` — **optional**. The legacy UI only offers the
  account's own `OPEN` deals, but nothing stops a different status or a mismatched account via
  any path other than this one dropdown (there is no other path, since there's no server/API).
- `Quotation.contactId` → `Contact` — **optional**, UI-filtered to the account's contacts, same
  "UI-only, no server enforcement" caveat.
- `QuotationLineItem.productId` → `Product` — **optional** (a line can be pure free text).
  `productCode` is a frozen snapshot; `description` starts from the product but is independently
  editable, unlike `OpportunityProduct.productName` (never independently editable after add).
  **`unitPrice` is NOT frozen** — this is the key divergence from `OpportunityProduct`, see §1.3.
- **Product delete-guard, the other half of the gap already flagged in
  `Docs/CRM_PRODUCTS_LEGACY_PARITY.md` (Risk R3):** legacy's `usageCount` for a product counts
  both `dealProducts` AND `quotationItems` referencing it. Production's `Product.softDelete`
  currently only counts `OpportunityProduct` (real) — once `QuotationLineItem` exists, that check
  must be extended to count it too, closing R3 completely. This is a required part of any Quotes
  implementation, not optional.
- Opportunity → Quotes is read-only in legacy (`DealDetail.tsx`'s Quotes tab, §1 above) — no
  write action exists there beyond "New Quote" (navigates away to `QuoteForm`) and admin-delete.

---

## 4. Permissions and tenant-scope requirements (deliverable item 4)

**Verified, re-confirmed by grep across both files:** the only permission check anywhere in
`Quotes.tsx`/`QuoteForm.tsx` is `isCrmAdmin(user)`, gating Delete only. There is no
`canManageQuotes` function in `roles.ts` (confirmed by re-reading the full file, 64 lines, already
read in the Leads audit) — **Create, Read, and Update have NO permission gate beyond reaching the
CRM module at all.** This is more permissive than every other CRM entity audited so far (Products,
Leads, Opportunities, PipelineStage all gate write behind at least one role check).

**Open decision D1 (§7):** production's established pattern is team-scoped `.own/.team/.all` for
"working record" entities (Lead, Opportunity) and the existing `AuditWriter`/`TenantContextService`
infrastructure assumes every write-permission check has a scope. Three options:

- **(a)** Org-wide, non-scoped `crm.quotation.read`/`.write` (like `Product`/`PipelineStage`) —
  closest to legacy's literal "anyone in CRM can touch any quote" behavior.
- **(b)** Team-scoped `.own/.team/.all` (like `Lead`/`Opportunity`) — consistent with this
  codebase's convention for working records, but a genuine behavior change from legacy (a
  non-privileged user could no longer edit a colleague's quote without `.all`).
- **(c)** Org-wide read, team-scoped write — a middle ground with no legacy precedent either way.

This audit does not decide between them. Delete remains a single `.write` tier standing in for
`isCrmAdmin`, the same convention already used four times (`crm.contact.write`,
`crm.lead.write`, `crm.opportunity.write`, `crm.pipeline_stage.write`, `crm.product.write`).

---

## 5. UI-parity checklist (deliverable item 5)

| Legacy element                                               | Production target                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List: search + status filter + pagination, no sort           | `DataTable` + `Input` + a `Select` for status, same composition as `LeadList`/`PipelineBoard`; no sort/filter UI beyond status — legacy has none else                                                                                     |
| Single route serves create/edit/view                         | Recommend the same single-screen approach in Next.js (a `/crm/quotes/[id]` page that is simultaneously the editor), rather than inventing a separate read-only view legacy never had                                                      |
| Line-item table with inline product picker                   | Reuse the existing `QuoteProductPicker`-equivalent pattern already built for `AddProductsDialog`, adapted to single-select-per-row instead of multi-select-to-add, since quote lines are edited in place, not added via a separate dialog |
| `unitPrice` manual override                                  | Must be a genuinely editable field, not frozen like `OpportunityProduct`'s — the UI must not disable it after a product is picked                                                                                                         |
| Billing/Shipping address blocks + "Copy Billing to Shipping" | Direct port; `ui-kit` has the needed `Input`/`FormField` primitives already                                                                                                                                                               |
| Status dropdown offering all 5 values with no guard          | Direct port — do not add a transition guard legacy doesn't have                                                                                                                                                                           |
| Three save actions (Draft / Save / Save & New)               | Direct port — three buttons, not one                                                                                                                                                                                                      |
| Print/PDF via browser print popup                            | Port `QuotationPrintTemplate.tsx` (861 lines) as a React component and reuse `window.print()` on an off-screen render — **substantial scope on its own** (see Risk R3/§8 bounded plan); no PDF library needed, matching legacy exactly    |
| No email send action                                         | Do not add one — verified absent in legacy                                                                                                                                                                                                |

---

## 6. PostgreSQL / Prisma mapping (deliverable item 6) — NOT YET IMPLEMENTED

```prisma
model Quotation {
  id                 Int       @id @default(autoincrement())
  organizationId     Int       @map("organization_id")
  teamId             Int?      @map("team_id")               // only if decision D1 = team-scoped
  accountId          Int       @map("account_id")
  opportunityId      Int?      @map("opportunity_id")
  contactId          Int?      @map("contact_id")
  quotationNumber    String    @map("quotation_number")       // format: open decision D3
  subject            String
  status             String    @default("Draft")              // free string, no CHECK — same convention as Opportunity.status
  quoteOwner         String?   @map("quote_owner")
  currency           String?   @default("INR")
  quoteDate          DateTime? @map("quote_date")
  validUntil         DateTime? @map("valid_until")
  customerReference  String?   @map("customer_reference")
  billingStreet      String?   @map("billing_street")
  billingCity        String?   @map("billing_city")
  billingState       String?   @map("billing_state")
  billingPostalCode  String?   @map("billing_postal_code")
  billingCountry     String?   @map("billing_country")
  shippingStreet     String?   @map("shipping_street")
  shippingCity       String?   @map("shipping_city")
  shippingState      String?   @map("shipping_state")
  shippingPostalCode String?   @map("shipping_postal_code")
  shippingCountry    String?   @map("shipping_country")
  carrier            String?
  deliveryNotes      String?   @map("delivery_notes")
  termsConditions    String?   @map("terms_conditions")
  paymentTerms       String?   @map("payment_terms")
  deliveryTerms      String?   @map("delivery_terms")
  notes              String?
  subtotal           Decimal   @default(0) @db.Decimal(14, 2)
  totalDiscount      Decimal   @default(0) @db.Decimal(14, 2) @map("total_discount")
  totalTax           Decimal   @default(0) @db.Decimal(14, 2) @map("total_tax")
  adjustment         Decimal   @default(0) @db.Decimal(14, 2)
  grandTotal         Decimal   @default(0) @db.Decimal(14, 2) @map("grand_total")
  isActive           Boolean   @default(true) @map("is_active")
  createdBy          Int?      @map("created_by")
  updatedBy          Int?      @map("updated_by")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  account      Account      @relation(fields: [accountId], references: [id])
  opportunity  Opportunity? @relation(fields: [opportunityId], references: [id])
  contact      Contact?     @relation(fields: [contactId], references: [id])
  lineItems    QuotationLineItem[]

  @@index([organizationId])
  @@index([accountId])
  @@index([opportunityId])
  @@map("quotations")
  @@schema("crm")
}

model QuotationLineItem {
  id              Int       @id @default(autoincrement())
  organizationId  Int       @map("organization_id")
  quotationId     Int       @map("quotation_id")
  productId       Int?      @map("product_id")       // nullable — a line may have no product (§3)
  productCode     String?   @map("product_code")      // frozen snapshot
  description     String
  uom             String?
  quantity        Decimal   @db.Decimal(14, 2)
  listPrice       Decimal   @db.Decimal(14, 2) @map("list_price")
  unitPrice       Decimal   @db.Decimal(14, 2) @map("unit_price")   // NOT frozen — user-editable (§1.3)
  discountPercent Decimal?  @db.Decimal(5, 2) @map("discount_percent")
  discountAmount  Decimal?  @db.Decimal(14, 2) @map("discount_amount")
  taxPercent      Decimal?  @db.Decimal(5, 2) @map("tax_percent")
  taxAmount       Decimal?  @db.Decimal(14, 2) @map("tax_amount")
  amount          Decimal   @db.Decimal(14, 2)        // = computeLineBreakdown(...).total
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  quotation    Quotation    @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  product      Product?     @relation(fields: [productId], references: [id])

  @@index([organizationId])
  @@index([quotationId])
  @@index([productId])
  @@map("quotation_line_items")
  @@schema("crm")
}
```

**Deliberately NOT modeled** (verified absent in legacy, §1.4): a revision/version table, an
approval/sign-off table, a `linkedSalesOrderId`-style FK with any real behavior behind it (legacy's
own `linkedSalesQuotationId` is kept as a documented-absent feature, not ported — there is nothing
to port, since legacy itself never writes it).

**`onDelete: Cascade` on `QuotationLineItem.quotationId`** is a deliberate departure from
`OpportunityProduct`'s `RESTRICT`-everywhere posture, because it matches §2.4's "replace-all"
model if that option is chosen: the whole-quote soft-delete already cascades to items in legacy
(§1.5), and a hard `Cascade` here only matters for the (never-performed) hard-delete path — soft
delete still requires its own explicit cascade in the repository regardless, same as
`deleteCrmQuotation`'s related-path delete.

**Open decisions carried from above, listed together:**

- **D1 — scope shape** (§4): org-wide vs `.own/.team/.all` for `crm.quotation.*`.
- **D2 — line-item API shape** (§2.4): replace-all (one `PUT`-style endpoint) vs
  `OpportunityProduct`-style incremental per-line CRUD.
- **D3 — quotation numbering**: replicate legacy's non-sequential
  `QUO-${timestamp-base36}` format exactly, or generate server-side like `Opportunity`'s
  `OPP-<padded-id>` (consistent with this codebase's established numbering style, but a format
  change from legacy).
- **D4 — trust vs. recompute totals** (§2.3): trust client-submitted
  subtotal/discount/tax/grandTotal (byte-for-byte legacy behavior) vs. recompute them server-side
  from the submitted line items (consistent with `OpportunityProduct.total` already being
  server-computed, not client-trusted).
- **D5 (new, not previously raised) — cross-record validation strictness**: legacy's
  "Deal must be this Account's own OPEN deal" / "Contact must belong to this Account" rules are
  UI-filter-only, never enforced by any service layer (there is none). Production has a real
  service layer — decide whether to add a server-side check (consistent with
  `Contact.create`/`Opportunity.create` already validating `accountId` cross-org) or leave it
  advisory. Recommend enforcing at minimum "same organization" (always required everywhere else in
  this codebase) and treating "same account" as a stricter option to confirm.
- **D6 — Print/PDF scope**: port the full 861-line `QuotationPrintTemplate` now as part of this
  slice, or ship Quotes CRUD first and defer Print/PDF to an explicit follow-up (same
  "defer the large, separable piece" posture already applied to Products' bulk import/export,
  D4 there).

---

## 7. Test matrix (deliverable item 7, part 1)

| Area                | Case                                                                 | Expected                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                | Unauthenticated `GET /crm/quotations`                                | 401                                                                                                                                       |
| Permission          | No `crm.quotation.read`/`.write`                                     | 403 (shape depends on D1)                                                                                                                 |
| Validation          | Missing `accountId`/`subject`/`validUntil`                           | 400                                                                                                                                       |
| Validation          | `validUntil` before `quoteDate`                                      | 400                                                                                                                                       |
| Validation          | Zero line items, or a line with `quantity <= 0`                      | 400                                                                                                                                       |
| Tenant isolation    | Org B reads/updates/deletes Org A's quotation                        | 404, row unchanged                                                                                                                        |
| Relationship        | `opportunityId` from another org                                     | 422                                                                                                                                       |
| Relationship        | `opportunityId` belonging to a different account, if D5 enforces it  | 422 (only if adopted)                                                                                                                     |
| CRUD                | Create → read → update header → list reflects it                     | 200/201 round-trip                                                                                                                        |
| Line items          | Replace-all (or incremental, per D2) changes totals correctly        | `computeLineBreakdown`-consistent `amount` per line                                                                                       |
| Line items          | A line with no `productId`, free-text only                           | Accepted, matches legacy                                                                                                                  |
| Line items          | `unitPrice` edited after product pick                                | Persisted as entered, NOT reset to `listPrice`                                                                                            |
| Calculation         | Hand-computed subtotal/discount/tax/grandTotal for a known input set | Matches `computeLineBreakdown` + the aggregate `round2` exactly (same method already used in the Opportunity/Products e2e suites)         |
| Status              | Any status → any other status, no guard                              | Always succeeds (unless a future business decision adds one — not legacy's behavior)                                                      |
| Delete              | Soft-delete cascades to line items                                   | Items excluded from reads; quotation `deletedAt` set                                                                                      |
| Delete              | Non-admin (or non-`.write`, per D1) attempts delete                  | 403                                                                                                                                       |
| Product interaction | Deleting a `Product` referenced by a `QuotationLineItem`             | 422 (closes Products' Risk R3 — must be tested from both sides: deleting the product, and confirming the quote's line item is unaffected) |
| Scope               | `.own`/`.team`/`.all`, only if D1 adopts team-scoping                | Same pattern as the existing Lead/Opportunity tests                                                                                       |

---

## 8. Risks (deliverable item 7, part 2)

- **R1 (six open decisions, D1–D6):** this module has materially more undecided shape than
  Products or Opportunities did at audit time — scope model, line-item API shape, numbering,
  totals trust, relationship strictness, and Print/PDF scope all need an explicit answer before
  schema work starts, not during it.
- **R2 (Print/PDF is a large, separable sub-project):** 861 lines of presentational legacy code,
  zero reuse of any already-ported production component. Bundling it into the same pass as
  Quotes CRUD risks a much larger, harder-to-verify slice than every prior CRM phase.
- **R3 (Product's delete-guard gap must close, not just move):** if `QuotationLineItem` is built
  without also updating `ProductsRepository.softDelete`'s usage-count query, the Products audit's
  already-documented "only counts `OpportunityProduct`" gap becomes a silently-incomplete business
  rule rather than a documented one — this is a required edit to an existing file, not purely
  additive.
- **R4 (legacy's permissive write access is a real behavior, not an oversight to "fix"):** D1
  should be resolved as a deliberate choice, with the tradeoff stated to whoever approves it, not
  defaulted to the stricter team-scoped pattern merely because that's what Lead/Opportunity do.
- **R5 (no data to validate against):** same as the Products audit — zero legacy quotation
  records exist in the export, so nothing here was cross-checked against real-world data, only
  against source code.

---

## 9. Bounded implementation plan and dependency order (deliverable item 8)

1. **Resolve D1–D6** with the user before any schema work (same gating step the Products audit
   used for its D1–D4, which the next session's approval message explicitly resolved one-by-one).
2. `Quotation` + `QuotationLineItem` Prisma models + one additive migration (§6, once D1/D3
   are fixed — they change column shape).
3. Extend `ProductsRepository.softDelete`'s usage-count query to also count
   `QuotationLineItem` (closes Products' Risk R3) — **do this in the same phase, not a future
   one**, since it's a one-line query change with no new risk, and leaving it open after Quotes
   ships would silently misrepresent product-deletion safety.
4. Permissions (`crm.quotation.read`/`.write`, shape per D1).
5. NestJS module: DTOs, repository/service/controller — reusing `computeLineBreakdown`/`round2`
   from `apps/api/src/modules/crm/shared/money.ts` for both per-line and aggregate math (§2),
   never re-deriving it. Line-item persistence per D2. Numbering per D3. Totals per D4.
   Cross-record checks per D5.
6. E2E tests per §7.
7. Next.js feature: Quotes list (search + status filter + pagination, §5), the combined
   create/edit/view screen, the line-item table with an editable `unitPrice`, billing/shipping
   blocks, terms/notes, the three save actions, and the Opportunity drawer's read-only "Quotes"
   section (mirroring `DealDetail.tsx`'s tab, the same way `DealProductsSection` already mirrors
   its Products tab).
8. **Print/PDF (D6):** either folded into step 7 or explicitly deferred as a follow-up, per
   whichever the user chooses — ship Quotes CRUD/money-model first either way, since that is the
   part every other piece depends on.
9. **Out of scope for any near-term Quotes phase** (verified absent in legacy, §1.4): revision
   history, approval workflow, Sales Order conversion, customer-facing accept/reject, email
   sending, quote duplication/cloning.

---

## 10. Report — inspected files, verified vs. assumed, and confirmation

**Legacy files inspected:** `QuoteForm.tsx`, `Quotes.tsx`, `domain/quotationsService.ts`,
`domain/types.ts` (quotation section), `domain/currency.ts`, `domain/config.ts`, `domain/roles.ts`
(re-checked), `DealDetail.tsx` (Quotes tab section), `CRMLayout.tsx`, `domain/QuoteProductPicker.tsx`
(re-confirmed from the Products audit), and — read directly from the legacy repo because it was
missed by the original reference-tree copy — `src/components/QuotationPrintTemplate.tsx`. Plus
the RTDB export, aggregate-only.

**New-repository files inspected:** `schema.prisma` (Account/Contact/Opportunity/Product/
OpportunityProduct), `catalog.ts`, `apps/api/src/modules/crm/shared/money.ts`,
`opportunity-products.repository.ts`, `products.repository.ts`.

**Verified by direct source reading:** every field, the three save actions, the complete absence
of a transition guard and of a `canManageQuotes` permission, the replace-all line-item write
model, the manual `unitPrice` override (the key divergence from `OpportunityProduct`), the
print-only (no PDF library, no email) mechanism, the admin-only delete with cascade, the
bulk-import header-only limitation, the list's search+status-filter+no-sort+client-pagination
shape, and that `computeLineBreakdown` is already shared with Deal Products in legacy (confirming
the direct reuse path into `shared/money.ts`).

**Verified from the RTDB export:** zero quotation or quotation-item records exist; zero
quotation-related audit log entries exist.

**Inferred / open, not verified against legacy (legacy has no server to verify a "should"
against):** D1 (permission scope shape), D2 (line-item API shape), D3 (numbering format), D4
(trust vs. recompute totals), D5 (cross-record validation strictness), D6 (Print/PDF timing).
Each is stated as a decision, never presented as something legacy requires.

**No feature was invented.** Every capability listed as present was read directly in source; every
capability a "typical" quoting module might have but this audit does not list (approval chains,
revisions, Sales Order conversion, email, PDF generation beyond browser print, line-item
history) was explicitly checked for and confirmed absent, not merely left out for convenience.

**Confirmation — nothing was altered:**

- No application code, in either repository, was created or modified by this audit; the only new
  file anywhere is this document.
- No database was reset, no migration was edited, no row was inserted, updated, or deleted in any
  database (dev or test).
- No Firebase project, credential, export file, or live resource was connected to or modified —
  the RTDB export was only read, via a script that printed aggregate counts and key names only.
- Nothing was staged, committed, or pushed in either repository.
- `git status` in both `D:\New folder\TexaWave_ERP` and
  `D:\New folder\Texawave_Erp_Production` is unchanged from immediately before this audit began
  (confirmed by re-running `git status --short` in both at the end of this pass).
