# Sales backend — API contract

**Scope:** the Sales module's backend (`apps/api/src/modules/sales`), one section per Sales tab.
**Status:** implemented and tested on `feature/sales-api`; no UI yet. **Owner:** unassigned.
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
| `sales.invoice_payment.write`                                   |       ✓       |                 |

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
- CGST/SGST/IGST rates are optional, typed by the user — no defaults.
- Bank account number stored AES-256-GCM encrypted; responses carry only the mask.
- One live default address per customer and type.
- A customer with live documents cannot be deleted.

## 5. Checklist — `/sales/action-items`

`GET /` (`sales.action_item.read`); `POST /`, `POST /:id/complete`, `POST /:id/reopen`,
`DELETE /:id` (`sales.action_item.write`).

## 6. Master list — `/sales/master/...`

Reads need `sales.master.read`; writes need `sales.master.write` unless noted.

### 6.1 Code formats — `/code-formats`

`GET /`, `GET /:codeType`, `PATCH /:codeType`. Prefix and width per code type (customer `CUS`/3;
`TW/QUO`, `TW/PI`, `TW/IN`, `TW/DC` for documents).

### 6.2 Running numbers — `/running-numbers` (page 1)

- `GET /?date=YYYY-MM-DD` — the four documents (quotation, proforma, tax invoice, DC) for that
  date's financial year (default today): `prefix`, `padding`, `fiscalYear`, `lastNumber`,
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

| Field                  | Quotation | Proforma | Tax invoice | DC  |
| ---------------------- | :-------: | :------: | :---------: | :-: |
| `VALIDITY`             |     ✓     |          |             |     |
| `DELIVERY_TERMS`       |     ✓     |          |             |     |
| `PAYMENT_TERMS`        |           |    ✓     |      ✓      |     |
| `HSN_CODE`             |     ✓     |    ✓     |      ✓      |  ✓  |
| `BANK_ACCOUNT`         |     ✓     |    ✓     |      ✓      |  ✓  |
| `COMPANY_SEAL`         |     ✓     |    ✓     |      ✓      |  ✓  |
| `AUTHORIZED_SIGNATURE` |     ✓     |    ✓     |      ✓      |  ✓  |
| `PREPARED_BY`          |     ✓     |    ✓     |      ✓      |  ✓  |

- Another field → 422 `FIELD_NOT_ON_DOCUMENT` (also a DB CHECK).
- HSN: 4–8 digit `value`; label defaults to the code. Bank: `bankDetails` (bank name, account,
  branch, IFSC) required; label built from them. Others: `label` only.
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
- **Payments** never exceed the balance (checked under the invoice row lock).
- **PDF** rendered server-side by `SalesPdfRenderer` (shared Playwright renderer) with logo, seal
  and signature images. **Email** via `shared/mailer` (`NOT_CONFIGURED` without SMTP);
  **WhatsApp** returns a `wa.me` share link (no Business API provider yet).

## 8. Migrations

| Migration                                   | Adds                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `20261017090000_sales_customers_dashboard`  | schema `sales`, `customers`, `customer_addresses`, `action_items`, `code_formats`                          |
| `20261018090000_sales_quotations_invoices`  | `quotations`, `invoices`, `*_lines`, `invoice_payments`, `delivery_challans` (+ lines), `company_profiles` |
| `20261019090000_sales_document_master_list` | `document_master_items`, company logo, `seal_item_id` / `signature_item_id` on documents                   |

## 9. Not built yet

Customer contacts, leads, sales orders, credit notes, returnable DCs, a WhatsApp Business provider.
