# TexaOne Finance API — Comprehensive Manual Postman Testing Guide

## Operational Expenses (Milestone 3) & Customer Payments Received (Milestone 4)

**Source of Truth:**

- Controllers: [`apps/api/src/modules/finance/expenses/expenses.controller.ts`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/expenses/expenses.controller.ts), [`apps/api/src/modules/finance/payments-received/payments-received.controller.ts`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.controller.ts)
- Services: [`apps/api/src/modules/finance/expenses/expenses.service.ts`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/expenses/expenses.service.ts), [`apps/api/src/modules/finance/payments-received/payments-received.service.ts`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.service.ts)
- Database Schema: [`packages/database/prisma/schema.prisma`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/packages/database/prisma/schema.prisma) (`FinanceExpense`, `FinancePaymentReceived`, `FinancePaymentReceivedAllocation`, `FinanceJournalEntry`, `FinanceJournalLine`, `FinanceAccount`, `FinanceBankAccount`)
- RBAC Permissions: [`packages/database/prisma/permissions/catalog.ts`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/packages/database/prisma/permissions/catalog.ts)

---

## 1. Setup & Environment Architecture

### 1.1 Postman Files Created

Two ready-to-import files are available in the repository root:

1. **Postman Collection (v2.1.0):** [`postman/finance-api.postman_collection.json`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/postman/finance-api.postman_collection.json)
2. **Postman Environment Template:** [`postman/finance-local.postman_environment.json`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/postman/finance-local.postman_environment.json)

### 1.2 Environment Variables & Real ID Sourcing

Never hardcode or invent arbitrary IDs. Real IDs must come from either login responses or the discovery requests outlined below:

| Variable            | Description                              | Source                                                          | Example Value                |
| :------------------ | :--------------------------------------- | :-------------------------------------------------------------- | :--------------------------- |
| `baseUrl`           | API root URL                             | Configured by tester                                            | `http://localhost:3000`      |
| `organizationSlug`  | Tenant organization slug                 | Organization created in DB / Onboarding                         | `texawave-demo`              |
| `email`             | User email with Finance permissions      | User created in DB                                              | `finance.admin@texawave.com` |
| `password`          | User login password                      | User created in DB                                              | `SecretPass123!`             |
| `accessToken`       | JWT bearer token                         | `POST /auth/login`                                              | `eyJhbGciOi...`              |
| `expenseTypeId`     | Master list item ID for expense category | `GET /finance-settings/master-list-items?category=expense_type` | `1`                          |
| `paymentModeId`     | Master list item ID for payment mode     | `GET /finance-settings/master-list-items?category=payment_mode` | `2`                          |
| `bankAccountId`     | Finance bank account ID                  | `GET /finance/bank-accounts` or DB `finance_bank_accounts`      | `1`                          |
| `customerId`        | CRM customer account ID                  | `GET /crm/accounts` or DB `accounts` (`type='CUSTOMER'`)        | `10`                         |
| `expenseId`         | Created expense ID                       | `POST /finance/expenses`                                        | _(Auto-captured)_            |
| `expenseJournalId`  | Expense GL journal voucher ID            | `POST /finance/expenses/:id/pay`                                | _(Auto-captured)_            |
| `paymentReceivedId` | Created payment receipt ID               | `POST /finance/payments-received`                               | _(Auto-captured)_            |
| `allocationId`      | Created invoice allocation ID            | `POST /finance/payments-received`                               | _(Auto-captured)_            |
| `paymentJournalId`  | Payment receipt GL journal ID            | `POST /finance/payments-received/:id/confirm`                   | _(Auto-captured)_            |

---

## 2. Status of Sales Invoice Integration & Dependency Blocker

> [!IMPORTANT]
> **Sales Invoice Integration Status:**
>
> - Inspection of [`packages/database/prisma/schema.prisma`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/packages/database/prisma/schema.prisma) confirms **no dedicated `SalesInvoice` table currently exists in the database schema**.
> - The Finance models [`FinancePaymentReceived`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/packages/database/prisma/schema.prisma#L6133) and [`FinancePaymentReceivedAllocation`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/packages/database/prisma/schema.prisma#L6167) were deliberately designed with an `invoiceReference: String` field to allow immediate multi-invoice allocation tracking (e.g. `"INV-202610-0010"`) without hard-locking against a nonexistent table.
> - **Blocker:** Direct foreign-key constraints and live database-level outstanding-balance lookups against a Sales invoice entity cannot be executed until the Sales module introduces the `SalesInvoice` entity.
> - In this release, invoice reference validation enforces:
>   1. Valid non-empty string references.
>   2. Strict balance integrity: $\sum \text{Allocated Amounts} \le \text{Payment Amount}$.
>   3. Non-positive allocation prevention ($\text{amount} > 0$).
>   4. Dynamic allocation addition/removal updating `allocatedAmount` and `unallocatedAmount`.

---

## 3. Recommended Execution Order

Execute requests in this exact sequence so each step uses IDs populated by prior steps:

```
[0. Discovery & Auth]
   0.1 Login ➔ accessToken
   0.2 Discover Payment Mode ➔ paymentModeId
   0.3 Discover Expense Type ➔ expenseTypeId
   0.4 Discover Accounts / Bank ➔ bankAccountId

[1. Expenses Lifecycle (Milestone 3)]
   1.1 Create Draft Expense ➔ expenseId
   1.2 Get Expense by ID
   1.3 List & Filter Expenses
   1.4 Update Expense (Metadata)
   1.5 Submit Expense (DRAFT ➔ PENDING_APPROVAL)
   1.6 Approve Expense (PENDING_APPROVAL ➔ APPROVED)
   1.7 Pay Expense & Post GL Journal (APPROVED ➔ PAID) ➔ expenseJournalId
   1.8 Cancel Paid Expense (PAID ➔ CANCELLED, Reversal Journal)
   1.9 Soft Delete Cancelled Expense

[2. Customer Payments Received Lifecycle (Milestone 4)]
   2.1 Create Receipt with Multi-Invoice Allocations (DRAFT) ➔ paymentReceivedId, allocationId
   2.2 Get Receipt by ID
   2.3 List & Filter Receipts
   2.4 Update Receipt Metadata
   2.5 Dynamically Add Invoice Allocation
   2.6 Remove Invoice Allocation
   2.7 Confirm Receipt & Post GL Journal (DRAFT ➔ CONFIRMED) ➔ paymentJournalId
   2.8 Void Receipt & Reverse GL Journal (CONFIRMED ➔ VOID)
   2.9 Soft Delete Void Receipt

[3. Negative & Boundary Scenarios]
   3.1 Future Date Rejections
   3.2 Over-Allocation Rejection
   3.3 Invalid State Transitions
   3.4 Immutable Record Edits
   3.5 Cross-Organization Access (404 Tenant Isolation)
   3.6 Permission Denials (403 Forbidden)
```

---

## 4. Phase 0: Prerequisite Discovery & Authentication

### 0.1 Login & Token Extraction

- **Method & Route:** `POST /auth/login`
- **Required Permission:** Public auth route.
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "organizationSlug": "{{organizationSlug}}",
    "email": "{{email}}",
    "password": "{{password}}"
  }
  ```
- **Expected Status:** `201 Created`
- **Representative Response:**
  ```json
  {
    "data": {
      "accessToken": "eyJhbGciOi...",
      "user": { "id": 1, "email": "finance.admin@texawave.com" }
    }
  }
  ```
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 201", () => pm.response.to.have.status(201));
  pm.environment.set("accessToken", res.data.accessToken);
  ```
- **Database Effect:** None (reads `users` & `organizations`).
- **Execution State:** **Prepared**.

---

### 0.2 Discover Payment Modes

- **Method & Route:** `GET /finance-settings/master-list-items?category=payment_mode&limit=10`
- **Required Permission:** `finance_settings.master_list_item.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 200", () => pm.response.to.have.status(200));
  if (res.data && res.data.length > 0) {
    pm.environment.set("paymentModeId", res.data[0].id);
  }
  ```
- **Execution State:** **Prepared**.

---

### 0.3 Discover Expense Types

- **Method & Route:** `GET /finance-settings/master-list-items?category=expense_type&limit=10`
- **Required Permission:** `finance_settings.master_list_item.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 200", () => pm.response.to.have.status(200));
  if (res.data && res.data.length > 0) {
    pm.environment.set("expenseTypeId", res.data[0].id);
  }
  ```
- **Execution State:** **Prepared**.

---

## 5. Milestone 3: Operational Expenses API Test Cases

### 1.1 Create Draft Expense

- **Method & Route:** `POST /finance/expenses`
- **Required Permission:** `finance.expense.write`
- **Prerequisites:** Valid `expenseTypeId`, `paymentModeId` from Phase 0.
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
  - `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "expenseTypeId": {{expenseTypeId}},
    "expenseDate": "2026-10-23",
    "amount": 2500.00,
    "taxAmount": 450.00,
    "paymentModeId": {{paymentModeId}},
    "bankAccountId": {{bankAccountId}},
    "vendorName": "Apex Technologies Ltd",
    "referenceNumber": "BILL-2026-0091",
    "notes": "Office network switch replacement",
    "status": "DRAFT"
  }
  ```
- **Expected Status:** `201 Created`
- **Representative Response:**
  ```json
  {
    "data": {
      "id": 105,
      "expenseNumber": "EXP-202610-0001",
      "expenseTypeId": 1,
      "expenseDate": "2026-10-23T00:00:00.000Z",
      "amount": 2500,
      "taxAmount": 450,
      "netAmount": 2950,
      "status": "DRAFT",
      "vendorName": "Apex Technologies Ltd",
      "referenceNumber": "BILL-2026-0091",
      "journalEntryId": null
    }
  }
  ```
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 201", () => pm.response.to.have.status(201));
  pm.test("DRAFT status created", () => {
    pm.expect(res.data.status).to.equal("DRAFT");
    pm.expect(res.data.netAmount).to.equal(2950);
    pm.environment.set("expenseId", res.data.id);
  });
  ```
- **Expected Database Effect:** Row inserted into `finance_expenses` with `status = 'DRAFT'`.
- **Execution State:** **Prepared** (Automated logic verified via `expenses.service.spec.ts`).

---

### 1.2 Get Expense by ID

- **Method & Route:** `GET /finance/expenses/{{expenseId}}`
- **Required Permission:** `finance.expense.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Expected Response:** JSON with `id: {{expenseId}}`, full relation details (`expenseType`, `paymentMode`, `journalEntry`).
- **Execution State:** **Prepared**.

---

### 1.3 List & Filter Expenses

- **Method & Route:** `GET /finance/expenses?status=DRAFT&page=1&limit=10`
- **Required Permission:** `finance.expense.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "data": [ ... ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
  ```
- **Execution State:** **Prepared**.

---

### 1.4 Update Expense Metadata

- **Method & Route:** `PATCH /finance/expenses/{{expenseId}}`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`, `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "amount": 2700.0,
    "taxAmount": 486.0,
    "notes": "Updated invoice with extra patch cables"
  }
  ```
- **Expected Status:** `200 OK`
- **Representative Response:** `amount: 2700`, `taxAmount: 486`, `netAmount: 3186`.
- **Database Effect:** Updated in `finance_expenses`.
- **Execution State:** **Prepared**.

---

### 1.5 Submit Expense for Approval

- **Method & Route:** `POST /finance/expenses/{{expenseId}}/submit`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Body:** `{}`
- **Expected Status:** `201 Created`
- **Expected Response:** `status` transitions from `DRAFT` to `PENDING_APPROVAL`.
- **Database Effect:** `finance_expenses.status = 'PENDING_APPROVAL'`.
- **Execution State:** **Prepared**.

---

### 1.6 Approve Expense

- **Method & Route:** `POST /finance/expenses/{{expenseId}}/approve`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Body:** `{}`
- **Expected Status:** `201 Created`
- **Expected Response:** `status` transitions from `PENDING_APPROVAL` to `APPROVED`.
- **Database Effect:** `finance_expenses.status = 'APPROVED'`.
- **Execution State:** **Prepared**.

---

### 1.7 Pay Expense & Post General Ledger Journal Voucher

- **Method & Route:** `POST /finance/expenses/{{expenseId}}/pay`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`, `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "paymentDate": "2026-10-23",
    "referenceNumber": "NEFT-TXN-554433"
  }
  ```
- **Expected Status:** `201 Created`
- **Representative Response:**
  ```json
  {
    "data": {
      "id": 105,
      "status": "PAID",
      "journalEntryId": 48,
      "journalEntry": {
        "entryNumber": "JV-202610-0012",
        "entryType": "EXPENSE",
        "totalDebit": 3186,
        "totalCredit": 3186,
        "status": "POSTED"
      }
    }
  }
  ```
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 201", () => pm.response.to.have.status(201));
  pm.test("Status is PAID", () => {
    pm.expect(res.data.status).to.equal("PAID");
    pm.environment.set("expenseJournalId", res.data.journalEntryId);
  });
  ```
- **Accounting & Database Effects:**
  1. `finance_expenses.status` becomes `PAID`.
  2. Balanced `FinanceJournalEntry` created with prefix `JV-YYYYMM-XXXX`.
  3. `FinanceJournalLine` Line 1: `Debit: Operating Expense (5xxx)` for `3186.00`.
  4. `FinanceJournalLine` Line 2: `Credit: Operating Bank (1020)` for `3186.00`.
  5. `FinanceAccount` balance for Bank decreases by `3186.00`.
- **Execution State:** **Prepared**.

---

### 1.8 Cancel Paid Expense (Generate GL Reversal)

- **Method & Route:** `POST /finance/expenses/{{expenseId}}/cancel`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Body:** `{}`
- **Expected Status:** `201 Created`
- **Representative Response:** `status` transitions to `CANCELLED`.
- **Accounting & Database Effects:**
  1. Original `FinanceJournalEntry` status updated to `REVERSED`.
  2. Reversal `FinanceJournalEntry` created with prefix `REV-YYYYMM-XXXX`.
  3. Lines inverted: `Debit: Bank (1020)`, `Credit: Expense (5xxx)`.
  4. Bank account balance restored by `+3186.00`.
- **Execution State:** **Prepared**.

---

### 1.9 Soft Delete Cancelled Expense

- **Method & Route:** `DELETE /finance/expenses/{{expenseId}}`
- **Required Permission:** `finance.expense.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `204 No Content`
- **Database Effect:** `finance_expenses.deletedAt` timestamp set.
- **Execution State:** **Prepared**.

---

### 1.10 Milestone 3 Negative Test Cases

1. **Invalid State Transition (Direct Approve on Draft):**
   - `POST /finance/expenses/{{expenseId}}/approve` when status is `DRAFT`
   - Expected: `422 Unprocessable Entity` (`INVALID_STATE_TRANSITION`).
2. **Rejection from Invalid State:**
   - `POST /finance/expenses/{{expenseId}}/reject` when status is `DRAFT`
   - Expected: `422 Unprocessable Entity` (`INVALID_STATE_TRANSITION`).
3. **Future Expense Date Rejection:**
   - `POST /finance/expenses` with `"expenseDate": "2099-01-01"`
   - Expected: `422 Unprocessable Entity` (`FUTURE_EXPENSE_DATE`).
4. **Edit Paid Expense Rejection:**
   - `PATCH /finance/expenses/{{expenseId}}` after payment
   - Expected: `422 Unprocessable Entity` (`IMMUTABLE_EXPENSE`).
5. **Delete Active / Paid Expense Rejection:**
   - `DELETE /finance/expenses/{{expenseId}}` when status is `PAID` or `APPROVED`
   - Expected: `422 Unprocessable Entity` (`CANNOT_DELETE_ACTIVE_EXPENSE` / `CANNOT_DELETE_PAID_EXPENSE`).
6. **Double Payment Rejection:**
   - `POST /finance/expenses/{{expenseId}}/pay` when already `PAID`
   - Expected: `422 Unprocessable Entity` (`ALREADY_PAID`).

---

## 6. Milestone 4: Customer Payments Received & Invoice Allocations

### 2.1 Record Customer Receipt (Draft) with Multi-Invoice Allocations

- **Method & Route:** `POST /finance/payments-received`
- **Required Permission:** `finance.payment_received.write`
- **Prerequisites:** Valid `paymentModeId`, `bankAccountId`, `customerId`.
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
  - `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "paymentDate": "2026-10-23",
    "amount": 9000.00,
    "paymentModeId": {{paymentModeId}},
    "bankAccountId": {{bankAccountId}},
    "customerId": {{customerId}},
    "referenceNumber": "NEFT-HDFC-998811",
    "notes": "Partial invoice clearance and unallocated buffer",
    "status": "DRAFT",
    "allocations": [
      {
        "invoiceReference": "INV-202610-0081",
        "allocatedAmount": 4000.00,
        "notes": "Full settlement for INV-0081"
      },
      {
        "invoiceReference": "INV-202610-0082",
        "allocatedAmount": 3000.00,
        "notes": "Partial clearance for INV-0082"
      }
    ]
  }
  ```
- **Expected Status:** `201 Created`
- **Representative Response:**
  ```json
  {
    "data": {
      "id": 208,
      "paymentNumber": "PR-202610-0001",
      "paymentDate": "2026-10-23T00:00:00.000Z",
      "amount": 9000,
      "allocatedAmount": 7000,
      "unallocatedAmount": 2000,
      "status": "DRAFT",
      "allocations": [
        {
          "id": 12,
          "invoiceReference": "INV-202610-0081",
          "allocatedAmount": 4000
        },
        {
          "id": 13,
          "invoiceReference": "INV-202610-0082",
          "allocatedAmount": 3000
        }
      ]
    }
  }
  ```
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 201", () => pm.response.to.have.status(201));
  pm.test("Correct balances computed", () => {
    pm.expect(res.data.status).to.equal("DRAFT");
    pm.expect(res.data.amount).to.equal(9000);
    pm.expect(res.data.allocatedAmount).to.equal(7000);
    pm.expect(res.data.unallocatedAmount).to.equal(2000);
    pm.environment.set("paymentReceivedId", res.data.id);
    pm.environment.set("allocationId", res.data.allocations[0].id);
  });
  ```
- **Expected Database Effect:** Row created in `finance_payments_received` with 2 child rows in `finance_payment_received_allocations`.
- **Execution State:** **Prepared** (Automated logic verified via `payments-received.service.spec.ts`).

---

### 2.2 Get Customer Receipt by ID

- **Method & Route:** `GET /finance/payments-received/{{paymentReceivedId}}`
- **Required Permission:** `finance.payment_received.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Expected Response:** JSON with allocations list and payment mode details.
- **Execution State:** **Prepared**.

---

### 2.3 List & Filter Customer Receipts

- **Method & Route:** `GET /finance/payments-received?page=1&limit=10&status=DRAFT`
- **Required Permission:** `finance.payment_received.read`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `200 OK`
- **Execution State:** **Prepared**.

---

### 2.4 Update Receipt Metadata

- **Method & Route:** `PATCH /finance/payments-received/{{paymentReceivedId}}`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`, `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "referenceNumber": "NEFT-HDFC-REVISED",
    "notes": "Customer confirmed reference update via email"
  }
  ```
- **Expected Status:** `200 OK`
- **Database Effect:** Updated in `finance_payments_received`.
- **Execution State:** **Prepared**.

---

### 2.5 Dynamically Add Invoice Allocation

- **Method & Route:** `POST /finance/payments-received/{{paymentReceivedId}}/allocations`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`, `Content-Type: application/json`
- **Exact Body:**
  ```json
  {
    "invoiceReference": "INV-202610-0083",
    "allocatedAmount": 1500.0,
    "notes": "Follow-up allocation from remaining unallocated balance"
  }
  ```
- **Expected Status:** `201 Created`
- **Representative Response:**
  - `allocatedAmount`: `8500` ($7000 + 1500$).
  - `unallocatedAmount`: `500` ($9000 - 8500$).
  - Total allocations count: 3.
- **Database Effect:** Inserted into `finance_payment_received_allocations` and parent receipt balances updated.
- **Execution State:** **Prepared**.

---

### 2.6 Remove Invoice Allocation

- **Method & Route:** `DELETE /finance/payments-received/{{paymentReceivedId}}/allocations/{{allocationId}}`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `204 No Content`
- **Database Effect:**
  - Specified allocation deleted from `finance_payment_received_allocations`.
  - Parent `allocatedAmount` decreased by `4000.00`.
  - Parent `unallocatedAmount` increased by `4000.00` to `4500.00`.
- **Execution State:** **Prepared**.

---

### 2.7 Confirm Receipt & Post Double-Entry GL Journal

- **Method & Route:** `POST /finance/payments-received/{{paymentReceivedId}}/confirm`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Body:** `{}`
- **Expected Status:** `201 Created`
- **Representative Response:**
  ```json
  {
    "data": {
      "id": 208,
      "status": "CONFIRMED",
      "journalEntryId": 64,
      "journalEntry": {
        "entryNumber": "JV-202610-0016",
        "entryType": "PAYMENT_RECEIVED",
        "totalDebit": 9000,
        "totalCredit": 9000,
        "status": "POSTED"
      }
    }
  }
  ```
- **Postman Tests Script:**
  ```javascript
  const res = pm.response.json();
  pm.test("Status is 201", () => pm.response.to.have.status(201));
  pm.test("Status is CONFIRMED", () => {
    pm.expect(res.data.status).to.equal("CONFIRMED");
    pm.environment.set("paymentJournalId", res.data.journalEntryId);
  });
  ```
- **Accounting & Database Effects:**
  1. `finance_payments_received.status` becomes `CONFIRMED`.
  2. Balanced `FinanceJournalEntry` created:
     - `Debit: Operating Bank / Cash Asset (1020/1010)`: `9000.00` ($\Delta = +9000.00$).
     - `Credit: Accounts Receivable (1200)`: `9000.00` ($\Delta = -9000.00$).
  3. Total Debits equal Total Credits.
- **Execution State:** **Prepared**.

---

### 2.8 Void Receipt & Reverse General Ledger Entry

- **Method & Route:** `POST /finance/payments-received/{{paymentReceivedId}}/void`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Body:** `{}`
- **Expected Status:** `201 Created`
- **Representative Response:** `status` transitions to `VOID`.
- **Accounting & Database Effects:**
  1. `finance_payments_received.status` becomes `VOID`.
  2. Original `FinanceJournalEntry` updated to `status = 'REVERSED'`.
  3. Reversal `FinanceJournalEntry` created with prefix `REV-YYYYMM-XXXX`:
     - `Debit: Accounts Receivable (1200)`: `9000.00` ($\Delta = +9000.00$).
     - `Credit: Operating Bank / Cash (1020/1010)`: `9000.00` ($\Delta = -9000.00$).
  4. GL account balances restored.
- **Execution State:** **Prepared**.

---

### 2.9 Soft Delete Void Receipt

- **Method & Route:** `DELETE /finance/payments-received/{{paymentReceivedId}}`
- **Required Permission:** `finance.payment_received.write`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Expected Status:** `204 No Content`
- **Database Effect:** `finance_payments_received.deletedAt` timestamp set.
- **Execution State:** **Prepared**.

---

### 2.10 Milestone 4 Negative Test Cases

1. **Future Payment Date Rejection:**
   - `POST /finance/payments-received` with `"paymentDate": "2099-01-01"`
   - Expected: `422 Unprocessable Entity` (`FUTURE_PAYMENT_DATE`).
2. **Over-Allocation on Receipt Creation:**
   - `POST /finance/payments-received` with `"amount": 5000`, allocations summing to `5500`
   - Expected: `422 Unprocessable Entity` (`EXCEEDS_PAYMENT_AMOUNT`).
3. **Over-Allocation on Dynamic Add:**
   - `POST /finance/payments-received/{{paymentReceivedId}}/allocations` with amount exceeding `unallocatedAmount`
   - Expected: `422 Unprocessable Entity` (`EXCEEDS_UNALLOCATED_BALANCE`).
4. **Duplicate Confirmation Rejection:**
   - `POST /finance/payments-received/{{paymentReceivedId}}/confirm` when already `CONFIRMED`
   - Expected: `422 Unprocessable Entity` (`PAYMENT_ALREADY_CONFIRMED`).
5. **Modification of Voided Receipt:**
   - `PATCH /finance/payments-received/{{paymentReceivedId}}` when status is `VOID`
   - Expected: `422 Unprocessable Entity` (`IMMUTABLE_VOID_PAYMENT`).
6. **Deletion of Confirmed Receipt:**
   - `DELETE /finance/payments-received/{{paymentReceivedId}}` when status is `CONFIRMED`
   - Expected: `422 Unprocessable Entity` (`CANNOT_DELETE_CONFIRMED_RECEIPT`).
7. **Allocation on Void Receipt:**
   - `POST /finance/payments-received/{{paymentReceivedId}}/allocations` when status is `VOID`
   - Expected: `422 Unprocessable Entity` (`PAYMENT_VOID`).

---

## 7. Cross-Cutting Security & Multi-Tenancy Test Cases

### 3.1 Unauthenticated Access (401 Unauthorized)

- **Method & Route:** `GET /finance/expenses` (without `Authorization` header)
- **Expected Status:** `401 Unauthorized`

### 3.2 Permission Denial (403 Forbidden)

- **Method & Route:** `POST /finance/expenses` with a bearer token that has only `finance.expense.read`
- **Expected Status:** `403 Forbidden`

### 3.3 Cross-Tenant Data Isolation (404 Not Found)

- **Setup:** User from Organization A (`orgA`) attempts to access an expense or payment receipt created by Organization B (`orgB`).
- **Method & Route:** `GET /finance/payments-received/{{orgB_paymentId}}` with `tokenA`
- **Expected Status:** `404 Not Found` (Scoping ensures other organizations' records do not leak or reveal existence).

---

## 8. Summary of Test Execution Status

| Category                 | Test Suite / Flow                                    | Status                                 | Evidence                                                                                                                                                                                |
| :----------------------- | :--------------------------------------------------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Automated Unit Tests** | Expenses Service & Repository (Milestone 3)          | **PASSED (35 tests)**                  | `pnpm --filter api test src/modules/finance/expenses`                                                                                                                                   |
| **Automated Unit Tests** | Payments Received Service & Repository (Milestone 4) | **PASSED (43 tests)**                  | `pnpm --filter api test src/modules/finance/payments-received`                                                                                                                          |
| **Automated Unit Tests** | Chart of Accounts & Journals (Milestones 1 & 2)      | **PASSED (61 tests)**                  | `pnpm --filter api test src/modules/finance/coa src/modules/finance/journal`                                                                                                            |
| **Automated Unit Tests** | Finance Model Invariants & Rules                     | **PASSED (10 tests)**                  | `pnpm --filter api test test/finance-core-model-rules.spec.ts`                                                                                                                          |
| **Automated Unit Tests** | Master-List Foundation                               | **PASSED (9 tests)**                   | `pnpm --filter api test src/modules/finance-settings`                                                                                                                                   |
| **E2E Test Suites**      | All Finance E2E specs                                | **Authored & Ready (Blocked locally)** | Blocked by `e2e-guard.ts` (offline disposable test DB `texawave_erp_test` & Redis `DB 5`)                                                                                               |
| **Manual Postman Tests** | Milestone 3 & Milestone 4 Lifecycle Suites           | **Prepared**                           | Exported to [`postman/finance-api.postman_collection.json`](file:///C:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/postman/finance-api.postman_collection.json) |
