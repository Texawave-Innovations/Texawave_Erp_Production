# Sales backend — API contract

**Scope:** the Sales module's backend (`apps/api/src/modules/sales`), one section per Sales tab.
**Status:** implemented and tested on `feature/sales-api`; UI in progress (§12). **Owner:** unassigned.
Verified by `apps/api/test/sales-*.e2e-spec.ts`. Architecture-level rules (tenancy, baseline
columns, migrations) stay in [`ARCHITECTURE.md`](ARCHITECTURE.md); this file holds the Sales
routes, permissions and business rules. **New Sales work updates this file**; ARCHITECTURE.md
§11 only gets a one-line changelog entry pointing here when a migration is added.

---

## 1. Conventions (all routes)

|          |                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Prefix   | `/sales/...`                                                                                                        |
| Scoping  | **organization-scoped** (`@OrgScoped()` + exact `@RequirePermission()`), not team-scoped                            |
| Bodies   | same as HR ([`HR_API.md`](HR_API.md) §1): `{ "data": … }`, whitelisted DTOs, stable error codes, ids from the token |
| Writes   | one transaction with the change and its audit row                                                                   |
| Deletion | soft delete (`deleted_at`); deleted documents keep their numbers                                                    |
| Money    | `Decimal`, never floats                                                                                             |
| Tables   | Postgres schema `sales`; counters in `platform.document_sequences`                                                  |

## 2. Permissions and default roles

| Permission                                                      | Sales Manager | Sales Executive |
| --------------------------------------------------------------- | :-----------: | :-------------: |
| `sales.dashboard.read`                                          |       ✓       |        ✓        |
| `sales.customer.read` / `.write`                                |       ✓       |        ✓        |
| `sales.customer.delete`, `sales.customer_bank.reveal` (audited) |       ✓       |                 |
| `sales.action_item.read` / `.write`                             |       ✓       |        ✓        |
| `sales.master.read`                                             |       ✓       |        ✓        |
| `sales.master.write`, `sales.running_number.write`              |       ✓       |                 |
| `sales.quotation\|invoice\|delivery_challan.read\|write\|send`  |       ✓       |        ✓        |
| `sales.quotation\|invoice\|delivery_challan.delete`             |       ✓       |                 |
| `sales.invoice_payment.write` (record, edit, delete payments)   |       ✓       |                 |
| `sales.payment.read`                                            |       ✓       |        ✓        |
| `sales.returnable_dc.read\|write\|send`                         |       ✓       |        ✓        |
| `sales.returnable_dc.delete`                                    |       ✓       |                 |

---

## 3. Dashboard — `GET /sales/dashboard` (`sales.dashboard.read`)

Returns the legacy screen's full shape with live customer, checklist, quotation, invoice and
payment figures. Sections whose module is not built yet are zero and flagged in `availability`.

## 4. Customers — `/sales/customers`

| Route                                    | Permission                   |
| ---------------------------------------- | ---------------------------- |
| `GET /`, `GET /:id`                      | `sales.customer.read`        |
| `GET /next-code`, `POST /`, `PATCH /:id` | `sales.customer.write`       |
| `DELETE /:id`                            | `sales.customer.delete`      |
| `GET /:id/bank-account`                  | `sales.customer_bank.reveal` |

- Code `<PREFIX>-<COUNTRY>-<NUMBER>` (`CUS-IN-001`): prefix and width from the master list, country
  from the mobile country code (`+91` → `IN`), number from a per-country counter
  (`sales_customer_IN`) issued in the create transaction. An issued code never changes.
- GSTIN is format-checked (not the check character — legacy data carries invalid ones), unique
  among live customers, and fills in state (editable) and PAN.
- CGST/SGST/IGST rates are optional, typed by the user — no defaults. CGST and SGST are entered
  together, at the same rate (422 `GST_RATES_MISMATCH`).
- Field formats are the shared ones (`apps/api/src/common/dto/field-formats.ts`, mirrored for forms
  by `packages/core/src/schemas/fields.ts`, the same as onboarding):
  - contact person, bank name, branch, city, area and country: letters, spaces, `. ' -`;
  - pincode: 6 digits, not starting with 0;
  - account number: 9–18 digits;
  - IFSC and PAN: as in onboarding;
  - company name: must contain a letter;
  - mobile: a `+91` mobile is 10 digits starting with 6–9 (422 `INVALID_MOBILE`); other country
    codes allow 6–15 digits. The supported country codes, the `+91` default and the per-code
    mobile rule are shared too (`CALLING_CODE_COUNTRIES` / `mobileFormatFor` in the API,
    `CALLING_CODES` / `mobileFieldFor` in `packages/core`).

  On update, each cross-field rule runs only when its fields are sent, so customers stored
  earlier can still be edited.

- Bank account number stored AES-256-GCM encrypted; responses carry only the mask. It needs the
  bank name and IFSC (422 `BANK_DETAILS_INCOMPLETE`). The form also requires a billing address
  (UI only; the API still accepts a customer without one).
- One live default address per customer and type.
- A customer with live documents cannot be deleted.

## 5. Checklist — `/sales/action-items`

`GET /` (`sales.action_item.read`); `POST /`, `POST /:id/complete`, `POST /:id/reopen`,
`DELETE /:id` (`sales.action_item.write`).

## 6. Master list — `/sales/master/...`

Reads need `sales.master.read`; writes need `sales.master.write` unless noted.

### 6.1 Code formats — `/code-formats`

`GET /`, `GET /:codeType`, `PATCH /:codeType`. Prefix and width per code type (customer `CUS`/3;
`TW/QUO`, `TW/PI`, `TW/IN`, `TW/DC`, `TW/PR` (payment received), `TW/RDC` (returnable DC) for
documents).

### 6.2 Running numbers — `/running-numbers` (page 1)

- `GET /?date=YYYY-MM-DD` — every numbered document (quotation, proforma, tax invoice, DC,
  payment received, returnable DC) for that date's financial year (default today): `prefix`, `padding`, `fiscalYear`, `lastNumber`,
  `lastCode`, `nextCode`.
- `PATCH /:codeType` `{ lastNumber, fiscalYear? }` — **`sales.running_number.write`**. Setting `100`
  makes the next document `…/0101`. Done under the counter's row lock; refused with 422
  `RUNNING_NUMBER_IN_USE` below a number already issued with the current prefix (deleted documents
  included). 422 `INVALID_FISCAL_YEAR` for a label like `26-28`; 404 for other code types.

### 6.3 Company details — `/company-profile` (page 2)

- `GET /`, `PUT /` — seller name, address, GSTIN, state. Required before any document is created.
- `GET /logo`, `PUT /logo` (multipart `file`), `DELETE /logo` — PNG/JPEG ≤ 2 MB, type checked by
  content, stored through `FileStorageService`. Printed on every document.

### 6.4 Document fields — `/document-fields` (page 3)

`GET /?documentType=&field=`, `GET /layout`, `GET /:id`, `GET /:id/image`, `POST /`,
`PATCH /:id`, `PUT /:id/image` (multipart `file`), `DELETE /:id`.

| Field                  | Quotation | Proforma | Tax invoice | DC  | Payment received | Returnable DC |
| ---------------------- | :-------: | :------: | :---------: | :-: | :--------------: | :-----------: |
| `VALIDITY`             |     ✓     |          |             |     |                  |               |
| `DELIVERY_TERMS`       |     ✓     |          |             |     |                  |               |
| `PAYMENT_TERMS`        |           |    ✓     |      ✓      |     |                  |               |
| `HSN_CODE`             |     ✓     |    ✓     |      ✓      |  ✓  |                  |               |
| `BANK_ACCOUNT`         |     ✓     |    ✓     |      ✓      |  ✓  |                  |               |
| `COMPANY_SEAL`         |     ✓     |    ✓     |      ✓      |  ✓  |                  |       ✓       |
| `AUTHORIZED_SIGNATURE` |     ✓     |    ✓     |      ✓      |  ✓  |                  |       ✓       |
| `PREPARED_BY`          |     ✓     |    ✓     |      ✓      |  ✓  |                  |       ✓       |
| `PAYMENT_MODE`         |           |          |             |     |        ✓         |               |

- Another field → 422 `FIELD_NOT_ON_DOCUMENT` (also a DB CHECK).
- HSN: 4–8 digit `value`; label defaults to the code. Bank: `bankDetails` (bank name, account,
  branch, IFSC) required; label built from them. Others: `label` only (a payment mode is at most
  50 characters, 422 `LABEL_TOO_LONG`).
- Images only on seal / signature (else 422 `IMAGE_NOT_ALLOWED`), PNG/JPEG ≤ 2 MB.
- One live default per document type and field (partial unique index).

## 7. Documents — quotations, proforma / tax invoices, delivery challans

| Route                                                                            | Permission                     |
| -------------------------------------------------------------------------------- | ------------------------------ |
| `GET /sales/{quotations,invoices,delivery-challans}`, `GET /:id`, `GET /:id/pdf` | `sales.<doc>.read`             |
| `GET /next-number`, `POST /`, `PATCH /:id`                                       | `sales.<doc>.write`            |
| `DELETE /:id`                                                                    | `sales.<doc>.delete`           |
| `POST /:id/email`, `POST /:id/whatsapp`                                          | `sales.<doc>.send`             |
| `POST /sales/quotations/:id/convert` (to proforma or tax)                        | `sales.invoice.write`          |
| `POST /sales/invoices/:id/convert-to-tax`                                        | `sales.invoice.write`          |
| `POST /sales/invoices/:id/delivery-challan`                                      | `sales.delivery_challan.write` |
| `POST /sales/invoices/:id/payments`, `DELETE /:id/payments/:paymentId`           | `sales.invoice_payment.write`  |

- **Numbers** `<PREFIX>/<FY>/<NNNN>` (`TW/QUO/26-27/0001`), one counter per type and financial year
  (April–March, `sales_quotation_26-27`), issued in the create transaction; editable via §6.2.
- **Pricing** is done by the server: line = qty × price; taxable = items + transport; place of
  supply = the customer's GST state unless entered; same state as the company → CGST+SGST, else
  IGST (entered IGST, else entered CGST+SGST, else the customer's rates — never a default); total
  rounded to the rupee with `round_off`.
- Each document freezes a `customer_snapshot` and copies the master-list values it uses (bank
  block, terms, HSN, names), so editing or deleting an option never changes an issued document.
- `sealItemId` / `signatureItemId` may point at a seal / signature option (422
  `INVALID_MASTER_ITEM` otherwise); the label is copied, and the image — kept after the option is
  deleted — is printed. The choice carries through conversions.
- **Conversions** (quotation → proforma/tax, proforma → tax with its payments, tax → DC) run in one
  transaction and lock the source (`CONVERTED`); deleting the converted-to invoice reopens it.
- **Payments** — see §8; the invoice payment routes above go through the same rules.
- **PDF** rendered server-side by `SalesPdfRenderer` (shared Playwright renderer) with logo, seal
  and signature images. **Email** via `shared/mailer` (`NOT_CONFIGURED` without SMTP);
  **WhatsApp** returns a `wa.me` share link (no Business API provider yet).

## 8. Payments Received — `/sales/payments`

| Route                                                        | Permission                    |
| ------------------------------------------------------------ | ----------------------------- |
| `GET /`, `GET /alerts`, `GET /:id`, `GET /:id/receipt` (PDF) | `sales.payment.read`          |
| `GET /next-number`, `POST /`, `PATCH /:id`, `DELETE /:id`    | `sales.invoice_payment.write` |

- A payment belongs to one live proforma or tax invoice (`invoiceId`; it cannot change — delete
  and record again). Number `TW/PR/<FY>/<NNNN>` by payment date, from the running numbers (§6.2);
  never reused after a delete. Payments recorded before numbering existed were numbered by the
  migration, in date order per financial year.
- **Mode**: `modeItemId` (a `PAYMENT_MODE` option, §6.4 — its label is copied; another field's
  option → 422 `INVALID_MASTER_ITEM`) or a typed `mode`; neither → 422
  `PAYMENT_MODE_REQUIRED`. The first API's codes (`BANK_TRANSFER`, `UPI`, …) are stored as
  their labels.
- Live payments never exceed the invoice total, on record and on edit (422
  `PAYMENT_EXCEEDS_BALANCE`, checked under the invoice row lock); the invoice's
  `amount_received` and status follow every write. Payments on a proforma move with it to the tax
  invoice.
- **Due date**: the payment's `dueDate`, else the invoice's. A payment is **overdue** while its
  invoice is UNPAID / PARTIALLY_PAID and that date has passed (`overdueDays` on every row).
  `GET /alerts` → `{ overduePayments, overdueInvoices, overdueBalance }` for the banner.
- List filters: `search` (payment no, reference, invoice no, customer name/code), `customerId`,
  `invoiceId`, `paymentMonth` / `dueMonth` (`YYYY-MM`), `overdueOnly=true`. Each row carries
  the invoice (number, total, received, balance) and the customer.
- The receipt prints the company logo, name and address from the master list (§6.3).

## 9. Returnable Delivery Challans — `/sales/returnable-dcs`

| Route                                                      | Permission                   |
| ---------------------------------------------------------- | ---------------------------- |
| `GET /`, `GET /:id`, `GET /:id/pdf`                        | `sales.returnable_dc.read`   |
| `GET /next-number`, `POST /`, `PATCH /:id`                 | `sales.returnable_dc.write`  |
| `POST /:id/return` `{ returnedDate? }`, `POST /:id/reopen` | `sales.returnable_dc.write`  |
| `DELETE /:id`                                              | `sales.returnable_dc.delete` |
| `POST /:id/email`, `POST /:id/whatsapp`                    | `sales.returnable_dc.send`   |

- Goods lent to a customer (the recipient) and expected back: issue date, purpose, expected return
  date (≥ issue date, else 422 `RETURN_DATE_BEFORE_ISSUE_DATE`), taken by, goods lines
  (description, quantity), seal / signature (`sealItemId` / `signatureItemId`, as in §7),
  prepared by, and returnable terms (the standard text when omitted). No prices, no HSN.
- Number `TW/RDC/<FY>/<NNNN>` by issue date, from the running numbers (§6.2).
- Status `ISSUED` (pending return) → `RETURNED` via `/return` (`returnedDate`, default today,
  ≥ issue date); `/reopen` undoes it. A returned RDC cannot be edited or returned again (409
  `RDC_RETURNED`); reopening an issued one is 409 `RDC_NOT_RETURNED`. `overdueDays` is set
  while it is still out past the expected return date.
- List filters: `search` (RDC no, recipient, purpose, taken by, prepared by), `customerId`,
  `status`, and `date` or `month` (`YYYY-MM`) of issue.
- PDF, email and WhatsApp as in §7; the PDF carries the company logo, name and address (§6.3).

## 10. Migrations

| Migration                                              | Adds                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261017090000_sales_customers_dashboard`             | schema `sales`, `customers`, `customer_addresses`, `action_items`, `code_formats`                                                                                                     |
| `20261018090000_sales_quotations_invoices`             | `quotations`, `invoices`, `*_lines`, `invoice_payments`, `delivery_challans` (+ lines), `company_profiles`                                                                            |
| `20261019090000_sales_document_master_list`            | `document_master_items`, company logo, `seal_item_id` / `signature_item_id` on documents                                                                                              |
| `20261020090000_sales_payments_received_returnable_dc` | payments: `payment_number` (existing ones numbered), `due_date`, `mode_item_id`, mode as a label; `returnable_delivery_challans` (+ lines); the new code types and master-list fields |

## 11. Not built yet

Customer contacts, leads, sales orders, credit notes, a WhatsApp Business provider.

## 12. UI (`apps/ui/src/features/sales`)

Built in four PRs, in this order: (1) Dashboard and Customers, (2) Quotations with a
server-rendered live preview, (3) Invoices (proforma and tax), Delivery Challans and Payments
Received, (4) Returnable DCs and the Master List. Screens use the ui-kit components and
`Docs/DESIGN_SYSTEM.md`; routes live under `app/(dashboard)/sales/`.

- **Shell access:** `sales.dashboard.read` opens the dashboard shell
  (`features/auth/landing.ts` `hasWorkspaceAccess`). After login, a user without HR workspace
  access but with `sales.dashboard.read` lands on `/sales/dashboard`.
- **Navigation:** the top navbar's **Sales** module (`components/layout/HorizontalNavbar.tsx`,
  `SALES_CATEGORIES`). Each entry is shown when `/menu/my-menu` returns its menu code. The
  codes live in `packages/database/prisma/menu/catalog.ts` (group `sales`, then `sales-dashboard`,
  `sales-customers`, …), each gated by its page's read permission. A new screen adds its menu
  item and navbar entry in the same PR. After deploying, run `menu:sync`.
- **Data:** every Sales query key starts with `orgScopedKey(org, "sales", …)`, and every Sales
  mutation invalidates that whole prefix, so dashboards and pickers refresh too. Money is shown
  from the API's decimal strings (`features/sales/shared/format.ts`) and is never recalculated in
  the browser. GST states, calling codes and formats are mirrored in
  `features/sales/shared/gst.ts`.
- **Built so far:**
  - `/sales/dashboard`: KPIs, needs-attention alerts, revenue vs collections chart (with a
    table view), pipeline, receivables aging, top clients, recent activity and the follow-up
    checklist.
  - `/sales/customers`: list, search and status filter.
  - `/sales/customers/new` and `/sales/customers/[id]/edit`: GSTIN fills in the state and PAN;
    addresses; the bank account is write-only.
  - `/sales/customers/[id]`: detail, with an audited bank reveal and delete with the
    "has documents" guard.
- **Tests:** `apps/ui/e2e/sales-*.spec.ts` run against a mocked API
  (`e2e/helpers/mock-api.ts`, workspace `"sales"`).
