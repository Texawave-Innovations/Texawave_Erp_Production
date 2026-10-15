# SCM Legacy Parity Matrix

**Status:** Phase B — deep audit completed for **Suppliers, Procurement (PR/RFQ/Quotation/
Comparison/PO/GRN), Inventory, Orders/Fulfillment (incl. Warehouse Picking/Packing, Logistics,
Returns), Quality, and Reports**. No SCM schema/API/UI code has been written yet. Master Data,
standalone Warehouse (putaway/transfer-location), Barcode, and Advanced/AI remain Phase-A
surface-survey only (see §2) — not in scope for this pass.
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP` (Vite/React, Firebase Realtime
Database).
**Production source:** `D:\New folder\Texawave_Erp_Production`, branch `feature/HR`.
**Methodology:** read-only direct inspection of legacy source (components, services, types,
routes), citing exact file:line evidence throughout. No legacy file was modified.

---

## 1. Current state (production repo)

- **0% migrated.** All ~106 legacy SCM files are reference-only under
  `apps/api/src/modules/scm/*` (copied verbatim, excluded from the TS build via
  `tsconfig.json`/`tsconfig.build.json`).
- No Prisma model, no permission, no NestJS module, no Next.js route exists for any SCM area.
- No foundation entity yet (unlike CRM, which started from Account/Contact).

## 2. Legacy surface map (Phase-A, unchanged from prior survey)

| Area                             | Legacy folder      | Representative files                                                                | Audit depth                                                                        |
| -------------------------------- | ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Suppliers                        | `suppliers/`       | `ScmSuppliers.tsx`, `ScmSupplierDetail.tsx`, `supplierHelpers.ts`                   | **Deep (§3)**                                                                      |
| Master Data                      | `masterData/`      | `ScmMasterData.tsx`, `scmMasterDataService.ts`                                      | Phase-A only                                                                       |
| Procurement                      | `procurement/`     | PR/RFQ/Quotation/Comparison/PO/GRN (11 files)                                       | **Deep (§4)**                                                                      |
| Inventory                        | `inventory/`       | Stock Overview/Ledger/Reservations/Transfers/Adjustments/Batches/Serials (14 files) | **Deep (§5)**                                                                      |
| Orders/Fulfillment               | `orders/`          | `ScmOrderFulfillmentDashboard.tsx` + 5 more                                         | **Deep (§6)**                                                                      |
| Warehouse (picking/packing only) | `warehouse/`       | `ScmWarehousePicking.tsx`, `ScmWarehousePacking.tsx`                                | **Deep (§6)**, picking/packing only — putaway/transfer/location UI remains Phase-A |
| Logistics                        | `logistics/`       | `ScmShipments.tsx`, `logisticsService.ts` + 4 more                                  | **Deep (§6)**                                                                      |
| Returns                          | `returns/`         | `ScmCustomerReturns.tsx`, `ScmVendorReturns.tsx` + 5 more                           | **Deep (§6)**                                                                      |
| Quality                          | `quality/`         | Dashboard/Inspections/Templates/Defects/Quarantine/Activity (14 files)              | **Deep (§7)**                                                                      |
| Reports                          | `reports/`         | 9 report screens + `calculations/` barrel                                           | **Deep (§8)**                                                                      |
| Barcode                          | `barcode/`         | `ScmBarcodeScanner.tsx`, `barcodeService.ts`                                        | Phase-A only (used as a dependency throughout §3–§8)                               |
| Advanced/AI                      | `advanced/`, `ai/` | `ScmControlTower.tsx`, `ScmAiChatbot.tsx`, `ScmSupplierIntelligence.tsx`            | Phase-A only, out of scope                                                         |

---

## 3. Deep audit: Suppliers

**Legacy location:** `src/modules/scm/suppliers/` (5 files: `ScmSuppliers.tsx`,
`ScmSupplierFormDialog.tsx`, `ScmSupplierDetail.tsx`, `SupplierProcurementTabs.tsx`,
`supplierHelpers.ts`).

### Routes

- `/scm/suppliers` → `ScmSuppliers` (list), `App.tsx:936`.
- `/scm/suppliers/:id` → `ScmSupplierDetail`, `App.tsx:937`.
- No separate create/edit route — both happen in a modal (`ScmSupplierFormDialog`), opened from
  either screen.
- **Latent routing bug found, not to be replicated**: `/scm/suppliers/intelligence`
  (`App.tsx:1013`, a separate analytics page) is registered _after_ `suppliers/:id` in the route
  array, so React Router's ordering means `suppliers/:id` would actually match first with
  `id="intelligence"` — needs re-verification in-browser before assuming it ever worked, and a
  Next.js file-based router will likely resolve this differently (and correctly) for free.
- **Duplicate entry point outside SCM**: the legacy Purchases module's own `VendorForm.tsx`
  shares the same code-generation helpers and the same underlying `contacts/vendors` Firebase
  path — two different UIs edit the same records today.

### UI structure

- **List**: search (code/company/contact/email/phone/GST, 250ms debounce), Status filter, Type
  filter (dynamically derived from distinct values in data, not a fixed list), table columns
  Code/Company+Type/Primary Contact/Phone/Email/GSTIN/Payment Terms/Lead Time/Rating/Status/
  Actions. Row actions: View, Edit, Active⇄Inactive toggle (disabled for Blocked/Pending).
- **Create/Edit dialog**, sectioned: Basic Info (Code, Company Name*, Type — free text, Status),
  Tax Info (GSTIN, PAN), Primary Contact (Name*, Phone, Email), Address (Street/City/State select/
  Country/Postal Code), Commercial (Payment Terms, Credit Limit, Currency, Lead Time Days), Other
  (Rating 1–5, Notes).
- **Detail screen**, 13 tabs: Overview, Contacts, Products (computed, not stored), RFQs
  (placeholder), Supplier Quotations (placeholder), Purchase Orders (real), GRNs (real), Bills
  (placeholder — "once Accounts Payable is built"), Payments (real), Returns (placeholder —
  "Phase 8"), Performance (KPI cards awaiting GRN+Quality data), Documents (Cloudinary upload),
  Activity (audit log).

### Workflow / status model

`VendorStatus = Active | Inactive | Pending Approval | Blocked`. **No formal approval workflow
exists** — "Pending Approval" is just a selectable dropdown value with no automatic entry/exit
logic and no approve/reject action anywhere in code. The list page's toggle button only flips
Active⇄Inactive; any status (including Blocked) can be set freely via the Edit form's Status
select with no guard rails on which transitions are "legal." `isSupplierActive()` is the one real
business-rule consumer — it gates whether a supplier can be used to raise a PO.

### Validations

Company Name, Contact Person, Supplier Code required; GSTIN/PAN format-validated via regex;
Currency must be 3-letter code; Rating 1–5 if provided. **Email has no format validation**
despite a validator existing elsewhere in the app (`type="email"` browser hinting only — a real
gap worth flagging). Phone/Postal Code are digit-filtered but not length/checksum-validated.
GST-to-state auto-fill on valid GSTIN entry. Duplicate-code/duplicate-GST checks are
best-effort client-side; **hard** code uniqueness is enforced via a Firebase RTDB transactional
"claim" node (`meta/supplierCodeClaims/{code}`), added specifically after a found production bug
where two concurrent creations both landed the same code.

### Permissions

**Module-level only** (`<ProtectedRoute module="scm">` → `hasAccess('scm')`). Default roles with
`scm` access: `admin`, `manager` only. **No Suppliers-specific permission constant exists** —
once a user has `scm` access, they can fully create/edit/activate/deactivate/block any supplier.

### Data relationships

Referenced via `vendorId` (one case uses `supplierId`: `ScmQualityInspection`) from: legacy
Purchases PO, SCM PO (+ denormalized `vendorNameSnapshot`/`vendorGSTINSnapshot`), GRN, Payments
Made, Supplier Quotation, RFQ (`supplierIds[]` many-to-many). "Products Supplied" on the detail
tab is **not a stored relationship** — computed client-side from PO item history. Supplier
"Type" has no FK to any master-data table (freeform text).

### Data shape & Firebase path

Path: `contacts/vendors/{id}` — **the same table the legacy Purchases module's Vendor form also
writes to**, not an SCM-owned collection. Full field list: `id, vendorCode, companyName,
contactPerson, email, phone, gst?, pan?, type?, category?(unused by SCM), trusted?(unused),
addresses[], bankName?/bankAccountNo?/bankIfsc?/bankBranch?/bankDetails?(unused by SCM, legacy-
Purchases-only), status?, paymentTerms?, creditLimit?, currency?, leadTimeDays?, rating?, notes?,
contacts?[], documents?[], createdAt?, updatedAt?`.

### API/service behavior

No backend — direct Firebase SDK calls. Code scheme: `VEND-0001` style, next-number computed as
max-existing-suffix+1 (never reused after deletion), allocated via a retrying claim-transaction
(up to 10 attempts). Search/filter/sort are 100% client-side over a **full collection fetch**
(no pagination at all, no UI pager).

### Dependencies

File storage is **Cloudinary**, not Firebase Storage (`uploadFile()` → `uploadImage`/`uploadPDF`).
Barcode module for scan-to-detail and QR label printing. Shared SCM utils (`statusTransition`,
`businessRules.isSupplierActive`, `crossModulePaths`).

### Legacy/Firebase-only patterns (no Postgres equivalent needed)

Denormalized name/GSTIN snapshots everywhere downstream; client-side joins on every page load (4–5
whole collections fetched and filtered by `vendorId` in-browser); no native pagination; Firebase
transaction-based uniqueness (`claimSupplierCode`) → trivially becomes a Postgres `UNIQUE`
constraint; permanent/never-released code claims → unnecessary with a real unique index; per-record
`auditLogs` subnode → should become one shared `audit_log` table.

---

## 4. Deep audit: Procurement (PR → RFQ → Quotation → Comparison → PO → GRN)

**Legacy location:** `src/modules/scm/procurement/` (11 files). Pipeline is explicit in the type
file's own comment: `PR → RFQ → Supplier Quotation → Comparison → PO → GRN → stock ledger`.

### 4.1 Purchase Requisition (PR)

- Route `/scm/procurement/requisitions`. List: search/status/date filters, 20/page pagination,
  columns PR#/Requester+Dept/Request Date/Priority/Items/Est.Total/Status/Actions. Also
  reachable via `ShortageRequisitionDialog` (auto-computes shortage from a sales order and
  pre-fills a new PR).
- Status: `DRAFT → SUBMITTED → UNDER_REVIEW(dead, never set) → APPROVED → REJECTED/CANCELLED →
CONVERTED` (on RFQ creation, rolled back to `APPROVED` if RFQ creation fails).
- **No self-approval guard** — any user with SCM access can approve their own requisition.
- Numbering: `TW/PR/{FY}/{seq}`. Totals: `subtotal = Σ(qty×estUnitCost)`, `total = subtotal+tax`
  (no rounding helper, unlike downstream documents).
- `fulfillmentId` field exists on the type for a Phase-6 link but is **never read/written** by
  this sub-area (dead field here).

### 4.2 RFQ

- Route `/scm/procurement/rfqs`, optionally prefilled from an approved PR.
- Status: `DRAFT → ISSUED(dead, bypassed) → RESPONSES_PENDING → PARTIALLY_RESPONDED/RESPONDED →
CLOSED`, or `CANCELLED` (not from RESPONDED). Issuing jumps `DRAFT` straight to
  `RESPONSES_PENDING`. Response status is **recomputed**, not manually set, every time a
  quotation is recorded (counts invited suppliers who've responded vs. total invited).
- Validations: ≥1 active supplier, ≥1 line item, no duplicate product codes; supplier list
  re-filtered against currently-active vendors even after selection.
- Many-to-many to Suppliers (`supplierIds[]` + a denormalized name-snapshot map).

### 4.3 Supplier Quotation

- Route `/scm/procurement/quotations`, prefillable from an RFQ.
- Status: `DRAFT(dead) → RECEIVED → UNDER_REVIEW(dead) → SHORTLISTED → SELECTED/REJECTED →
EXPIRED(dead)/CANCELLED`. Creation goes straight to `RECEIVED`, skipping `DRAFT`.
- Genuine business-rule validation: a quotation can only be recorded for a supplier actually
  invited on the chosen RFQ (`vendorId` must be in `rfq.supplierIds`), and the RFQ must still be
  open (re-fetched fresh at save time, not trusted from the client's stale copy).
- Line math: `lineTotal()` and a separately-reimplemented `documentTotals()` — **two independent
  implementations of similar discount logic in the same file**, a latent-drift risk worth
  collapsing into one function during migration.

### 4.4 Quotation Comparison

- Route `/scm/procurement/comparison`. Single RFQ drives a side-by-side comparison table
  (lowest-total and earliest-delivery markers are presentational only, never persisted).
- `selectQuotation()`: moves the chosen quotation to `SELECTED`, then **best-effort** (errors
  swallowed per-quotation) moves every other still-selectable quotation on the same RFQ to
  `REJECTED` — a non-atomic, Firebase-era substitute for a real multi-row transaction.
- UI copy claims "selection is always made by an authorized user, never automated" — **no actual
  authorization check backs this claim in code.**

### 4.5 Purchase Order (PO)

- Route `/scm/procurement/purchase-orders`, prefillable from a selected quotation (locks
  supplier/items in that case).
- Status: `DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED/RECEIVED → CLOSED`,
  or `CANCELLED` from any pre-SENT-or-SENT state.
- **Enforced rule**: goods cannot be received against an `APPROVED`-but-not-`SENT` PO — "approval
  alone is not enough, the PO must be sent" (explicit code comment).
- Approval posts an `incoming`-stock delta per line (idempotent); cancel/close reverses it.
- **Guard**: a quotation may back at most one live (non-cancelled) PO.
- **No self-approval restriction** — same user can create, submit, and approve a PO.
- **Data-model gap found**: `sourceRequisitionId`/`Number` fields exist on the PO type but are
  **never populated by any write path** — only the RFQ/Quotation links are set. The PR↔PO link
  must be derived via Quotation→RFQ→PR chain, or this needs an explicit fix decision.
- Numbering: `TW/PO/{FY}/{seq}` — **intentionally shares the same counter/prefix with the legacy
  Finance module's own Purchase Orders** (explicit code comment); migration must decide whether
  this stays one shared sequence or splits into two.

### 4.6 GRN (Goods Receipt Note)

- Route `/scm/procurement/grn`, prefillable from a receivable PO.
- Status: `DRAFT → COMPLETED/CANCELLED`. (`RECEIVED`/`PARTIALLY_RECEIVED` exist in the type union
  but are **never actually assigned to a GRN record** — those apply to the PO's own status, a
  likely copy-paste artifact in the type file.)
- Receiving flow validates: receiving qty ≤ PO-line remaining; rejected ≤ receiving; batch
  number required if the product is batch-tracked; exact serial-number count required if
  serial-tracked, with a **server-side** re-check that none of the scanned/typed serials already
  exist anywhere in inventory.
- Posting pipeline (ledger entry, incoming-release, batch upsert, serial creation) is wrapped in
  individually idempotent `postOnce()` calls so a partial-failure retry ("Retry posting" button,
  shown as "Posting Incomplete") is always safe to re-run.
- `poLineIndex` (array position), not product code alone, disambiguates which PO line a receipt
  row belongs to — defended against drift by re-checking `productCode` match at receipt time.

### Cross-cutting (all of §4)

- **No approval-authority/role model anywhere** — a single `scm` module boolean gates every
  action across all six documents; no amount thresholds, no self-approval prevention anywhere.
- Numbering is one shared utility (`TW/PR`, `TW/RFQ`, `TW/SQ`, `TW/PO`, `TW/GRN`), format
  `{PREFIX}/{FY}/{seq:04d}`, backed by a per-prefix-per-FY Firebase transactional counter.
- Status transitions centralized through two generic helpers (`transitionStatus`,
  `transitionWithSideEffect`) — the latter auto-rolls-back the status if its side effect throws.
- **No Firebase Storage usage anywhere in Procurement** — no attachments/PDFs.
- **Multiple dead enum values** across the whole pipeline (`RfqStatus.ISSUED`,
  `QuotationStatus.DRAFT/UNDER_REVIEW/EXPIRED`, `GrnStatus.RECEIVED/PARTIALLY_RECEIVED`,
  `RequisitionStatus.UNDER_REVIEW`) — don't blindly carry every union member into a new Postgres
  enum/CHECK constraint without checking it's actually reachable.
- Idempotency pattern (`postOnce` against a Firebase "posting claims" node) appears at every
  stock-affecting step — this entire mechanism should disappear in favor of real DB transactions.

---

## 5. Deep audit: Inventory

**Legacy location:** `src/modules/scm/inventory/` (14 files: Stock Overview, Product Detail,
Stock Ledger, Reservations, Transfers, Adjustments, Batches, Serial Numbers, Opening Balance).

### Routes & structure

`/scm/inventory/overview` (+ `/overview/:productCode` detail), `/ledger`, `/reservations`,
`/transfers`, `/adjustments`, `/batches`, `/serials` — all under the same module-level
`<ProtectedRoute module="scm">`, no finer route gating.

- **Stock Overview**: KPI cards (Total Value, Total SKUs, Available, Reserved, Low Stock, Out of
  Stock, Incoming), filterable/searchable table, "Post Opening Balance" and barcode-scan actions.
  Note: the "Incoming" column shows the hardcoded placeholder text **"Pending Procurement"**, not
  an actual number.
- **Stock Ledger**: described in its own UI copy as "Authoritative, append-only history... source
  of truth for on-hand quantity" — columns Date/Reference(clickable, routes by doc type)/Product/
  Warehouse/Type/IN/OUT/Unit Cost/Created By.
- **Reservations**: status `ACTIVE|RELEASED|FULFILLED|CANCELLED`, optional link to a Sales
  Order; releasing only allowed from `ACTIVE`; **reservations never post a ledger entry** — they
  only move the `reserved`/`available` fields on the balance row.
- **Transfers**: `REQUESTED → APPROVED → IN_TRANSIT (posts TRANSFER_OUT) → RECEIVED (posts
TRANSFER_IN)`; stock is "in limbo" (already reduced at source, not yet added at destination)
  while `IN_TRANSIT`, with no ledger row representing goods while in transit.
- **Adjustments**: `PENDING → APPROVED (posts ADJUSTMENT_IN/OUT) / REJECTED`; the ledger write
  itself (inside the atomic transaction) is the actual non-negative-stock guard, not any
  pre-check. Reason enum: Physical Count Difference, Damage, Loss, Found Stock, Opening
  Correction, Other.
- **Batches**: status `ACTIVE|EXPIRED|QUARANTINED|BLOCKED`; manual "Add Batch" registers metadata
  only at qty 0 — real quantity accrues via GRN receipts; nothing automatically expires a batch
  (would need a scheduled job, not present).
- **Serial Numbers**: status `AVAILABLE|RESERVED|SOLD|TRANSFERRED|DAMAGED|RETURNED|QUARANTINED`;
  bulk-add with a duplicate check against a **fresh re-read** of Firebase — **not transactional**,
  so a true concurrent-duplicate race is still theoretically possible.
- **Opening Balance**: posts directly, no approval; explicitly "cannot be edited afterwards; use
  an Adjustment to correct it."

### Ledger transaction types & the one critical double-booking rule

`OPENING_BALANCE, PURCHASE_RECEIPT, SALES_ISSUE, SALES_RETURN, PURCHASE_RETURN, TRANSFER_OUT,
TRANSFER_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGE, QUARANTINE, QC_RELEASE, QC_REJECT`.
**`QC_REJECT` carries `quantityOut` for traceability but posts a ZERO net on-hand delta**, because
the stock was already pulled into quarantine by an earlier `QUARANTINE` posting — this exact rule
must be preserved or on-hand totals will double-decrement after migration.

### Validations

Stock **cannot go negative** by default — enforced inside the same Firebase `runTransaction` that
applies the balance delta (not a separate pre-check, closing the race-condition window). An
explicit `allowNegative` escape hatch exists on the posting API but is never exercised by any UI
in this folder. Reservation cannot exceed on-hand. **No UOM conversion logic exists anywhere** —
`uom` is a flat display string with zero conversion math.

### Permissions

**Zero fine-grained checks found** (grepped the whole folder) — identical module-level-only
gating as every other SCM area. Viewing stock and posting/approving an adjustment or transfer
require exactly the same access.

### Balance computation & valuation — the biggest "won't map cleanly" finding

`StockBalance` is explicitly documented in its own type comment as "a derived, materialized
on-hand snapshot... so pages don't have to replay the whole ledger" — but in practice it is
**never recomputed by summing the ledger**; it's a running counter trusted to stay correct via
every write path. The balance-then-ledger write is a **two-step, non-atomic** process with
best-effort compensating rollback on failure (RTDB has no cross-path transactions) — a crash
between the two steps can leave them silently out of sync, with nothing anywhere that reconciles
them after the fact.

Valuation is a **flat, manually-entered `costPrice` per SKU** — no FIFO, no weighted-average;
"Total Inventory Value" = `onHand × costPrice`. Low-stock status is a pure render-time computed
label (`available ≤ reorderLevel` etc.), never a persisted/queryable flag or scheduled alert.

### Dependencies

Products come from a **dual-shape reconciliation** layer (`productCatalog.ts`) that handles both
a new "parent record with nested `items[]`" shape and a legacy flat-record fallback — this
reconciliation itself is a migration risk requiring one canonical product shape before it can be
retired. Procurement and Quality both _call into_ this folder's `stockLedgerService.ts` as the
single posting entry point — Inventory is the dependency target, not the dependent, for those
two areas.

### Legacy/Firebase-only patterns

Hand-rolled idempotency/locking via a "posting claims" node with a 2-minute stale-claim timeout
→ replace entirely with a unique constraint + DB transaction. Deterministic string-concatenated +
character-escaped composite keys (`firebaseKey()`) → become ordinary composite unique constraints
in Postgres; the escaping logic itself should **not** be ported (it would mangle real business
keys containing `/`). **No server-side validation/authorization of any kind exists today** — every
guard currently runs as client-side TypeScript inside a browser-executed Firebase transaction;
migrating to NestJS means these become real server-enforced constraints, not just "the same code
on a different host."

---

## 6. Deep audit: Orders/Fulfillment, Warehouse Picking/Packing, Logistics, Returns

These four legacy folders form one continuous pipeline (confirmed via import tracing, not
assumed): **Sales Order (legacy Sales module) → Fulfillment → Pick → Pack → Shipment → Delivery
→ Return.**

### 6.1 Order Fulfillment (`src/modules/scm/orders/`)

- Routes: `/scm/orders/sales-orders` (read-only SO list w/ SCM fulfillment status),
  `/allocation`, `/backorders` (shortage → "Create PR"), `/fulfillment` (dashboard),
  `/fulfillment/:id` (detail).
- Status: `PENDING → STOCK_CHECK → PARTIALLY_AVAILABLE|AVAILABLE → RESERVED → PICKING → PACKING →
READY_TO_SHIP → FULFILLED`, with `CANCELLED`/`ON_HOLD` side-states.
- `finalizeFulfillment` is the **only** place in this whole pipeline that posts to the stock
  ledger — one idempotent `SALES_ISSUE` entry per line, issuing `min(reserved, picked&packed)`.
- Partial reservation, partial pick, and partial pack are all explicitly supported end to end.
- Cancellation is blocked once any stock has actually been issued — a post-issue reversal must go
  through Returns instead, never a direct cancel.
- **Type-definition drift found**: `src/types/index.ts` and `src/types/scm.ts` both define
  `OrderFulfillment`/`OrderFulfillmentItem`, and the `index.ts` copy is missing several fields
  present in `scm.ts` (`soLineIndex`, `deliveryStatus`, `auditLogs`) — treat `scm.ts` as
  authoritative when designing the Postgres schema, not `index.ts`.
- SCM has **no own Sales-Order concept** — it reads the legacy Sales module's order record
  directly and explicitly never duplicates it (code comment confirms this by design).

### 6.2 Warehouse Picking & Packing (`src/modules/scm/warehouse/`, picking/packing only)

- Routes `/scm/warehouse/picking`, `/packing`.
- Pick status `PENDING → ASSIGNED → IN_PROGRESS → PARTIALLY_PICKED|COMPLETED`, or `CANCELLED`.
  Pack status `PENDING → IN_PROGRESS → PACKED`, or `CANCELLED`.
- A pick must be `COMPLETED` and not yet packed/stock-issued before it's eligible for packing —
  **one packing per pick**, enforced in the picker UI.
- Barcode scan mismatches block confirmation with a toast but don't hard-fail the record.
- A hand-rolled distributed lock (`withActionLock`, a Firebase-node-based lock with a 60s
  staleness timeout) substitutes for real row-level locking here — replace with
  `SELECT ... FOR UPDATE` or a unique constraint in Postgres.

### 6.3 Logistics & Shipping (`src/modules/scm/logistics/`)

- Routes: dashboard, `/deliveries` (create-shipment from packed packages, **partial shipment
  fully supported** — one fulfillment can span multiple shipments), `/shipments` (+ detail),
  `/carriers`, `/tracking`.
- Status: `DRAFT → READY_TO_SHIP → CARRIER_ASSIGNED → LABEL_CREATED → DISPATCHED → IN_TRANSIT →
OUT_FOR_DELIVERY → DELIVERED`, with recoverable `DELIVERY_EXCEPTION`/`FAILED_DELIVERY` branches
  and a pre-dispatch-only `CANCELLED`.
- **No real carrier/webhook integration anywhere** — tracking numbers are always manually typed;
  `trackingUrl` is a literal string-template substitution, never a live API call; every status
  move is manual data entry (`source: 'MANUAL'`). This is a genuine functional gap, not a
  migration pattern — nothing to port here beyond the manual-entry fields themselves.
- `getShipmentBlockers()` is a clean, throws-nothing eligibility check (fulfillment not
  cancelled, packing `PACKED`, stock issue posted, ≥1 package, ship-to address present) — a good
  pattern to reproduce directly in the new backend.
- "Invoice — Finance integration pending" is a literal placeholder shown in the UI — Finance
  linkage is explicitly unimplemented, not something to migrate.

### 6.4 Returns (`src/modules/scm/returns/`)

- Routes: dashboard, `/all`, `/customer`, `/vendor`, `/inspection`, `/disposition`, `/:id`.
- **Two parallel lifecycles sharing one entity** (`returnType` discriminator): Customer Return
  (`REQUESTED → PENDING_APPROVAL → APPROVED → IN_TRANSIT → RECEIVED → INSPECTION_PENDING →
INSPECTED → DISPOSITION_PENDING → COMPLETED`) vs. Vendor Return (`REQUESTED →
PENDING_APPROVAL → APPROVED → READY_TO_SHIP → SHIPPED → VENDOR_RECEIVED → COMPLETED`) — the
  vendor side posts its `PURCHASE_RETURN` ledger entry at `SHIPPED` (stock physically leaves),
  while the customer side posts at disposition time, a real asymmetry to preserve.
- **Over-return prevention** is the one genuinely strong concurrency-safe business rule in this
  whole SCM area: eligible-to-return quantity is computed _inside_ a Firebase transaction against
  a dedicated reservation node, so two concurrent return submissions against the same source line
  can never both succeed — a real "this needs to become a `SELECT FOR UPDATE` or serializable
  transaction" migration task, not a cosmetic one.
- Disposition (`RESTOCK|QUARANTINE|DAMAGED|SCRAP|REJECT`) posts different ledger-entry
  combinations per choice; `RESTOCK` capped to accepted units, `REJECT` capped to rejected units;
  damaged/defective condition blocks `RESTOCK` outright.
- Return shipping deliberately uses its **own lightweight manual struct**, not the full Phase-7
  Shipment engine (explicit code comment: "Phase 7's model has no natural extension point for a
  reverse/return leg").
- **No approval-role separation** despite `PENDING_APPROVAL`/`APPROVED`/`REJECTED` states existing
  — any SCM user can approve or reject any return.

### Cross-cutting across §6.1–6.4

No role/permission checks exist anywhere in these four folders (confirmed by grep) — purely
module-level `scm` gating, identical to every other SCM area audited. Firebase-only patterns
repeated throughout: hand-rolled optimistic concurrency (`transitionStatus`), a global action-lock
node (`withActionLock`), idempotency-by-side-record (`postOnce`), empty-array normalization on
every read (RTDB silently drops empty arrays on write — a pure NoSQL quirk, no Postgres
equivalent needed), and denormalized name snapshots everywhere. The RTDB path layout
(`scm/orders/fulfillments`, `scm/warehouse/pickings`, `.../packings`, `scm/logistics/shipments`,
`.../carriers`, `.../trackingEvents`, `.../exceptions`, `scm/returns/returns`, `.../inspections`,
`.../dispositions`) already maps cleanly to Postgres table boundaries, one table each — only the
transient `scm/returns/quantityReservations` and the pure-concurrency `scm/actionLocks` have no
natural table equivalent and should become transactions/constraints instead.

---

## 7. Deep audit: Quality

**Legacy location:** `src/modules/scm/quality/` (14 files). Documented in its own header comment
as "the centralized inspection engine for Incoming (GRN), Customer Return, Inventory and
Pre-Dispatch QC — source documents are referenced by id, never duplicated."

### Routes & structure

`/scm/quality` (dashboard), `/inspections` (+ `/:id` detail), `/templates`, `/defects`,
`/quarantine`, `/activity`. No separate Non-Conformance-Report or Certificate screen — defects
are a flat master list referenced by inspection line items; no certificate-generation feature
exists.

- **Dashboard**: KPI grid (Pending/In Progress/Completed Today/Passed/Partially Passed/Failed/On
  Hold/Quarantined/Critical Defects + computed avg. inspection time), pending/recent inspection
  lists, top-6 defect-code summary, active-quarantine summary.
- **Inspections list**: search/type/status filters, barcode scan-to-find, "New Inspection" wizard
  with a type-dependent source picker (GRN/Return/Fulfillment document picker, or ad-hoc
  Inventory warehouse+product+qty).
- **Inspection detail**: Start/Complete/Cancel actions, per-item "Record Result" dialog, linked
  Quarantine records, linked stock-ledger entries, a "Create Vendor Return" shortcut for rejected
  incoming lines, and an explicit "Credit/Debit Note — Not generated — finance integration
  pending" placeholder line.
- **Record Item Result dialog**: Inspected/Accepted/Rejected qty, a manual-hold checkbox, a
  live-derived Result badge, Condition + Defect selects, a Disposition select filtered to what's
  valid for the derived result, one PASS/FAIL/NA row per template checkpoint (required ones
  marked), and a Notes field flagged "required for HIGH/CRITICAL defects."
- **Defects** / **Templates**: simple masters (code/name/category/severity; code/name/type +
  ordered checkpoint list respectively), both with active/inactive toggling.
- **Quarantine**: register with Review/Release/Reject actions and a QR "Tag" action.
- **Activity**: a cross-entity feed built by client-side-merging every record's own embedded
  `auditLogs` map.

### Workflow / status model

Inspection: `DRAFT → PENDING_INSPECTION → IN_PROGRESS → COMPLETED/CANCELLED` (forward-only
transition map). Item result (`PASS|PARTIAL_PASS|FAIL|HOLD`) is **always derived**, never chosen
directly, from accepted/rejected/inspected counts plus a manual-hold flag. Overall inspection
result (`PASSED|PARTIALLY_PASSED|FAILED|ON_HOLD`) is derived from all item results, with any
`HOLD` item winning first. Disposition options are restricted per derived result via an explicit
allowed-map (`PASS→ACCEPT,RELEASE`; `FAIL→QUARANTINE,DAMAGED,SCRAP,REJECT`; etc.), enforced both
client- and "server"-side (same JS, just called from two places).

Quarantine: `QUARANTINED → UNDER_REVIEW → RELEASED/REJECTED`. `RELEASED` posts a `QC_RELEASE`
ledger entry and reactivates the batch only if no _other_ open quarantine still holds part of it.
`REJECTED` posts `QC_REJECT` (permanent write-off, explicit UI copy: "it will never return to
sellable stock"), sets serials `DAMAGED`/batch `BLOCKED`.

Completion runs a comprehensive pre-check gate before anything posts: every item needs a result;
non-PASS needs a valid disposition; every `required:true` template checkpoint needs a recorded
result; HIGH/CRITICAL-severity defects require non-empty notes; a **cumulative-quantity guard**
prevents the combined inspected quantity across this inspection and all its non-cancelled peers
from exceeding the source document's quantity (further capped by live stock for Inventory-type
inspections); a duplicate-serial guard prevents re-inspecting a serial already completed on a
peer inspection. If a stock-affecting posting fails after the status claim succeeds, the
inspection **reverts to IN_PROGRESS automatically** so it can be retried.

### Permissions

**Zero role/permission checks found anywhere in the module** (grepped all 14 files) — any
authenticated user who can reach the route can start/complete/cancel inspections, record results,
manage defects/templates, and release/reject quarantined stock. This is flagged as a genuine
migration gap: the new system will need real RBAC (inspector vs. QA-manager/approver) with no
legacy precedent to copy — it has to be designed fresh.

### Data relationships

GRN-sourced inspections pull `sourceQuantity` from the GRN line's _accepted_ quantity (not
ordered), and resolve `batchId` by matching batch-number+product+warehouse. Customer-return
inspections back-link `qualityInspectionId` onto the return record. Fulfillment (pre-dispatch)
inspections release part of the sales reservation before quarantining/damaging rejected stock.
**No supplier-quality-rating/scorecard field or computation exists anywhere** — supplier linkage
on an inspection is a name/id snapshot only.

### Data shape & Firebase paths

`scm/quality/inspections`, `.../templates`, `.../defects`, `.../quarantine`. Full field lists for
`ScmQualityInspection`/`Item`/`CheckpointResult`, `ScmQualityDefect`, `ScmQualityTemplate`/
`Checkpoint`, `ScmQualityQuarantineRecord` are documented in-type with extensive optional
snapshot fields (`supplierNameSnapshot`, `warehouseNameSnapshot`, etc.). Note: `sampleQuantity` is
declared on the inspection-item type but **never read or written anywhere** — a vestigial/unused
field, not a real AQL sampling-plan implementation (no statistical sampling logic exists in this
module at all).

### API/service behavior

Numbering `TW/QC/{FY}/{seq}` for inspections only — defects/templates/quarantine use Firebase
push-ids, with user-entered, uniqueness-checked codes for defects/templates. **No file/photo/
attachment handling exists anywhere** (no "QC photo evidence" capability in legacy, despite being
a common expectation of a modern QC module). No computed/persisted quality score of any kind.
Admin-notification feed fires on create/start/complete/critical-defect/quarantine events.
Idempotent posting (`postOnce`) and a status-claim-then-revert pattern protect every
stock-affecting completion step.

### Legacy/Firebase-only patterns

Denormalized snapshot fields everywhere (needs an explicit per-field decision: keep as a
point-in-time audit column, or normalize to a join). Embedded per-record `auditLogs` map rather
than a shared audit table. RTDB single-path transactions as the only concurrency primitive.
**Checkpoint "required" validation is re-derived from a live read of the template at completion
time**, not snapshotted onto the inspection — if a template's checkpoints are edited after
inspections reference it, already-recorded results could silently drift out of sync with a newer
checkpoint definition; worth deciding whether the Postgres migration should snapshot checkpoint
definitions per-inspection instead. The synthetic `${productCode}__${warehouseId}` composite
"source id" used for ad-hoc Inventory-type inspections should become a nullable FK + type
discriminator, not an encoded string.

---

## 8. Deep audit: Reports

**Legacy location:** `src/modules/scm/reports/` — **9 report screens** (not the 4–5 implied by a
casual folder skim): Executive Dashboard, Procurement, Inventory, Warehouse, Fulfillment,
Logistics, Returns, Quality, Suppliers. Routes: `/scm/reports` (+ `/procurement`, `/inventory`,
`/warehouse`, `/fulfillment`, `/logistics`, `/returns`, `/quality`, `/suppliers`).

**Dead-code note**: `reportCalculations.ts` (675 lines) is a near-duplicate of everything in
`calculations/*.ts` but **nothing imports from it** (confirmed via grep) — every screen imports
exclusively from the `calculations/` barrel. Flag as legacy dead code, not something to migrate.

### The single biggest cross-cutting risk in this whole SCM audit

`loadScmReportsData()` fetches **25 entire Firebase collections in parallel** on first visit to
_any_ of the 9 report routes (no WHERE/date-range pushdown of any kind — Firebase RTDB's `get()`
has no server-side filtering), cached for 5 minutes, and every KPI/chart/table is then
computed/aggregated entirely in browser JavaScript over that full in-memory dataset. This is the
textbook anti-pattern that does not scale once real data volume exists, and it is the #1 migration
risk identified across the entire SCM audit (not just Reports) — every one of these 9 screens
should become a server-side, filtered/aggregated SQL endpoint, not a client-side JS reduction over
a bulk fetch.

### Per-report highlights (full detail is extensive; key findings only)

- **Executive Dashboard**: literally calls all 7 domain `compute*Report()` functions and keeps
  only the KPIs — i.e. it recomputes every other report's full aggregation a second time on every
  filter change. Explicitly documents that inventory/warehouse figures are point-in-time
  snapshots, not date-filtered — a correctness caveat worth preserving in any rewrite.
- **Inventory Report**'s movement-trend chart loops the **entire stock ledger** client-side,
  filtered by date range — stock ledgers are typically an app's largest table; this is the single
  most expensive computation found in any report.
- **Warehouse Report**'s location-occupancy figure is derived by **replaying every putaway/
  movement/picking transaction** client-side rather than reading a maintained balance — itself a
  form of "denormalization by computation" that should become a materialized view or aggregate
  query in Postgres.
- **Supplier Report** computes per-vendor totals by filtering the _entire_ in-memory PO/GRN/
  return/inspection arrays once per vendor — an O(vendors×records) nested-loop equivalent of a
  single `GROUP BY vendor_id` SQL query with joins; the clearest, lowest-risk first candidate for
  proving out "push this report's logic server-side" during migration. Explicitly "descriptive
  only, no scoring" by design (a documented scope decision, not an oversight) — worth preserving
  rather than "improving" during migration.
- **No per-report RBAC** — only the blanket `module="scm"` gate; any user who can see any SCM
  report can see every one, including supplier-spend and cost-priced inventory-valuation data.
- **Export is CSV-only** throughout (via one shared `exportRowsToCsv` utility); no PDF/print
  anywhere in this area. Each report exports only its own specific table, with hand-picked column
  labels that should be preserved verbatim if replicating export behavior.
- **Chart library**: `recharts` exclusively (Pie/Bar/Line/ResponsiveContainer) — no other charting
  library used anywhere in SCM Reports.
- Numerous **denormalized "snapshot" fields** (`vendorNameSnapshot`, `customerNameSnapshot`,
  `carrierNameSnapshot`, `productNameSnapshot`, `warehouseNameSnapshot`) are read as display
  fallbacks throughout, but Reports itself never writes any of them — each receiving module (not
  Reports) owns the decision of whether to keep these as genuine point-in-time audit columns or
  replace with a live join.

---

## 9. Cross-cutting findings across the entire SCM module (all areas, §3–§8)

1. **No role-based/fine-grained permission model exists anywhere in legacy SCM.** Every single
   area — Suppliers, every Procurement document, Inventory, Fulfillment/Picking/Packing/
   Logistics/Returns, Quality, Reports — is gated by exactly one boolean: `hasAccess('scm')`.
   There is no approver-vs-requester separation, no amount-based approval threshold, no
   self-approval prevention, and no finer-grained "can view but not mutate" distinction anywhere
   in ~106 files. **This is the single largest functional gap to design fresh** — legacy provides
   no behavior to port here, only a long list of approval-shaped states (`PENDING_APPROVAL`,
   `APPROVED`, etc.) with no actual authorization backing them.
2. **No backend of any kind.** Every "service" file in SCM is a thin wrapper directly around the
   Firebase client SDK, executed in the browser. All business-rule validation (stock guards,
   approval gates, uniqueness checks) currently runs as client-side TypeScript — migrating to
   NestJS means re-implementing every one of these as real server-enforced logic, not simply
   moving the same JS to a different process.
3. **A consistent set of Firebase-only compensating patterns recur in every single area**:
   hand-rolled optimistic concurrency via single-path `runTransaction` (`transitionStatus`/
   `transitionWithSideEffect`), a global action-lock node (`withActionLock`, 60s staleness
   timeout) substituting for row locks, idempotency-by-side-record (`postOnce` against a
   "posting claims" node) substituting for unique constraints, and empty-array-on-write-loss
   requiring read-time normalization. All four disappear naturally once real Postgres
   transactions, unique constraints, and row locks are available — none should be ported as-is.
4. **Denormalized "snapshot" fields are the dominant data-modeling idiom** (vendor/customer/
   carrier/product/warehouse name+code snapshots, on nearly every document type across every
   area). Each one needs an explicit per-field decision during migration: normalize to a live
   join, or deliberately keep as a point-in-time audit column — several code comments suggest the
   latter is sometimes intentional (e.g. "vendor name as it was at PO time"), not just a
   Firebase-era workaround, so this cannot be decided uniformly for the whole module at once.
5. **Several status-enum values are defined but never actually produced by any code path**
   (`RfqStatus.ISSUED`, `QuotationStatus.DRAFT/UNDER_REVIEW/EXPIRED`, `GrnStatus.RECEIVED/
PARTIALLY_RECEIVED`, `RequisitionStatus.UNDER_REVIEW`, `ComparisonStatus` unused variants) —
   don't carry every legacy union member into a new Postgres enum/CHECK constraint without first
   checking whether it's reachable; some are dead/vestigial.
6. **No file/attachment handling in SCM proper** except Suppliers (Cloudinary-based document
   upload) — Quality explicitly has no photo-evidence capability, Procurement/GRN has no
   attachment support, Logistics has no proof-of-delivery upload despite a `proofOfDeliveryUrl`
   field existing on the Shipment type (declared but never written to by any file read).
7. **Finance/Accounts-Payable integration is explicitly, visibly unimplemented** — "Credit/Debit
   Note — Not generated — finance integration pending" (Quality) and "Invoice — Finance
   integration pending" (Logistics) are literal UI placeholder strings, confirming this is a known,
   intentional gap rather than something to discover during migration.
8. **No real carrier/webhook integration** in Logistics — 100% manual data entry for tracking
   numbers and delivery status; nothing to port in terms of external API credentials.
9. **Numbering is already centralized** in one shared utility across every document type in every
   area (`TW/PR`, `TW/RFQ`, `TW/SQ`, `TW/PO` (shared with legacy Finance), `TW/GRN`, `TW/FUL`,
   `TW/PICK`, `TW/PACK`, `TW/SHIP`, `TW/CR`, `TW/VR`, `TW/QC`), format `{PREFIX}/{FY}/{seq:04d}`,
   backed by a per-prefix-per-FY Firebase transactional counter — this pattern (one shared
   numbering concept, prefix-parameterized) is worth preserving structurally in the new backend
   even though the underlying counter mechanism changes completely.
10. **Reports' full-collection-fetch-then-client-aggregate pattern (§8) is the single highest
    migration-effort item in the entire SCM audit** — nine screens' worth of client-side
    aggregation logic (`groupBy`, `topN`, `bucketByPeriod`, `averageDurationDays`, per-domain
    `compute*Report` functions) all need to become server-side SQL queries, not a 1:1 code port.

---

## 10. Comparison against the current production repo

- **Schema**: zero `scm` Prisma models exist today (`packages/database/prisma/schema.prisma` has
  no `@@schema("scm")` block) — every table in this audit is new work, with no existing partial
  implementation to reconcile against (unlike CRM, which already had Account/Contact).
- **Permissions**: `packages/database/prisma/permissions/catalog.ts` has zero `scm.*` entries
  today. Given finding §9.1 (legacy has no fine-grained RBAC at all), the new system has a real,
  greenfield decision to make on every SCM entity's permission shape — there is no legacy
  `.own`/`.team`/`.all` convention to mirror the way CRM's did, since legacy never modeled
  approval authority as a role at all.
- **Existing conventions to reuse** (established by CRM/HR, not SCM-specific): org-scoped
  `<entity>.read`/`.write` (+ a separate `.delete` where CRM Quotes set that precedent),
  append-only history tables enforced by a DB trigger (used for `OpportunityStageHistory` —
  directly analogous to what Inventory's Stock Ledger needs, and to what an audit-log table for
  every SCM approval action would need), server-computed/never-client-trusted totals
  (`apps/api/src/modules/crm/shared/money.ts`'s `round2`/`computeLineBreakdown` pattern — directly
  reusable for PR/RFQ/Quotation/PO/GRN line totals, which use near-identical gross→discount→tax→
  total math to CRM Quotes), and the DB-identity/idempotent-seed verification discipline already
  used for CRM's menu-item fix.
- **UI conventions to reuse**: `apps/ui/src/features/crm/*` component structure (`hooks.ts`,
  `api.ts`, `components/*Form.tsx`, `*List.tsx`, `*DetailView.tsx`), the `DynamicSidebar`+seeded
  `MenuItem` pattern (just fixed for CRM) for SCM's own nav entries, and React Query hook
  conventions (`useX`, `useCreateX`, `useReplaceX`) already established across every CRM feature.

## 11. Proposed implementation plan — starting with Supplier Master

This section is a **plan, not code** — nothing below has been implemented.

### Why Suppliers first

Confirmed by this audit: Procurement (PR/RFQ/Quotation/PO), Quality (supplier-linked inspections),
and Reports (Supplier Report, Procurement Report) all reference a Supplier by id. Modeling it
first avoids placeholder/nullable FKs everywhere else, exactly mirroring how CRM started from
Account before Contact. Suppliers is also the _smallest_ real entity audited (5 files, one
Firebase collection, no multi-document workflow) — the natural first vertical slice.

### Proposed scope for a Supplier Master slice

1. **Prisma model** `Supplier` in a new `scm` Postgres schema (`@@schema("scm")`, matching the
   existing `crm`/`hr`/`platform` schema-separation convention) — org-scoped, fields mapped from
   the legacy `Vendor` shape (§3) minus the fields confirmed unused by the SCM UI (`category`,
   `trusted`, the four `bank*` fields — those are legacy-Purchases-only; explicit decision needed
   on whether to carry them for future AP work or omit until needed).
2. **Permissions**: `scm.supplier.read` / `scm.supplier.write` (org-scoped), following the CRM
   convention; defer a `.delete` split unless a destructive-delete need actually surfaces (CRM
   Quotes' separate-delete precedent was driven by a specific business requirement, not a default
   pattern to apply everywhere).
3. **Uniqueness**: a real Postgres `UNIQUE` constraint on `(organizationId, supplierCode)` —
   directly replacing the Firebase claim-node workaround (§3), eliminating an entire class of
   legacy-only code.
4. **Status**: reproduce `Active|Inactive|Pending Approval|Blocked` as a plain string field (no
   DB-enforced transition guard), matching the CRM convention of leaving status freely editable
   where legacy itself had no real workflow (§3 confirms Suppliers never had one) — this is a
   direct, low-risk precedent already established for `Opportunity.status`/`Quotation.status`.
5. **Validation**: port GSTIN/PAN regex validation server-side (zod schema in `packages/core`);
   explicitly add real email-format validation as a deliberate _improvement_ over the legacy gap
   found in §3, not a silent behavior change — flag it for your review rather than assuming it's
   wanted.
6. **UI**: list + create/edit dialog + detail view, mirroring `apps/ui/src/features/crm/accounts/`
   structure; detail-page tabs beyond Overview/Contacts should stay **deferred placeholders** only
   where legacy itself has no real data yet (RFQs, Quotations, Bills, Returns, Performance) —
   consistent with this project's standing "no fake functional tabs or mock data" rule.
7. **Navigation**: add a `scm` parent `MenuItem` + a `scm-suppliers` child (gated by
   `scm.supplier.read`), following the exact pattern just fixed for CRM's own missing menu items
   — including the same empty-parent-pruning behavior already shipped in `MenuService`.
8. **Explicitly deferred from this first slice** (per legacy findings, to avoid scope creep):
   Cloudinary document upload, QR/barcode integration, the "Products Supplied" computed tab, and
   any Procurement/Quality/Reports cross-links — those land with their own respective audited
   entities later, matching the "one entity per vertical slice" discipline already used for CRM.

### Recommended sequencing after Suppliers (not yet approved, for your review)

Procurement's PR→RFQ→Quotation→Comparison→PO→GRN chain is the next natural target (it's the
single most-interconnected pipeline found, and most other areas — Inventory's `incoming` bucket,
Quality's GRN-sourced inspections — depend on at least PO/GRN existing). Inventory's Stock Ledger
would then follow PO/GRN (since GRN posting is Inventory's primary write path), with Quality and
Reports coming after real data exists to report on. This sequencing is a recommendation only —
not something this audit is authorized to begin.

## 12. Verification record

- **CRM/sidebar re-verification**: repeated `git status --short` on both repos before starting
  this audit — identical to the end-of-last-session state, confirming no drift and that the
  CRM menu fix from the prior turn remains intact and uncommitted as left.
- **CRM smoke/E2E suite**: Postgres (5432), Redis (6379), and the API (3000) were all reachable
  this session. The disposable `texawave_erp_test` database already existed and was confirmed
  current (`prisma migrate deploy` → "No pending migrations to apply") before anything was run
  against it — no shared dev-database writes were made. `pnpm run test:e2e -- crm` was launched
  against `texawave_erp_test` with `REDIS_URL=redis://localhost:6379/5` (non-zero index, per the
  suite's own safety guard) — **results are reported separately once the run completes**, not
  assumed here.
- **SCM audit**: six parallel read-only research agents were used (Suppliers, Procurement,
  Inventory, Orders/Fulfillment+Warehouse-picking-packing+Logistics+Returns, Quality, Reports),
  each restricted to `D:\New folder\TexaWave_ERP` with Read/Grep/Glob/read-only Bash tools only.
  No legacy file was created, edited, or deleted by this audit or by any of the six agents.
- **No application code, migration, database schema, or Git state was changed by this audit.**
  `git status --short` on `Texawave_Erp_Production` shows only this one file
  (`Docs/SCM_LEGACY_PARITY.md`) as newly modified beyond the pre-existing uncommitted CRM/menu
  work from the prior session; the legacy repo shows its same two pre-existing, unrelated
  modifications, untouched by this session.
