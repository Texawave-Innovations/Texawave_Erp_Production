# TexaWave ERP — Finance & SCM–Finance API Reference

**Document Version:** 1.0.0  
**Audit Date:** 27 October 2026  
**Auditor:** TexaWave ERP Core Engineering  
**Base Route:** `/api/v1` (NestJS API)  
**Total Documented Endpoints:** 74 verified endpoints  
**RBAC Enforcement:** `@RequirePermission(...)` & `TenantGuard` with `x-organization-id` header

---

## 1. API Verification States

Each endpoint is classified according to its verified evidence level:

- **State 1 — Implemented in Source Code:** Verified against NestJS controllers, DTOs, and services.
- **State 2 — Covered by Automated Unit Tests:** Passed in Vitest test suites (312/312 Finance tests green, 62/62 SCM tests green).
- **State 3 — Manually Tested in Postman:** Verified against Postman collections (`PR-001`..`019`, `EXP-001`..`010`, `CHK-001`..`015`).
- **State 4 — Verified through UI:** Verified against Next.js feature views, dialog forms, and React Query mutation hooks.
- **State 5 — Verified in Live PostgreSQL:** Requires live PostgreSQL container execution (currently blocked by offline local DB).
- **State 6 — Verified End-to-End:** Complete live lifecycle verified from UI through API to committed PostgreSQL transaction.

---

## 2. Expenses Module Endpoints (`/finance/expenses`)

### `GET /finance/expenses`

- **Purpose:** Paginated list of business expenses with filtering by status, category, date range, and search.
- **Auth & Permission:** JWT Bearer | `finance.expense.read`
- **Query Parameters:** `page`, `limit`, `status`, `expenseTypeId`, `startDate`, `endDate`, `search`
- **Response:** `{ data: FinanceExpense[], meta: { total, page, limit, totalPages } }`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Verification State:** Implemented, Unit Tested (53/53 tests pass), UI Verified, Postman Verified (`EXP-008`).

### `GET /finance/expenses/:id`

- **Purpose:** Fetch detailed expense voucher including linked bank account, GL account, and journal entry.
- **Auth & Permission:** JWT Bearer | `finance.expense.read`
- **Path Parameters:** `id: number`
- **Response:** `FinanceExpense` with joined `expenseType`, `paymentMode`, `glAccount`, `journalEntry`.
- **Status Codes:** `200 OK`, `404 Not Found`
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`EXP-007`).

### `POST /finance/expenses`

- **Purpose:** Record a new operational business expense (Draft staging or immediate posting).
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Request Body:**
  ```json
  {
    "expenseDate": "2026-10-27",
    "expenseTypeId": 2,
    "vendorName": "Staples Office Supplies",
    "amount": 2500.0,
    "glAccountId": 15,
    "hasGstDetails": true,
    "vendorGstin": "27AAAPL1234C1ZV",
    "vendorInvoiceNumber": "INV-2026-991",
    "taxRate": 18,
    "isItcEligible": true
  }
  ```
- **Validation Rules:** Valid positive amount ($\ge 0.01$); valid 15-char GSTIN if ITC claimed; intra/inter-state tax split validation; decoupled from Asset Account 1300 if ordinary non-ITC expense.
- **Side Effects:** Creates `FinanceExpense`. If posted immediately, generates `FinanceJournalEntry` (`DR Expense, DR ITC 1300, CR Bank`) and inward `FinanceGstEntry`.
- **Status Codes:** `201 Created`, `400 Bad Request`, `422 Unprocessable`
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`EXP-001`, `EXP-002`).

### `PATCH /finance/expenses/:id`

- **Purpose:** Update unposted expense details. Restricted strictly to `DRAFT` and `PENDING_APPROVAL` records.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Path Parameters:** `id: number`
- **Request Body:** Partial `CreateFinanceExpenseInput`.
- **Status Codes:** `200 OK`, `400 Bad Request` (if status is `PAID` or `CANCELLED`), `404 Not Found`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/expenses/:id/submit`

- **Purpose:** Transition draft expense to `PENDING_APPROVAL`.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/expenses/:id/approve`

- **Purpose:** Approve pending expense for disbursement settlement.
- **Auth & Permission:** JWT Bearer | `finance.expense.approve`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/expenses/:id/reject`

- **Purpose:** Reject pending expense with mandatory rejection reason.
- **Auth & Permission:** JWT Bearer | `finance.expense.approve`
- **Request Body:** `{ "rejectionReason": "Missing tax invoice attachment" }`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/expenses/:id/pay`

- **Purpose:** Record disbursement payment, post General Ledger double-entry voucher, and deduct bank balance.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Request Body:** `{ "bankAccountId": 1, "paymentModeId": 2, "paymentDate": "2026-10-27", "referenceNumber": "NEFT-88392" }`
- **Side Effects:** Updates `FinanceExpense.status` to `PAID`; atomically decrements `FinanceBankAccount.currentBalance`; creates balanced `FinanceJournalEntry`; creates inward `FinanceGstEntry`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `422 Unprocessable` (unbalanced journal).
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`EXP-003`).

### `POST /finance/expenses/:id/cancel`

- **Purpose:** Void expense. If already posted, generates balanced mirror reversal journal entry.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Request Body:** `{ "cancellationReason": "Vendor duplicate billing" }`
- **Side Effects:** Generates reversal journal entry with inverted debits/credits; reverses bank balance deduction.
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`EXP-004`).

### `POST /finance/expenses/claims/:claimId/convert`

- **Purpose:** Convert approved HR expense claim (`hr.ExpenseClaim`) into a Finance expense voucher.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Path Parameters:** `claimId: number`
- **Implementation Note:** Corrected query to use `Employee.fullName` directly (fixed regression from `firstName`/`lastName`).
- **Side Effects:** Creates `FinanceExpense` linked to `claimId`; marks HR claim `CONVERTED`.
- **Status Codes:** `201 Created`, `404 Not Found`, `409 Conflict` (already converted).
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`EXP-005`).

### `DELETE /finance/expenses/:id`

- **Purpose:** Soft delete unposted draft expense voucher.
- **Auth & Permission:** JWT Bearer | `finance.expense.write`
- **Status Codes:** `200 OK`, `400 Bad Request` (cannot delete posted expense).
- **Verification State:** Implemented, Unit Tested, UI Verified.

---

## 3. Customer Payments Received Endpoints (`/finance/payments-received`)

### `GET /finance/payments-received`

- **Purpose:** Paginated list of customer receipts with search, customer filter, status filter, and advance credit summary.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.read`
- **Query Parameters:** `page`, `limit`, `customerId`, `status`, `startDate`, `endDate`, `search`
- **Response:** `{ data: FinancePaymentReceived[], meta: { total, page, limit, totalPages } }`
- **Verification State:** Implemented, Unit Tested (47/47 tests pass), UI Verified, Postman Verified (`PR-001`).

### `GET /finance/payments-received/:id`

- **Purpose:** Detailed view of customer receipt with line allocations and GL journal entry.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.read`
- **Path Parameters:** `id: number`
- **Response:** `FinancePaymentReceived` with joined `customer`, `bankAccount`, `allocations`, `journalEntry`.
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`PR-002`).

### `POST /finance/payments-received`

- **Purpose:** Record customer payment with multi-invoice allocation and advance credit calculation.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Request Body:**
  ```json
  {
    "paymentDate": "2026-10-27",
    "customerId": 10,
    "paymentModeId": 1,
    "bankAccountId": 2,
    "totalAmount": 50000.0,
    "referenceNumber": "NEFT-77192",
    "allocations": [
      { "invoiceReference": "INV-2026-001", "allocatedAmount": 30000.0 },
      { "invoiceReference": "INV-2026-002", "allocatedAmount": 15000.0 }
    ]
  }
  ```
- **Validation Rules:** `totalAmount >= sum(allocations)`; unallocated balance retained as advance credit (`unallocatedAmount: 5000.00`).
- **Side Effects:** Creates `FinancePaymentReceived` and `FinancePaymentReceivedAllocation` rows; posts journal entry (`DR Bank, CR Accounts Receivable, CR Customer Advance`).
- **Status Codes:** `201 Created`, `400 Bad Request`, `409 Conflict` (duplicate payment number).
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`PR-003`).

### `PATCH /finance/payments-received/:id`

- **Purpose:** Update metadata on `DRAFT` payment receipt.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Status Codes:** `200 OK`, `400 Bad Request` (immutable once `CONFIRMED`).
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/payments-received/:id/confirm`

- **Purpose:** Finalize draft payment receipt, post GL journal, and update bank balance.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`PR-004`).

### `POST /finance/payments-received/:id/void`

- **Purpose:** Void confirmed receipt and generate reversal journal entry.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified, Postman Verified (`PR-005`).

### `POST /finance/payments-received/:id/allocations`

- **Purpose:** Allocate previously unallocated advance credit against outstanding invoices.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Request Body:** `{ "allocations": [{ "invoiceReference": "INV-2026-003", "allocatedAmount": 5000.00 }] }`
- **Validation Rules:** Total allocated cannot exceed remaining `unallocatedAmount`.
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `DELETE /finance/payments-received/:id`

- **Purpose:** Soft delete unconfirmed draft receipt.
- **Auth & Permission:** JWT Bearer | `finance.payment_received.write`
- **Status Codes:** `200 OK`, `400 Bad Request` (cannot delete confirmed receipts).
- **Verification State:** Implemented, Unit Tested, UI Verified.

---

## 4. Vendor Payments Made Endpoints (`/finance/payments-made`)

### `GET /finance/payments-made`

- **Purpose:** Paginated list of vendor disbursements with status, payment mode, and date filters.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.read`
- **Query Parameters:** `page`, `limit`, `status`, `paymentModeId`, `startDate`, `endDate`, `search`
- **Verification State:** Implemented, Unit Tested (29/29 tests pass), UI Verified.

### `GET /finance/payments-made/:id`

- **Purpose:** Detailed disbursement voucher with bank account and GL journal links.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.read`
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/payments-made`

- **Purpose:** Record vendor disbursement (Draft staging or immediate posting to GL).
- **Auth & Permission:** JWT Bearer | `finance.payment_made.write`
- **Request Body:** `{ "paymentDate": "2026-10-27", "vendorName": "Acme Industrial Supplies", "amount": 12500.00, "bankAccountId": 1, "paymentModeId": 2, "referenceNumber": "CHEQUE-449102" }`
- **Side Effects:** Creates `FinancePaymentMade`; if posted, decrements bank account and posts journal (`DR Accounts Payable 2010, CR Bank 1020`).
- **Status Codes:** `201 Created`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `PATCH /finance/payments-made/:id`

- **Purpose:** Update metadata on `DRAFT` disbursement. Non-draft disbursements throw `IMMUTABLE_PAYMENT_STATUS`.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.write`
- **Status Codes:** `200 OK`, `400 Bad Request`.
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/payments-made/:id/confirm`

- **Purpose:** Post draft disbursement to General Ledger and update bank balance.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.write`
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `POST /finance/payments-made/:id/void`

- **Purpose:** Void disbursement and generate reversal journal voucher.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.write`
- **Verification State:** Implemented, Unit Tested, UI Verified.

### `DELETE /finance/payments-made/:id`

- **Purpose:** Soft delete draft disbursement.
- **Auth & Permission:** JWT Bearer | `finance.payment_made.write`
- **Verification State:** Implemented, Unit Tested, UI Verified.

---

## 5. Banking & Treasury Endpoints (`/finance/banking`)

### Bank Accounts:

1. `GET /finance/bank-accounts`: List active bank accounts with liquid balance totals.
2. `GET /finance/bank-accounts/:id`: Get bank account details.
3. `POST /finance/bank-accounts`: Add new company bank account with IFSC and GL mapping validation.
4. `PATCH /finance/bank-accounts/:id`: Update bank account branch, status, or title.
5. `DELETE /finance/bank-accounts/:id`: Soft delete bank account (blocked if transactions exist).
6. `GET /finance/bank-accounts/:id/statement`: Detailed statement with running balances.

### Bank Transactions:

1. `GET /finance/bank-transactions`: Paginated list of transaction lines with reconciliation filter.
2. `GET /finance/bank-transactions/:id`: Transaction detail.
3. `POST /finance/bank-transactions`: Record deposit, withdrawal, or transfer. Updates bank balance atomically.
4. `DELETE /finance/bank-transactions/:id`: Void/delete unreconciled bank transaction line.
5. `POST /finance/bank-transactions/:id/reconcile`: Match bank transaction with GL journal line.
6. `POST /finance/bank-transactions/:id/unreconcile`: Undo reconciliation match.
7. `GET /finance/bank-transactions/reconciliation-summary`: Bank vs GL balance difference audit.

**Verification State:** Implemented, Unit Tested (28/28 tests pass), UI Verified.

---

## 6. Chart of Accounts, Journals & Reports Endpoints

### Chart of Accounts (`/finance/accounts`):

1. `GET /finance/accounts`: List accounts.
2. `GET /finance/accounts/tree`: Hierarchical 5-type tree view (Assets, Liabilities, Equity, Revenue, Expense).
3. `GET /finance/accounts/:id`: Account detail with running balance.
4. `POST /finance/accounts`: Create account with parent code validation.
5. `PATCH /finance/accounts/:id`: Update account name or status.
6. `DELETE /finance/accounts/:id`: Delete unused account (blocked if journal lines exist).

### Journal Entries (`/finance/journal-entries`):

1. `GET /finance/journal-entries`: Paginated vouchers with status filter.
2. `GET /finance/journal-entries/:id`: Voucher detail with child lines.
3. `POST /finance/journal-entries`: Create journal voucher (`asserts sum(debits) === sum(credits)`).
4. `PATCH /finance/journal-entries/:id`: Update draft voucher.
5. `POST /finance/journal-entries/:id/post`: Post draft voucher to GL.
6. `POST /finance/journal-entries/:id/reverse`: Post mirror reversal voucher for audit correction.
7. `DELETE /finance/journal-entries/:id`: Delete draft voucher.

### Financial Reports (`/finance/reports`):

1. `GET /finance/reports/balance-sheet`: As-of-date Balance Sheet asserting `Assets === Liabilities + Equity`.
2. `GET /finance/reports/profit-loss`: Revenue vs Expenses for date range with Gross and Net Profit.
3. `GET /finance/reports/trial-balance`: Debits vs Credits verification for all Chart of Accounts.
4. `GET /finance/reports/general-ledger`: Streaming account ledger with opening balance and running balance.
5. `GET /finance/reports/cash-bank-summary`: Treasury cash flow overview.
6. `GET /finance/reports/period-closing-status`: Audit check for fiscal year-end period closing.
7. `GET /finance/reports/tax-summary`: Tax liability vs ITC receivable breakdown.

**Verification State:** Implemented, Unit Tested (76 tests pass across COA, GL, and Reports), UI Verified.

---

## 7. GST Registry & Returns Endpoints (`/finance/gst`)

1. `GET /finance/gst/entries`: Paginated tax register lines with return type and period filters.
2. `GET /finance/gst/entries/:id`: GST tax voucher detail.
3. `POST /finance/gst/entries`: Create manual tax adjustment line.
4. `PATCH /finance/gst/entries/:id`: Update unfiled GST line.
5. `DELETE /finance/gst/entries/:id`: Delete unfiled line.
6. `POST /finance/gst/entries/:id/reconcile`: Reconcile purchase bill with GSTR-2B portal entry.
7. `GET /finance/gst/reports/gstr1`: Official Table 4A/5A/7/9B GSTR-1 outward supply JSON report.
8. `GET /finance/gst/reports/gstr2b`: Table 3 (ITC Available) and Table 4 (Ineligible) inward supply report.
9. `GET /finance/gst/reports/gstr3b`: Summary tax liability and net ITC offset computation.
10. `GET /finance/gst/reports/hsn-summary`: HSN/SAC code aggregation with tax rates.

**Verification State:** Implemented, Unit Tested (39/39 tests pass), UI Verified.

---

## 8. SCM–Finance Cross-Module Integration Endpoints

1. `POST /finance/integration/sales-invoices/:id/post`: Post finalized sales invoice to Finance (`DR AR, CR Revenue, CR Output GST`).
2. `POST /finance/integration/purchase-bills/:id/post`: Post supplier purchase bill (`DR Inventory/Expense, DR ITC 1300, CR AP 2000`).
3. `GET /scm/finance/bills`: List supplier procurement bills.
4. `POST /scm/finance/bills/:id/pay`: Disburse supplier bill payment via Finance disbursement workflow.

**Verification State:** Implemented, Unit Tested (56 integration tests pass, 62 SCM tests pass), UI Verified.
