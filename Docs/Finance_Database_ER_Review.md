# TexaWave ERP — Finance Module Database & Entity-Relationship (ER) Review

**Document Version:** 1.0.0  
**Audit Date:** 27 October 2026  
**Auditor:** TexaWave ERP Core Engineering  
**Active Branch:** `feature/finance`  
**Prisma Datasource:** PostgreSQL multi-schema (`finance`, `platform`, `hr`, `crm`, `scm`)  
**Database Name:** `texawave_erp`

---

## 1. Executive Database Summary

The TexaWave ERP Finance module is built on PostgreSQL utilizing Prisma ORM with native PostgreSQL multi-schema tenancy. All core financial accounting, expense, banking, disbursement, tax, and reporting tables are encapsulated within the dedicated `finance` database schema (`@@schema("finance")`).

### Key Database Metrics:

- **Total Finance Models:** 11 models
- **Total Database Fields:** 232 fields (186 scalar fields + 46 relation fields)
- **Database Schema:** `finance`
- **Primary Migration Files:**
  1. `20261022170500_add_finance_master_list_items`: Introduces configurable categories and classification dimensions (`finance_master_list_items`).
  2. `20261022174500_add_finance_core_module`: Creates the 10 core financial tables (`accounts`, `journal_entries`, `journal_lines`, `bank_accounts`, `bank_transactions`, `expenses`, `payments_received`, `payment_received_allocations`, `payments_made`, `gst_entries`).
  3. `20261026160000_add_expense_gst_and_itc_fields`: Adds 11 statutory GST and Input Tax Credit (ITC) columns to `expenses` along with composite index `[organization_id, vendor_gstin]`.
- **Live Database Status:** Schema-derived relationships and migration SQL have been 100% verified against repository source code. Direct table inspection against live PostgreSQL was blocked by local container downtime (`Error P1001: Can't reach database server at localhost:5432`), confirming that unit tests mock the database layer and live Postman/Playwright tests remain staged for execution once the database container is online.

---

## 2. PostgreSQL Multi-Schema Context

TexaWave ERP operates a strictly partitioned multi-schema PostgreSQL architecture:

- `platform`: Global system entities, organizations (`Organization`), users (`User`), and RBAC roles/permissions.
- `finance`: General Ledger, Chart of Accounts, Journal Vouchers, Banking, Expenses, Disbursements, Customer Receipts, and GST Registry.
- `hr`: Employee directory (`Employee`), payroll records, and employee reimbursement claims (`ExpenseClaim`).
- `crm`: Customer accounts (`Account`), contacts, sales leads, and opportunities.
- `scm`: Suppliers (`ScmSupplier`), purchase orders, supplier bills (`ScmSupplierBill`), and supplier disbursements (`ScmSupplierPayment`).

Every Finance model contains an `organizationId` foreign key referencing `platform.Organization(id)` to enforce strict multi-tenant data isolation.

---

## 3. Entity-Relationship Diagrams

### 3.1 Finance Subsystem Overview

This diagram illustrates all 11 core Finance models, their internal linkages, and cross-schema references.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_ACCOUNT : "scopes"
    ORGANIZATION ||--o{ FINANCE_EXPENSE : "scopes"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_ENTRY : "scopes"
    ORGANIZATION ||--o{ FINANCE_BANK_ACCOUNT : "scopes"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED : "scopes"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_MADE : "scopes"
    ORGANIZATION ||--o{ FINANCE_GST_ENTRY : "scopes"
    ORGANIZATION ||--o{ FINANCE_MASTER_LIST_ITEM : "scopes"

    FINANCE_ACCOUNT ||--o{ FINANCE_ACCOUNT : "parent / sub-accounts"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "records movement"
    FINANCE_ACCOUNT ||--o{ FINANCE_BANK_ACCOUNT : "gl_account_id"
    FINANCE_ACCOUNT ||--o{ FINANCE_EXPENSE : "gl_account_id"

    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "contains (cascade)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_JOURNAL_ENTRY : "reversal_of / reversed_entry"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_EXPENSE : "posted from"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_RECEIVED : "posted from"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_MADE : "posted from"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_BANK_TRANSACTION : "matched to"

    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_BANK_TRANSACTION : "contains (cascade)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_EXPENSE : "disbursed from"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "deposited into"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_MADE : "disbursed from"

    FINANCE_PAYMENT_RECEIVED ||--|{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "allocates (cascade)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "categorizes type/mode"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_RECEIVED : "categorizes mode"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_MADE : "categorizes mode"

    FINANCE_EXPENSE {
        int id PK
        int organization_id FK
        string expense_number UK
        date expense_date
        int expense_type_id FK
        decimal amount
        decimal tax_amount
        decimal net_amount
        string status
        int bank_account_id FK
        int gl_account_id FK
        int journal_entry_id FK
        string vendor_gstin
        string vendor_invoice_number
        decimal tax_rate
        decimal cgst_amount
        decimal sgst_amount
        decimal igst_amount
        boolean is_itc_eligible
    }

    FINANCE_ACCOUNT {
        int id PK
        int organization_id FK
        string code UK
        string name
        string account_type
        int parent_account_id FK
        decimal current_balance
        boolean is_active
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        int organization_id FK
        string entry_number UK
        date entry_date
        string status
        decimal total_debit
        decimal total_credit
        int reversed_entry_id FK
    }

    FINANCE_JOURNAL_LINE {
        int id PK
        int organization_id FK
        int journal_entry_id FK
        int account_id FK
        string entry_type
        decimal amount
        string description
    }

    FINANCE_BANK_ACCOUNT {
        int id PK
        int organization_id FK
        string account_number
        string bank_name
        string ifsc_code
        string account_type
        decimal current_balance
        int gl_account_id FK
    }

    FINANCE_BANK_TRANSACTION {
        int id PK
        int organization_id FK
        int bank_account_id FK
        date transaction_date
        string transaction_type
        decimal amount
        string status
        int matched_journal_entry_id FK
    }

    FINANCE_PAYMENT_RECEIVED {
        int id PK
        int organization_id FK
        string payment_number UK
        date payment_date
        int customer_id FK
        decimal total_amount
        decimal unallocated_amount
        string status
        int bank_account_id FK
        int journal_entry_id FK
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK
        int organization_id FK
        int payment_received_id FK
        string invoice_reference
        decimal allocated_amount
    }

    FINANCE_PAYMENT_MADE {
        int id PK
        int organization_id FK
        string payment_number UK
        date payment_date
        string vendor_name
        decimal amount
        string status
        int bank_account_id FK
        int journal_entry_id FK
        int scm_supplier_payment_id FK
    }

    FINANCE_GST_ENTRY {
        int id PK
        int organization_id FK
        string return_type
        string entry_type
        string source_type
        int source_id
        string gstin
        decimal taxable_value
        decimal tax_rate
        decimal cgst
        decimal sgst
        decimal igst
        string itc_eligibility
        string status
    }

    FINANCE_MASTER_LIST_ITEM {
        int id PK
        int organization_id FK
        string category
        string code UK
        string name
        boolean is_active
    }
```

---

### 3.2 Banking & Treasury Subsystem

Captures company bank accounts, automated bank transaction lines, and General Ledger matching for bank reconciliation.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_BANK_ACCOUNT : "owns"
    ORGANIZATION ||--o{ FINANCE_BANK_TRANSACTION : "scopes"

    FINANCE_ACCOUNT ||--o{ FINANCE_BANK_ACCOUNT : "maps to GL Asset Account (1010/1020)"
    FINANCE_BANK_ACCOUNT ||--|{ FINANCE_BANK_TRANSACTION : "contains statement lines (cascade delete)"

    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_BANK_TRANSACTION : "matches & reconciles"
    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "contains"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "posts movement"

    FINANCE_BANK_ACCOUNT {
        int id PK
        int organization_id FK
        string account_name
        string account_number "UK per organization"
        string bank_name
        string branch_name
        string ifsc_code "Validated Indian IFSC regex"
        string account_type "SAVINGS, CURRENT, OVERDRAFT"
        string currency "Default INR"
        decimal opening_balance
        date opening_date
        decimal current_balance "Updated atomically via transactions"
        int gl_account_id FK "References finance.accounts"
        boolean is_active
        datetime created_at
        datetime updated_at
        datetime deleted_at "Soft-delete"
    }

    FINANCE_BANK_TRANSACTION {
        int id PK
        int organization_id FK
        int bank_account_id FK "References finance.bank_accounts"
        date transaction_date
        string transaction_type "DEPOSIT, WITHDRAWAL, TRANSFER"
        decimal amount "Positive monetary decimal(15,2)"
        string reference_number "Cheque / UTR / Reference"
        string description "Narration"
        string payee_or_payer
        string status "UNCLEARED, CLEARED, RECONCILED, VOID"
        boolean is_reconciled "Flag for reconciliation"
        datetime reconciled_at
        int reconciled_by_user_id
        int matched_journal_entry_id FK "References finance.journal_entries"
        datetime created_at
        datetime updated_at
    }

    FINANCE_ACCOUNT {
        int id PK
        string code "e.g. 1020 (HDFC Bank Operational)"
        string name "Bank Account GL Ledger"
        string account_type "ASSET"
        decimal current_balance
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        string entry_number "JE-YYYYMMDD-XXXX"
        date entry_date
        string status "POSTED"
        decimal total_debit
        decimal total_credit
    }

    FINANCE_JOURNAL_LINE {
        int id PK
        int journal_entry_id FK
        int account_id FK
        string entry_type "DEBIT or CREDIT"
        decimal amount
    }
```

---

### 3.3 Customer Receipts & Payment Allocations

Captures customer payment inflows, multi-invoice allocations, unallocated advance credit, and GL postings.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED : "scopes"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "scopes"

    CRM_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "customer payee"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_RECEIVED : "payment mode (NEFT, UPI, Cheque)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "receiving depository account"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_RECEIVED : "posted double-entry journal"

    FINANCE_PAYMENT_RECEIVED ||--|{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "allocates across invoices (cascade)"

    FINANCE_PAYMENT_RECEIVED {
        int id PK
        int organization_id FK
        string payment_number UK "PR-YYYYMMDD-XXXX"
        date payment_date
        int customer_id FK "References crm.accounts (Customer)"
        string customer_name "Denormalized customer company"
        int payment_mode_id FK "References finance.finance_master_list_items"
        decimal total_amount "Total gross amount received"
        decimal allocated_amount "Sum of line allocations"
        decimal unallocated_amount "Advance credit retained (total - allocated)"
        string reference_number "UTR / Cheque / Bank ref"
        string status "DRAFT, CONFIRMED, RECONCILED, VOID"
        int bank_account_id FK "References finance.bank_accounts"
        int journal_entry_id FK "References finance.journal_entries"
        string notes
        datetime created_at
        datetime updated_at
        datetime deleted_at "Soft-delete"
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK
        int organization_id FK
        int payment_received_id FK "References finance.payments_received"
        string invoice_reference "Invoice number or identifier"
        decimal invoice_total_amount "Original total invoice value"
        decimal previous_paid_amount "Cumulative prior settlements"
        decimal allocated_amount "Amount settled in this payment"
        decimal remaining_balance "Outstanding invoice balance"
        datetime allocation_date
        datetime created_at
        datetime updated_at
    }

    CRM_ACCOUNT {
        int id PK
        string name "Customer Account Name"
        string gstin "Customer statutory GSTIN"
        string status "ACTIVE"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK
        string account_name "Receiving Bank Account"
        decimal current_balance "Incremented upon receipt confirmation"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        string entry_number "JE Voucher Number"
        decimal total_debit "Debit: Bank Account (1010/1020)"
        decimal total_credit "Credit: Accounts Receivable (1200) + Advance (2110)"
    }
```

---

### 3.4 Expenses & Input Tax Credit (ITC)

Captures operational expenses, employee claims conversion, and the 11 new GST/ITC columns introduced in migration `20261026160000_add_expense_gst_and_itc_fields`.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_EXPENSE : "scopes"

    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "categorizes (expense_type_id)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "specifies (payment_mode_id)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_EXPENSE : "disburses payment from"
    FINANCE_ACCOUNT ||--o{ FINANCE_EXPENSE : "nominal expense GL account (5xxx)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_EXPENSE : "posted journal voucher"

    HR_EXPENSE_CLAIM ||--o| FINANCE_EXPENSE : "converted from claim (claim_id)"
    FINANCE_EXPENSE ||--o| FINANCE_GST_ENTRY : "creates inward GSTR-2B entry (polymorphic)"

    FINANCE_EXPENSE {
        int id PK
        int organization_id FK
        string expense_number UK "EXP-YYYYMMDD-XXXX"
        date expense_date
        int expense_type_id FK "References finance_master_list_items"
        string vendor_name "Vendor or Payee string"
        decimal amount "Total gross disbursement"
        decimal tax_amount "GST component (CGST+SGST or IGST)"
        decimal net_amount "Taxable base expense amount"
        string payment_method "CASH, BANK_TRANSFER, UPI, CHEQUE"
        int payment_mode_id FK "References finance_master_list_items"
        int bank_account_id FK "References finance.bank_accounts"
        int gl_account_id FK "References finance.accounts (5xxx Expense)"
        string status "DRAFT, SUBMITTED, APPROVED, REJECTED, PAID, CANCELLED"
        int journal_entry_id FK "References finance.journal_entries"
        int claim_id "References hr.expense_claims (Cross-schema)"
        string vendor_gstin "15-char statutory GSTIN (Migration 20261026160000)"
        string vendor_invoice_number "Vendor tax invoice number"
        date vendor_invoice_date "Invoice date for ITC validation"
        string hsn_sac_code "HSN or SAC classification code"
        decimal tax_rate "0, 5, 12, 18, 28% GST rate"
        decimal cgst_amount "Central GST (intra-state 50% split)"
        decimal sgst_amount "State GST (intra-state 50% split)"
        decimal igst_amount "Integrated GST (inter-state 100%)"
        boolean is_itc_eligible "true: debits Asset 1300; false: absorbs in expense"
        string ineligibility_reason "Sec 17(5) blocked reason if false"
        string gst_jurisdiction "INTRA_STATE or INTER_STATE"
        string receipt_url "Attachment URL"
        string notes
        datetime created_at
        datetime updated_at
        datetime deleted_at "Soft-delete"
    }

    FINANCE_ACCOUNT {
        int id PK
        string code "5200 Operating / 1300 Input Tax Credit"
        string name "Expense Account / Tax Receivable Asset"
        string account_type "EXPENSE or ASSET"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        string entry_number "JE Voucher Number"
        decimal total_debit "DR: Expense (5xxx) + DR: ITC Asset (1300)"
        decimal total_credit "CR: Bank / Cash / Payables (1010/2000)"
    }

    FINANCE_GST_ENTRY {
        int id PK
        string return_type "GSTR_2B"
        string entry_type "INWARD_SUPPLY"
        string source_type "EXPENSE"
        int source_id "References finance.expenses(id)"
        string itc_eligibility "ELIGIBLE or INELIGIBLE"
    }

    HR_EXPENSE_CLAIM {
        int id PK
        int employee_id FK "References hr.employees (fullName)"
        string claim_number "CLM-XXXX"
        decimal amount
        string status "APPROVED"
        int finance_expense_id FK "Links back once converted"
    }
```

---

### 3.5 GST Registry & Returns

Captures inward and outward GST supply records, GSTR-1, GSTR-2B, and GSTR-3B filings, and reconciliation metadata.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_GST_ENTRY : "scopes"

    FINANCE_EXPENSE ||--o| FINANCE_GST_ENTRY : "source: EXPENSE (Inward GSTR-2B)"
    SCM_SUPPLIER_BILL ||--o| FINANCE_GST_ENTRY : "source: PURCHASE_BILL (Inward GSTR-2B)"
    SALES_INVOICE ||--o| FINANCE_GST_ENTRY : "source: SALES_INVOICE (Outward GSTR-1)"

    FINANCE_GST_ENTRY ||--o{ FINANCE_JOURNAL_ENTRY : "audited against tax vouchers"

    FINANCE_GST_ENTRY {
        int id PK
        int organization_id FK
        string period "Tax period e.g. '2026-10'"
        string return_type "GSTR_1 (outward) or GSTR_2B (inward)"
        string entry_type "OUTWARD_SUPPLY or INWARD_SUPPLY"
        string source_type "EXPENSE, PURCHASE_BILL, SALES_INVOICE"
        int source_id "Polymorphic integer ID of originating document"
        string document_number "Invoice or voucher number"
        date document_date "Date of originating supply document"
        string counterparty_name "Customer or Vendor trade name"
        string gstin "15-char statutory GSTIN of counterparty"
        string pos_state_code "2-digit Place of Supply state code"
        boolean is_reverse_charge "Flag for RCM liability"
        decimal taxable_value "Base supply value excluding tax"
        decimal tax_rate "Statutory GST percentage (0, 5, 12, 18, 28%)"
        decimal cgst "Central Goods and Services Tax"
        decimal sgst "State Goods and Services Tax"
        decimal igst "Integrated Goods and Services Tax"
        decimal cess "Compensation Cess"
        string itc_eligibility "ELIGIBLE, INELIGIBLE, BLOCKED_17_5"
        string status "DRAFT, FILED, RECONCILED, CANCELLED"
        boolean is_reconciled "Reconciliation match flag"
        datetime reconciled_at
        int reconciled_by_user_id
        datetime created_at
        datetime updated_at
    }

    FINANCE_EXPENSE {
        int id PK
        string expense_number "EXP-XXXX"
        string vendor_gstin
        decimal tax_amount
    }

    SCM_SUPPLIER_BILL {
        int id PK
        string bill_number "BILL-XXXX"
        string supplier_gstin
        decimal tax_amount
    }

    SALES_INVOICE {
        string invoice_number "INV-XXXX"
        string customer_gstin
        decimal tax_amount
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        string entry_number "JE-XXXX"
        decimal total_debit "Audits GL Account 1300 (ITC Asset)"
        decimal total_credit "Audits GL Account 2200 (Output Tax Liability)"
    }
```

---

### 3.6 General Ledger & Financial Reports

Captures Chart of Accounts parent-child hierarchy, double-entry balanced journal vouchers, and financial statement generators.

```mermaid
erDiagram
    ORGANIZATION ||--o{ FINANCE_ACCOUNT : "scopes"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_ENTRY : "scopes"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_LINE : "scopes"

    FINANCE_ACCOUNT ||--o{ FINANCE_ACCOUNT : "parent_account_id (Hierarchical CoA Tree)"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "account_id (Debit/Credit postings)"

    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "journal_entry_id (Cascade delete on draft)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_JOURNAL_ENTRY : "reversed_entry_id (Audit trail reversal)"

    FINANCE_ACCOUNT {
        int id PK
        int organization_id FK
        string code UK "Account Code e.g. 1010, 1200, 2010, 4000, 5200"
        string name "Account Title / Label"
        string account_type "ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"
        int parent_account_id FK "References finance.accounts(id) for tree"
        string currency "Default INR"
        decimal opening_balance "Initial fiscal year opening balance"
        date opening_date
        decimal current_balance "Running balance (Debits - Credits or vice-versa)"
        boolean is_active "Active posting toggle"
        boolean is_reconciled
        datetime created_at
        datetime updated_at
        datetime deleted_at "Soft-delete"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        int organization_id FK
        string entry_number UK "JE-YYYYMMDD-XXXX"
        date entry_date "Transaction / Posting date"
        string reference "Source reference / invoice / claim"
        string description "Journal narration"
        string status "DRAFT, POSTED, REVERSED"
        decimal total_debit "Sum of debit lines (asserts == total_credit)"
        decimal total_credit "Sum of credit lines (asserts == total_debit)"
        int reversed_entry_id FK "References prior journal_entries(id) if reversal"
        datetime created_at
        datetime updated_at
    }

    FINANCE_JOURNAL_LINE {
        int id PK
        int organization_id FK
        int journal_entry_id FK "References finance.journal_entries(id)"
        int account_id FK "References finance.accounts(id)"
        string entry_type "DEBIT or CREDIT"
        decimal amount "Monetary decimal(15,2)"
        string description "Line narration"
        int line_order "Index order for display"
        datetime created_at
    }
```

---

### 3.7 SCM–Finance Cross-Module Integration

Connects Procurement Bills and Sales Orders to General Ledger journal entries and the GST Registry.

```mermaid
erDiagram
    ORGANIZATION ||--o{ SCM_SUPPLIER : "scopes"
    ORGANIZATION ||--o{ SCM_SUPPLIER_BILL : "scopes"
    ORGANIZATION ||--o{ SCM_SUPPLIER_PAYMENT : "scopes"
    ORGANIZATION ||--o{ SCM_SALES_ORDER : "scopes"

    SCM_SUPPLIER ||--o{ SCM_SUPPLIER_BILL : "issues bills"
    SCM_SUPPLIER ||--o{ SCM_SUPPLIER_PAYMENT : "receives disbursements"

    SCM_SUPPLIER_BILL ||--o| FINANCE_JOURNAL_ENTRY : "posts AP & Inventory journal"
    SCM_SUPPLIER_BILL ||--o| FINANCE_GST_ENTRY : "posts inward supply (GSTR-2B)"

    SCM_SUPPLIER_PAYMENT ||--o| FINANCE_PAYMENT_MADE : "scm_supplier_payment_id"
    FINANCE_PAYMENT_MADE ||--o| FINANCE_JOURNAL_ENTRY : "posts bank & AP clearing journal"

    SCM_SALES_ORDER ||--o| FINANCE_JOURNAL_ENTRY : "posts AR, Revenue & Output GST journal"
    SCM_SALES_ORDER ||--o| FINANCE_GST_ENTRY : "posts outward supply (GSTR-1)"
    SCM_SALES_ORDER ||--o{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "invoice_reference settlement"

    SCM_SUPPLIER {
        int id PK
        int organization_id FK
        string supplier_code UK
        string name "Vendor Trade Name"
        string gstin "Vendor statutory GSTIN"
        string pan
        string payment_terms
        decimal total_spend
        decimal outstanding_balance
    }

    SCM_SUPPLIER_BILL {
        int id PK
        int organization_id FK
        int supplier_id FK
        string bill_number UK
        date bill_date
        date due_date
        decimal subtotal "Taxable amount"
        decimal tax_amount "GST amount"
        decimal total_amount "Gross bill amount"
        string status "PENDING, APPROVED, PAID, CANCELLED"
        boolean posted_to_finance "Integration flag"
        int finance_journal_entry_id FK
    }

    SCM_SUPPLIER_PAYMENT {
        int id PK
        int organization_id FK
        int supplier_id FK
        string payment_number UK
        date payment_date
        decimal amount "Disbursed amount"
        string payment_mode
        string status "COMPLETED, VOID"
    }

    SCM_SALES_ORDER {
        int id PK
        int organization_id FK
        string order_number UK "SO-XXXX"
        string customer_name
        decimal total_amount
        decimal tax_amount
        string status "CONFIRMED, INVOICED, FULFILLED"
        boolean posted_to_finance "Integration flag"
    }

    FINANCE_PAYMENT_MADE {
        int id PK
        string payment_number UK "PM-XXXX"
        decimal amount
        string status "CONFIRMED"
        int scm_supplier_payment_id FK "References scm_supplier_payments"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK
        string entry_number UK "JE-XXXX"
        decimal total_debit "DR: Inventory/Expense (1400/5000) or AR (1200)"
        decimal total_credit "CR: AP (2000) or Revenue (4000) + Tax (2200)"
    }

    FINANCE_GST_ENTRY {
        int id PK
        string return_type "GSTR_1 or GSTR_2B"
        string source_type "PURCHASE_BILL or SALES_INVOICE"
        int source_id
        decimal taxable_value
        decimal cgst
        decimal sgst
        decimal igst
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK
        string invoice_reference "Matches SCM order/invoice number"
        decimal allocated_amount "Settles customer receivable"
    }
```

---

## 4. Database Integrity & Constraints Review

### 4.1 Primary & Unique Key Enforcement

- **Surrogate PKs:** All 11 models implement standard integer auto-increment primary keys (`id: Int @id @default(autoincrement())`).
- **Composite Natural Uniqueness:**
  - `FinanceExpense`: `@@unique([organizationId, expenseNumber])` prevents voucher duplication within a tenant.
  - `FinanceAccount`: `@@unique([organizationId, code])` ensures account codes (e.g. 1010, 5200) are globally unique per organization.
  - `FinanceJournalEntry`: `@@unique([organizationId, entryNumber])` enforces sequential voucher numbers.
  - `FinanceBankAccount`: `@@unique([organizationId, accountNumber])` prevents duplicate company bank accounts.
  - `FinancePaymentReceived`: `@@unique([organizationId, paymentNumber])` ensures unique receipt numbers.
  - `FinancePaymentMade`: `@@unique([organizationId, paymentNumber])` prevents duplicate payment vouchers.
  - `FinanceGstEntry`: `@@unique([organizationId, sourceType, sourceId])` eliminates duplicate inward/outward supply tax records upon retries or re-posting.

### 4.2 Index Optimization

- **`FinanceExpense`:**
  - `@@index([organizationId, expenseDate])`: Optimizes date-range statement queries.
  - `@@index([organizationId, expenseTypeId])`: Accelerates category drill-down.
  - `@@index([organizationId, vendorGstin])`: Facilitates vendor GST compliance lookups and GSTR-2B aggregations (added in migration `20261026160000`).
- **`FinanceJournalLine`:**
  - `@@index([organizationId, accountId])`: Speeds up General Ledger account statement streaming.
  - `@@index([journalEntryId])`: Ensures instant retrieval of voucher child lines.
- **`FinanceBankTransaction`:**
  - `@@index([organizationId, bankAccountId, transactionDate])`: Optimizes statement reconciliation views.

### 4.3 Referential Actions & Lifecycle Integrity

- **Cascade Deletes (`onDelete: Cascade`):** Applied exclusively to child sub-lines where the parent owns lifecycle containment:
  - `FinanceJournalEntry -> FinanceJournalLine`
  - `FinanceBankAccount -> FinanceBankTransaction`
  - `FinancePaymentReceived -> FinancePaymentReceivedAllocation`
- **Restrict Deletes (`onDelete: Restrict`):**
  - `FinanceAccount -> FinanceJournalLine`: Prevents deleting any Chart of Accounts entry if posted transactions reference it.
- **Soft Deletes (`deletedAt`):**
  - `FinanceExpense`, `FinanceAccount`, `FinanceBankAccount`, `FinancePaymentReceived`, `FinancePaymentMade` implement `deletedAt: DateTime?`. Hard deletes are blocked in application services once status moves beyond `DRAFT`.

---

## 5. Architectural Findings & Unresolved DB Gaps

1. **Sales Invoice Foreign Key Blocker (P1):**
   - The Sales module currently stores customer invoices as semi-structured documents. `packages/database/prisma/schema.prisma` does not yet possess a dedicated relational `sales.invoices` table.
   - Consequently, `FinancePaymentReceivedAllocation` and `FinanceGstEntry` store invoice linkages via `invoiceReference: String` rather than an enforced relational foreign key.
   - _Impact:_ No database-level cascading or foreign-key integrity between sales invoices and receipts. Foreign key enforcement is scheduled once the dedicated Sales module relational entity migration is deployed.
2. **Cross-Schema Claim Linkage (P2):**
   - `FinanceExpense.claimId` stores an integer reference to `hr.expense_claims(id)` across PostgreSQL schemas. While maintained safely via transactional application code in `ExpensesService`, it lacks database-level foreign key enforcement due to multi-schema tenancy partitioning.
3. **Database Connectivity for E2E Tests (P1):**
   - The PostgreSQL database server at `localhost:5432` was unreachable during automated test execution. Unit test suites utilize mock Prisma clients, successfully achieving 312/312 green tests. Live Postman runs and Playwright tests must be executed once the database container is started.
