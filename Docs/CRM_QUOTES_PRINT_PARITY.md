# CRM Quotations — Print / PDF Legacy Parity Audit

Audit only. No application code, Prisma schema/migration, database, or Git state was
created or modified by this audit. See §8 for verification evidence.

## 0. Scope and method

Legacy source inspected directly (full file reads, not excerpts):

- `TexaWave_ERP/src/components/QuotationPrintTemplate.tsx` (861 lines) — read in full.
- `TexaWave_ERP/src/modules/crm/QuoteForm.tsx` — `printData` memo (lines 274–297) and
  `handlePrint` re-confirmed directly for this audit; the rest of the file was already
  read in full during the prior Quotes CRUD audit (`Docs/CRM_QUOTES_LEGACY_PARITY.md`).
- `TexaWave_ERP/src/utils/addressUtils.ts` — read in full.
- `TexaWave_ERP/src/lib/currencySymbols.ts` — read in full.

New-repo source inspected directly:

- `packages/database/prisma/schema.prisma` — `Quotation` / `QuotationLineItem` models.
- `packages/api-types/src/crm-quotations.ts` — full wire types.
- `apps/api/src/modules/crm/quotations/quotations.repository.ts` — totals formula
  (`grandTotal = subtotal − totalDiscount + totalTax + adjustment`, confirmed at
  lines 241–242 / 317–318).
- `apps/api/src/modules/crm/shared/money.ts` — `round2` / `computeLineBreakdown`.
- `apps/ui/src/features/crm/quotations/components/QuotationForm.tsx`,
  `QuotationDetailView.tsx`, `apps/ui/src/app/(dashboard)/crm/quotes/**`.
- `apps/ui/src/features/crm/opportunities/components/DealQuotesSection.tsx`,
  `OpportunityDrawer.tsx`.
- Confirmed via `grep`: no `date-fns` dependency or usage anywhere in `apps/ui` today.

Findings below are marked **Confirmed** (read directly), **Absent (verified)** (checked
for, not present), or **Open decision** (a choice for implementation, not a legacy fact).

## 1. Legacy behavior and template structure

### 1.1 Print trigger (`QuoteForm.tsx`)

- **Confirmed.** A "Print / PDF" button (line 490) calls `handlePrint` (line 299).
- **Confirmed.** `handlePrint` does `window.open('', '_blank', 'width=900,height=1000')`,
  writes `printRef.current.innerHTML` (the already-rendered, hidden
  `<QuotationPrintTemplate>` output, line 507) into a brand-new HTML document via
  `document.write`, with an inline `<style>` block (`@page { size: A4 portrait; margin:
6mm; }`, `-webkit-print-color-adjust: exact !important`, `thead{display:table-header-
group}`, `tfoot{display:table-footer-group}`, `tr,.no-break{page-break-inside:avoid}`),
  then calls `window.print()` after a 250 ms `setTimeout`, then closes the popup window.
  No PDF library is involved — "Print to PDF" is whatever the browser's native print
  dialog offers.
- **Confirmed.** `printData` (lines 274–297) is a `useMemo` that adapts the live form
  state into `QuotationPrintProps`. This is the authoritative legacy field mapping and
  is quoted in full in §2 below.
- **Open decision carried from `CRM_QUOTES_LEGACY_PARITY.md`:** printing was explicitly
  deferred in the approved Quotes implementation (decision D6). This audit does not
  re-open that decision; it only establishes what a future print slice would need.

### 1.2 Template structure (`QuotationPrintTemplate.tsx`)

- **Confirmed.** The component is **not** CRM-specific — it lives at
  `src/components/QuotationPrintTemplate.tsx`, outside `src/modules/crm/`, and is shared
  with the unrelated Sales module's GST invoicing flow. It was correctly never copied by
  the earlier wholesale CRM reference-tree copy phases.
- **Confirmed — pagination is NOT pure CSS.** Before rendering, the component runs a
  greedy packing loop (lines ~165–235) that estimates each line item's pixel height
  (`28 + Math.ceil(description.length / 38) * 12`) against fixed page-region constants
  (`PAGE_HEIGHT=1114`, `COMP_HEADER_P1=110`, `COMP_HEADER_OTHER=130`,
  `CLIENT_DETAILS_H=160`, `TABLE_HEADER_H=45`, `FOOTER_H=380`, plus a 90px/30px safety
  buffer for first/later pages) and pre-splits `lineItems` into `itemChunks: Array<Array
<LineItem>>`. Each chunk renders as one `.quotation-a4-page` `<section>`; only the
  first chunk shows the client-details block, every chunk repeats the company header
  (with a "(CONTINUED)" banner variant), and only the **last** chunk renders the totals/
  bank/signature/terms footer (`renderFinalFooter`). CSS `page-break-inside`/`break-
inside: avoid` rules are a second, reinforcing layer on top of this JS pre-pagination,
  not a replacement for it.
- **Confirmed — embedded binary asset.** Line 88 is a single ~65,800-character
  `data:image/png;base64,...` string (`WATERMARK_DATA_URI`, a full-page background
  watermark graphic), inlined directly in the TSX source and referenced via
  `background-image: url('${WATERMARK_DATA_URI}')` in `.quotation-page-watermark`. This
  is the reason whole-file reads of this component exceed normal tool size limits. It is
  not a secret/credential, but it is a sizable embedded binary dependency that any port
  must account for (extract to a real static asset, or omit the watermark).
- **Confirmed — company letterhead/branding is 100% hardcoded**, not prop-driven:
  `texaLogo.jpeg` (imported from `../modules/sales/texaLogo.jpeg`), the literal strings
  "TEXAWAVE INNOVATIONS PRIVATE LIMITED", "Advanced ERP & Engineering Solutions", the
  literal address "No 93/206 Canal Bank Road, Indra Nagar, Adyar, Chennai - 600 020,
  Tamil Nadu, India", and the literal **GSTIN "33AAMCT4293K1ZU"** (`renderCompanyHeader`,
  lines 237–304).
- **Confirmed — hardcoded real-looking bank-account fallback.** When `quotation.
bankDetails` is falsy (always true for CRM, which never supplies this field), the
  template silently renders a specific fallback account: "IDFC First Bank", account
  "10258311882", "Kottivakkam Branch", IFSC "IDFB0080138" (lines 538–587). This is not a
  literal credential, but it is real-looking financial account data baked into
  presentational code with no gate — flagged explicitly per the task's "no secrets"
  posture even though it is not technically a secret.
- **Confirmed — self-contained helpers, no hidden external coupling.** `COLORS` (object
  literal, lines 75–84), `CURRENCY_NAMES`/`CURRENCY_SUBUNIT_NAMES` (lines 90/93, 5
  currencies each: INR/USD/EUR/GBP/AED), `numberToWords` (lines 95–134, pure
  crore/lakh/thousand Indian-numbering word converter, parameterised by `currencyName`/
  `subunitName` so it is not INR-only despite the naming), `fmt` (lines 136–137, `Number(
num||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})` —
  note: always uses the `en-IN` locale for digit grouping regardless of `currency`, i.e.
  a USD amount still prints with Indian 2-3-2 digit grouping, not Western 3-3-3), and
  `defaultTermsText` (lines 139–143, a 5-line hardcoded fallback used only when
  `quotation.termsAndConditions` is empty) are all defined **inside this file**, with no
  external imports or Firebase/Sales-service dependency.
- **Confirmed — exactly 5 real external imports**, enumerated with their coupling:
  1. `format` from `date-fns` — generic npm package, no coupling.
  2. `texaLogo` from `../modules/sales/texaLogo.jpeg` — Sales-module-owned static asset.
  3. `getFinancialYearString` from `@/modules/sales/utils/numberGenerator` — Sales-
     module utility, used only in the dead fallback `q.qoNumber || q.quoteNumber ||
\`TW/QUO/${getFinancialYearString()}/101\``— CRM always supplies`quoteNumber`, so
     this branch never executes for CRM-sourced prints.
  4. `CURRENCY_SYMBOLS` from `@/lib/currencySymbols` — a tiny, generic, app-level
     `Record<string,string>` (`{INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'AED '}`, 5 lines
     total, read in full). Not Sales-specific; the CRM module's own `domain/currency.ts`
     already re-exports this same object as `CRM_CURRENCY_SYMBOLS`.
  5. `formatAddress` from `@/utils/addressUtils` — read in full (68 lines). Pure,
     duck-typed string formatter: accepts `addr.pincode || addr.postalCode || addr.zip`
     and `addr.street || addr.street1 || addr.addressLine1 || addr.address`, joins
     `[street, area, "city, state - pin", country]` with newlines, returns `'—'` for a
     null/empty address. No Firebase/Sales coupling; already tolerant of the `postalCode`
     naming the new schema uses.
- **Confirmed — GST/tax rendering is currency-gated, and this is the single highest-risk
  finding of the audit:**
  ```
  isDomesticGst = currency === 'INR'
  isDomesticGst && cgstAmount > 0  → "CGST @{cgstPercent || 9}%"
  isDomesticGst && sgstAmount > 0  → "SGST @{sgstPercent || 9}%"
  isDomesticGst && igstAmount > 0  → "IGST @{igstPercent || 18}%"
  !isDomesticGst && igstAmount > 0 → "Tax" (no percent shown)
  ```
  `cgstPercent`/`sgstPercent`/`igstPercent` are **display-only hardcoded fallbacks**
  (9/9/18) used whenever the actual percent prop is absent — they do not reflect the
  real tax composition of the quote.
- **Confirmed — "Amount in Words"**: `numberToWords(q.grandTotal, currencyName,
subunitName)`, self-contained, correctly currency-aware via the two name maps.
- **Confirmed — Terms & Conditions rendering** (lines 609–618): a bordered box titled
  "Terms & Conditions", rendering `formattedTerms` (either the caller's array/newline-
  split string, or the 5-line `defaultTermsText` fallback) as one `<div>` per line.
- **Confirmed — items table** (lines 373–463): fixed 6 columns via `<colgroup>` — S.No
  (42px) / Description (auto) / **HSN Code (80px, always rendered, `'—'` fallback)** /
  Qty (55px) / "Unit Price ({symbol})" (92px) / "Total ({symbol})" (100px). Row total:
  `item.netAmount || item.amount || item.qty * item.unitRate || 0`. Optional transport-
  charge row only on the final chunk, only if `transportCharge > 0` (never true for CRM).
- **Confirmed — print/responsive CSS** (lines 622–832, full block read):
  - Screen and print share a `.quotation-a4-page` sized at a fixed `210mm × 297mm`
    (hard A4, not responsive to viewport/paper-size changes).
  - `@media print` sets `@page { size: A4 portrait; margin: 0; }` and moves all page
    padding onto `.quotation-page-content` instead (`padding: 12mm 8mm 10mm 8mm`),
    `break-after: page` / `page-break-after: always` on every `.quotation-a4-page`
    except `:last-child`, and `break-inside: avoid` / `page-break-inside: avoid` on the
    header/title-banner/client-details/items-section/footer/declaration blocks as a
    second line of defence on top of the JS-side pre-pagination.
  - A `.quotation-a4-page::after` pseudo-element draws a decorative border frame inset
    from the page edges, print-only.
  - No explicit accessibility affordances exist anywhere in the template: no `role`,
    no `lang`, no heading hierarchy (`<h1>`-`<h6>`) — everything is `<div>`/`<span>`
    with inline styles; the only ARIA present is `aria-label="Quotation page N"` on each
    page section and `aria-hidden="true"` on the watermark layer.

## 2. Field-by-field legacy-to-new data mapping

Ground truth for the legacy side is the **actual adapter already in production**,
`QuoteForm.tsx` lines 274–297 (quoted above), not a theoretical reading of
`QuotationPrintProps`. This matters: it shows exactly which optional print-template
fields CRM already leaves `undefined` today, which is the real baseline to preserve.

| `QuotationPrintProps` field                             | Legacy CRM source (`printData`)                                                                   | New `Quotation`/`QuotationLineItem` field                                                                                                                                                  | Mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quoteNumber`                                           | `existing?.quotationNumber \|\| 'DRAFT'`                                                          | `quotationNumber`                                                                                                                                                                          | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `qoNumber`                                              | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `currency`                                              | form state                                                                                        | `currency` (defaults `"INR"`, matches legacy default)                                                                                                                                      | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `quoteDate`                                             | form state                                                                                        | `quoteDate`                                                                                                                                                                                | Direct (ISO string → legacy expects a parseable date string; both sides compatible)                                                                                                                                                                                                                                                                                                                                                                                |
| `validity`                                              | `validUntil` (form state)                                                                         | `validUntil`                                                                                                                                                                               | Direct, same meaning, different prop name — adapter renames it                                                                                                                                                                                                                                                                                                                                                                                                     |
| `paymentTerms`                                          | form state                                                                                        | `paymentTerms`                                                                                                                                                                             | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `deliveryTerm` (singular prop)                          | `deliveryTerms` (plural local var)                                                                | `deliveryTerms` (plural field)                                                                                                                                                             | Direct, naming already differs on the legacy side too — not a new mismatch                                                                                                                                                                                                                                                                                                                                                                                         |
| `modeOfDispatch`                                        | never set                                                                                         | `carrier`                                                                                                                                                                                  | **Open decision**: conceptually plausible 1:1 (dispatch mode / carrier), not literally proven identical in legacy; CRM has never populated either print field today                                                                                                                                                                                                                                                                                                |
| `remarks`                                               | `notes` (form state)                                                                              | `notes`                                                                                                                                                                                    | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `comments`                                              | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `termsAndConditions`                                    | `termsConditions` (form state, a single string)                                                   | `termsConditions` (single string)                                                                                                                                                          | Direct — legacy prop accepts `string \| string[]`; CRM only ever supplies a string on both sides                                                                                                                                                                                                                                                                                                                                                                   |
| `customerName`                                          | `selectedAccount?.name \|\| 'Customer'`                                                           | `quotation.account.name` (via `Pick<Account,"id"\|"name">` relation, confirmed in `crm-quotations.ts`)                                                                                     | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `customerGST`/`customerPAN`/`customerCIN`               | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides — CRM/Account has no such fields                                                                                                                                                                                                                                                                                                                                                                                                      |
| `billingAddress`                                        | `{street, city, state, pincode: billing.postalCode, country}` (constructed object)                | Flat scalars: `billingStreet`/`billingCity`/`billingState`/`billingPostalCode`/`billingCountry`                                                                                            | **Adapter required**: build the same `{street, city, state, pincode, country}` shape from the flat fields — legacy already does the identical construction from its own flat `billing.*` form fields, so this is not a new pattern                                                                                                                                                                                                                                 |
| `shippingAddress`                                       | same pattern as billing                                                                           | `shippingStreet`/`shippingCity`/`shippingState`/`shippingPostalCode`/`shippingCountry`                                                                                                     | Same adapter as billing                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `lineItems[].sNo`                                       | `i + 1` (array index)                                                                             | not stored directly; `lineOrder` gives persisted order                                                                                                                                     | Recompute as `index + 1` after sorting by `lineOrder`, exactly as legacy does from its own array index                                                                                                                                                                                                                                                                                                                                                             |
| `lineItems[].productDescription`                        | `l.description \|\| l.productCode \|\| 'Item'`                                                    | `description` (+ `productCode`)                                                                                                                                                            | Direct, same fallback chain reproducible                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lineItems[].hsnCode`                                   | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lineItems[].qty`                                       | `l.quantity`                                                                                      | `quantity` (Decimal, wire type `string`)                                                                                                                                                   | Direct, needs `Number(...)` coercion for the template's arithmetic fallback                                                                                                                                                                                                                                                                                                                                                                                        |
| `lineItems[].unitRate`                                  | `l.unitPrice`                                                                                     | `unitPrice` (Decimal → `string`)                                                                                                                                                           | Direct, same coercion note                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `lineItems[].netAmount`                                 | `computeLine(l).total` (recomputed client-side in legacy)                                         | `amount` (persisted, server-computed via `computeLineBreakdown`)                                                                                                                           | Direct — new value is the _authoritative, already-persisted_ total; prefer it over recomputing                                                                                                                                                                                                                                                                                                                                                                     |
| `subtotal`                                              | `totals.subtotal`                                                                                 | `subtotal`                                                                                                                                                                                 | Direct                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `cgstAmount`/`sgstAmount`/`cgstPercent`/`sgstPercent`   | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `igstAmount`                                            | `totals.totalTax \|\| undefined`                                                                  | `totalTax`                                                                                                                                                                                 | Direct — **and this confirms the mislabeling risk in §4 is a pre-existing legacy behavior, not something a port would newly introduce**                                                                                                                                                                                                                                                                                                                            |
| `igstPercent`                                           | never set (hardcoded display fallback `18` kicks in)                                              | —                                                                                                                                                                                          | Absent (verified) both sides — new system has no single blended tax percent (CRM allows unbounded per-line `taxPercent`)                                                                                                                                                                                                                                                                                                                                           |
| `transportCharge`/`transportHSN`/`transportDescription` | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `roundOff`                                              | `totals.grandTotal - totals.subtotal - totals.totalTax + totals.totalDiscount` (derived residual) | `adjustment` (a genuine, independently client-supplied manual +/- input, confirmed via `quotations.repository.ts` formula `grandTotal = subtotal − totalDiscount + totalTax + adjustment`) | **Algebraically identical slot** — both formulas resolve to the same equation shape, so `adjustment` is the correct field to print in the "Round Off" row. Semantic nuance: legacy's value is always an incidental rounding residual (should be ≈0); the new field is an intentional, user-entered manual adjustment that can be any size. **Open decision**: relabel the row "Adjustment" instead of "Round Off" to avoid implying it's just floating-point noise |
| `grandTotal`                                            | `totals.grandTotal`                                                                               | `grandTotal`                                                                                                                                                                               | Direct, both server/computed-authoritative                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bankDetails`/`sealUrl`/`signatureUrl`                  | never set                                                                                         | —                                                                                                                                                                                          | Absent (verified) both sides — legacy already falls back to the hardcoded bank block and placeholder boxes for every CRM-sourced print today                                                                                                                                                                                                                                                                                                                       |

**Net finding:** every field the legacy CRM form _actually_ populates today has a direct
or trivially-adaptable counterpart in the new schema. Nothing the new schema is missing
was ever supplied by CRM in the first place. The only two items requiring an explicit
product decision rather than a mechanical adapter are the IGST-mislabeling behavior and
the `roundOff`/`adjustment` relabeling, both covered in §6.

## 3. Dependencies and required adaptations

| Dependency                                    | Status in new repo                                                                                                                | Adaptation needed                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `date-fns` (`format`)                         | **Absent (verified)** — not in any `package.json`/lockfile, not imported anywhere in `apps/ui/src` (confirmed via repo-wide grep) | New repo's own convention (seen in `OpportunityDrawer.tsx`, `DealQuotesSection.tsx`) is native `Date`/`toLocaleString`/`.slice(0,10)` — **recommend reproducing the `dd/MM/yyyy` format with native `Intl.DateTimeFormat` or manual padding instead of adding a new dependency**, per the task's "no unrelated dependencies" constraint |
| `texaLogo.jpeg`                               | Not present (CRM reference tree never included Sales assets)                                                                      | Needs an explicit decision: use the real TexaWave logo asset (re-exported/copied as a static image, not a secret) or a generic placeholder/no-logo layout                                                                                                                                                                               |
| `WATERMARK_DATA_URI` (65KB inline base64 PNG) | Not present                                                                                                                       | Should be extracted to a real static asset file under `apps/ui/public/` if the watermark is wanted; trivial to omit entirely for a first slice (CSS-independent)                                                                                                                                                                        |
| `@/lib/currencySymbols` (`CURRENCY_SYMBOLS`)  | Not present in new repo under that path                                                                                           | Trivial 5-line `Record<string,string>` to recreate locally in the new print component or alongside existing CRM currency handling                                                                                                                                                                                                       |
| `@/utils/addressUtils` (`formatAddress`)      | Not present                                                                                                                       | Trivial 68-line pure function to port verbatim (no Firebase/Sales coupling); already tolerant of `postalCode` naming                                                                                                                                                                                                                    |
| `getFinancialYearString`                      | Not needed                                                                                                                        | Dead code path for CRM (see §2); do not port                                                                                                                                                                                                                                                                                            |
| Firebase/runtime config                       | **Absent (verified)** — the template itself has zero Firebase imports; all data arrives via props                                 | No action — confirms the print layer itself was never Firebase-coupled, only the surrounding `QuoteForm.tsx` data-loading was (already replaced by the new API)                                                                                                                                                                         |

## 4. Can the legacy template be adapted without changing persisted data or financial calculations?

**Yes**, with caveats, based on direct evidence:

- Every number the template displays (`subtotal`, `totalTax`→`igstAmount`,
  `grandTotal`, per-line `amount`) can be sourced **read-only** from the already-
  persisted, server-computed `Quotation`/`QuotationLineItem` records returned by the
  existing `GET` quotation endpoint. No recomputation, no new write path, no change to
  `money.ts`, no change to the replace-all-on-save semantics is required.
- The only "computed" value the print layer needs that isn't a 1:1 stored field is
  `roundOff`, and §2 shows this is algebraically identical to the already-stored
  `adjustment` field — so even this is a direct read, not a recomputation.
- The risk is entirely in the **display/labeling layer**, not the data layer: the
  hardcoded company letterhead/GSTIN, the hardcoded bank-account fallback, the
  currency-gated CGST/SGST/IGST labels with hardcoded display percentages, and the
  HSN-code column that CRM data never populates. These are presentational decisions
  that an adapter component controls; none of them require touching
  `Quotation`/`QuotationLineItem` rows, migrations, or the totals formula.

## 5. Recommended integration point (new repo)

- **Confirmed absent today**: no Print button exists in `QuotationForm.tsx` (comment at
  line 97 explicitly documents the deferral), no print route, no print API endpoint.
- **Smallest safe integration point**: add a "Print / PDF" `Button` to the existing
  footer action row in `QuotationForm.tsx` (alongside Cancel/Save Draft/Save & New/Save,
  lines 498–503), enabled only when `existing` is set (i.e. the quotation has already
  been saved and has a real `quotationNumber`/persisted totals) — reproducing legacy's
  `window.open` + inline-document + `window.print()` pattern against a **new, adapted**
  React print component built from the real `useQuotation(id)` data already loaded by
  `QuotationDetailView`/`QuotationForm`.
- This requires **no new API endpoint** — the quotation detail fetch already returns
  everything in the mapping table (header fields, `account.name`, `lineItems[]`,
  totals). No new permission is needed beyond the existing `crm.quotation.read` the
  page already enforces.
- **Open decision**: whether to allow printing an unsaved draft the way legacy does
  (legacy's `printData.quoteNumber` falls back to the literal string `'DRAFT'` for an
  unsaved quote). Recommend requiring a save first in the new system, since the new
  schema's numbering and totals are strictly server-computed and there is no
  client-side equivalent of a "preview" total to show safely before the first save.

## 6. Risks and unresolved decisions

1. **IGST mislabeling for domestic (INR) quotes — highest-priority decision.**
   Because `Quotation.currency` defaults to `"INR"` and the natural adapter maps
   `igstAmount = totalTax` (exactly what legacy itself already does), the
   `isDomesticGst` branch fires by default and would print a row literally labeled
   **"IGST @18%"** — a hardcoded display percentage — regardless of the quote's actual
   blended per-line `taxPercent` composition (CRM allows unbounded, per-line tax rates,
   not a single GST rate). This is a **pre-existing legacy behavior**, not something a
   port introduces, but reproducing it in the new ERP would carry the same inaccuracy
   forward. Options: (a) reproduce legacy's behavior exactly for strict parity, (b)
   replace the GST-specific label with a generic "Tax" row for all currencies
   (dropping the `isDomesticGst` branch entirely, since CRM has no true CGST/SGST/IGST
   split), or (c) show the real blended effective rate (`totalTax / (subtotal -
totalDiscount) * 100`) instead of a hardcoded percent. This needs an explicit
   decision before implementation — not something this audit should decide
   unilaterally.
2. **Hardcoded bank-account fallback.** The template silently renders a specific,
   real-looking bank account when `bankDetails` is absent (always true for CRM).
   Needs an explicit decision: omit the banking section entirely for CRM-sourced
   prints (recommended, since CRM has never had a concept of per-quote bank details),
   or require an explicit organization-level bank-details setting before showing any
   banking block.
3. **Hardcoded company identity/letterhead/GSTIN/logo.** Fine for a single-tenant
   legacy deployment; needs a decision for the new org-scoped multi-tenant ERP —
   reproduce as a fixed TexaWave letterhead (current org only) or parameterize per
   organization. Out of scope to decide here; flagged for the implementation phase.
   This is a visual/business decision, not a data-model change.
4. **Manual JS pixel-height pagination heuristic.** The `itemHeight = 28 +
Math.ceil(description.length / 38) * 12` estimate and fixed page-region constants
   are tuned to the exact fonts/sizes/margins of this one template. Porting it verbatim
   risks subtly wrong page breaks if any new-repo global CSS (font stack, base font
   size, `ui-kit` component styles) differs from legacy's standalone print document.
   Needs visual verification against representative long quotations (see test matrix,
   §7) before trusting it, not just a code port.
5. **`en-IN` locale digit grouping applied regardless of `currency`.** `fmt()` always
   formats using `'en-IN'`, so a USD/EUR/GBP/AED quote would still show Indian-style
   digit grouping (e.g. `1,00,000.00` instead of `100,000.00`). Pre-existing legacy
   behavior; worth an explicit decision on whether to fix for non-INR currencies.
6. **`roundOff` → `adjustment` relabeling**, per §2 — recommend renaming the printed
   row label from "Round Off" to "Adjustment" to match the new field's actual
   intentional-input semantics, since this is a presentational change only (no data
   impact).
7. **Popup-blocker risk**, inherent to the `window.open('', '_blank', ...)` pattern:
   browsers may block a popup not opened as a direct, synchronous result of a user
   gesture. Legacy's `handlePrint` is a direct `onClick` handler so this is low risk,
   but any new implementation must preserve that direct-synchronous-call property
   (no `async` work before `window.open`).
8. **No accessibility affordances in the source template** (§1.2) — pre-existing;
   worth deciding whether the new print view should add basic semantic structure
   (`<main>`/`<h1>`/`lang`) since this is presentational-only and would not affect
   rendered/printed output. Not a blocking parity issue since legacy itself has none.
9. **Watermark asset size** (~65KB inline base64) — recommend NOT porting the inline
   base64 pattern even if the watermark graphic itself is kept; use a real static file
   instead, to avoid bloating the new print component's source file.

## 7. Browser print / PDF test matrix

| Scenario                                                                     | What to verify                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Short quotation (1–2 line items)                                             | Single page, footer (totals/terms) renders correctly on the same page as items, no spurious second page                                                                                                                            |
| Medium quotation (~15–20 line items)                                         | Items split across exactly 2 pages at a sensible boundary; second page repeats the "(CONTINUED)" header variant; footer appears only on the last page                                                                              |
| Long quotation (~40+ line items, some with very long free-text descriptions) | Stresses the character-count-based height estimate (`Math.ceil(desc.length/38)*12`); verify no item is visually cut off, no page break lands mid-row despite `page-break-inside: avoid`                                            |
| Empty line items                                                             | "No items added yet" placeholder row renders correctly, totals still show (subtotal/tax/grandTotal = 0)                                                                                                                            |
| Non-INR currency (USD/EUR/GBP/AED)                                           | Correct `symbol`/`currencyName`/`subunitName`; tax row shows generic "Tax" (not CGST/SGST/IGST); "Amount in Words" uses the right currency/subunit name; digit grouping still shows `en-IN` style (known pre-existing quirk, §6.5) |
| Default INR currency with nonzero tax                                        | Confirms whether the IGST-mislabeling decision (§6.1) was resolved as intended                                                                                                                                                     |
| Zero `adjustment`/non-zero `adjustment` (positive and negative)              | "Round Off"/"Adjustment" row only appears when non-zero (existing `Number(roundOff                                                                                                                                                 |     | 0) !== 0` guard), correct sign/value |
| Billing address present / absent, shipping address present / absent          | `formatAddress` fallback to `'—'` when null; multi-line formatting correct for both                                                                                                                                                |
| Popup-blocked print attempt                                                  | Verify graceful handling (toast/error) instead of a silent failure, since `window.open` can return `null`                                                                                                                          |
| Print-to-PDF via Chrome, Firefox, Edge print dialogs                         | Page size (A4), margins, and page-break placement are visually consistent across browsers — browser print engines differ in CSS `break-*` support nuances                                                                          |
| Resize/responsive screen view vs. printed output                             | The on-screen preview (before printing) should not be expected to match print pagination exactly, since pagination is computed independently of live layout — document this as expected, not a bug                                 |

## 8. Repository state — no changes made

This audit performed read-only inspection only (`Read`/`Grep`/read-only `git status`/
`grep` shell commands). No file in either repository was created, edited, or deleted
by this audit prior to this document itself.

- `TexaWave_ERP` (legacy, read-only target): `git status --short` shows pre-existing
  local modifications to `.gitignore` and `src/modules/hr/HRLayout.tsx` that **predate
  this session's involvement** — this audit touched neither file and made zero writes
  anywhere in this repository (every tool call against it was `Read` or `Grep`).
- `Texawave_Erp_Production` (new repo): `git status --short` shows the pre-existing
  uncommitted work from prior approved phases (CRM Leads/Opportunities/Products/
  Quotes, SCM, migrations, etc.) plus, after this audit, exactly one new untracked
  file: `Docs/CRM_QUOTES_PRINT_PARITY.md`. No `.ts`/`.tsx`/`.prisma` file, no migration,
  and no database state was touched.

## 9. Stop point

Per the task's explicit instruction, this audit stops here. No implementation,
migration, or print-component code has been written. Awaiting review and resolution of
the open decisions in §6 before any implementation begins.
