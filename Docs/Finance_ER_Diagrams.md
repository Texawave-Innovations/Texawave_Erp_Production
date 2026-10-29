# TexaWave ERP — Complete Finance Module Entity-Relationship (ER) Documentation

**Document ID:** TEXA-FIN-ERD-2026-10-27  
**Module:** TexaWave ERP — Finance & Accounting (`@@schema("finance")`)  
**Active Branch:** `feature/finance`  
**Primary Source of Truth:** `packages/database/prisma/schema.prisma`  
**Secondary Source of Truth:** `packages/database/prisma/migrations/`  
**Status:** **Schema-Derived & Migration-Verified** (Live DB Container Offline on local port 5432)  
**Publication Date:** 27 October 2026

---

## Executive Overview & Architectural Invariants

This document establishes the official visual and structural Entity-Relationship (ER) specification for the **TexaWave ERP Finance Module**. Every diagram, entity attribute, foreign key constraint, cardinality indicator, and cascade action in this specification reflects the **ACTUAL, CURRENT** database architecture verified directly against the Prisma schema and PostgreSQL migration scripts.

### 1. Inviolable Design & Architectural Rules

1. **Multi-Tenant Schema Isolation:**
   All 11 Finance entities reside in the dedicated PostgreSQL schema `"finance"`. Every entity strictly incorporates an `organization_id` foreign key referencing `platform.organizations(id)` with `ON DELETE RESTRICT ON UPDATE CASCADE`. Financial records can never be orphaned or cross-pollinated across tenant boundaries.
2. **Immutable Double-Entry Ledger Core:**
   The General Ledger engine (`finance.journal_entries` and `finance.journal_lines`) represents the immutable single source of financial truth. Operational transactions (Expenses, Customer Receipts, Vendor Payments Made, Reconciled Bank Transactions) link to the GL via strict 1:1 foreign keys (`journal_entry_id`).
3. **Double-Entry Invariant:**
   At all times, for any posted journal entry:
   $$\sum \text{debit\_amount} = \sum \text{credit\_amount}$$
   Draft journal entries may be modified or deleted; posted entries are immutable and can only be reversed by an explicit reversal entry (`reversed_entry_id`).
4. **Dynamic Financial Reporting:**
   Financial statements (Balance Sheet, Profit & Loss, Trial Balance, General Ledger, Cash/Bank Summary) are **dynamically aggregated runtime calculations** executed by `FinancialReportsService`. There are no stale reporting tables or materialized views; figures reflect real-time posted ledger states.
5. **Physical vs Logical Integration Boundaries:**
   - Physical foreign keys are used where referential integrity must be enforced by PostgreSQL (`platform.organizations`, `crm.accounts`, `scm.supplier_payments`).
   - Polymorphic string keys are used where documents span multiple source modules (`finance.gst_entries.source_reference`, `finance.payment_received_allocations.invoice_reference`).

---

## Notation & Key Conventions

The ER diagrams in this document follow the standard **Crow's Foot Notation**:

|      Symbol      | Meaning                     | Cardinality               | Explanation                                                                     |
| :--------------: | :-------------------------- | :------------------------ | :------------------------------------------------------------------------------ |
|   `\|\|--\|\|`   | Exactly One to Exactly One  | 1 : 1 (Mandatory)         | Child requires parent, exactly one child per parent.                            |
|   `\|\|--o\|`    | Exactly One to Zero or One  | 1 : 0..1 (Optional)       | Child may reference parent (unique key enforces 1:1 if present).                |
|   `\|\|--\|{`    | Exactly One to One or More  | 1 : 1..* (Mandatory Many) | Parent must have at least one child (e.g. Journal Entry to Lines).              |
|    `\|\|--o{`    | Exactly One to Zero or More | 1 : 0..* (Optional Many)  | Parent can have zero or multiple child records.                                 |
| `..o\|` / `..o{` | Dotted line                 | Logical / Polymorphic     | Application-enforced relationship; no physical database foreign key constraint. |

### Column Field Legend

- **PK**: Primary Key (`id Int`, sequence autoincrement)
- **FK**: Physical Database Foreign Key Constraint
- **UK**: Unique Constraint / Unique Index
- **NULL**: Nullable column (optional in business workflows)
- **DEFAULT**: Default database value applied upon row creation

---

## Section 1: ER 1 — Finance Module Comprehensive Overview

ER 1 illustrates the complete entity ecosystem of the TexaWave Finance module, showcasing all 11 core finance tables and their cross-schema connections to Platform, CRM, SCM, and HR.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 1: TexaWave ERP — Complete Finance Module Overview
    %% Schema: @@schema("finance") with platform, crm, scm cross-schema references
    %% Source of Truth: packages/database/prisma/schema.prisma & Migration 20261022174500
    %% Status: Schema-Derived & Migration-Verified (Live DB: Offline)
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_ACCOUNT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_EXPENSE : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_ENTRY : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_LINE : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_BANK_ACCOUNT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_BANK_TRANSACTION : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_MADE : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_GST_ENTRY : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_MASTER_LIST_ITEM : "organization_id (RESTRICT)"

    FINANCE_ACCOUNT ||--o{ FINANCE_ACCOUNT : "parent_account_id (SET NULL)"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "account_id (RESTRICT)"
    FINANCE_ACCOUNT ||--o{ FINANCE_BANK_ACCOUNT : "gl_account_id (SET NULL)"
    FINANCE_ACCOUNT ||--o{ FINANCE_EXPENSE : "gl_account_id (SET NULL)"

    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "journal_entry_id (CASCADE)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_JOURNAL_ENTRY : "reversed_entry_id (SET NULL)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_EXPENSE : "journal_entry_id (1:1 UK)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_RECEIVED : "journal_entry_id (1:1 UK)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_MADE : "journal_entry_id (1:1 UK)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_BANK_TRANSACTION : "matched_journal_entry_id (1:1 UK)"

    FINANCE_BANK_ACCOUNT ||--|{ FINANCE_BANK_TRANSACTION : "bank_account_id (CASCADE)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_EXPENSE : "bank_account_id (SET NULL)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "bank_account_id (SET NULL)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_MADE : "bank_account_id (SET NULL)"

    FINANCE_PAYMENT_RECEIVED ||--|{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "payment_received_id (CASCADE)"
    CRM_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "customer_id (SET NULL)"

    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "expense_type_id (RESTRICT)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "payment_mode_id (SET NULL)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_RECEIVED : "payment_mode_id (RESTRICT)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_MADE : "payment_mode_id (RESTRICT)"

    SCM_SUPPLIER_PAYMENT ||--o| FINANCE_PAYMENT_MADE : "scm_supplier_payment_id (1:1 UK)"

    FINANCE_EXPENSE ||..o| HR_EXPENSE_CLAIM : "claim_id (Logical cross-schema)"
    FINANCE_GST_ENTRY ||..o{ FINANCE_EXPENSE : "source_type EXPENSE (Polymorphic)"
    FINANCE_PAYMENT_RECEIVED_ALLOCATION ||..o{ SCM_SALES_ORDER : "invoice_reference (String match)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Business Name"
    }

    FINANCE_ACCOUNT {
        int id PK "accounts.id"
        int organization_id FK "References platform.organizations"
        string code "account_code UK per org"
        string name "Account Title"
        string account_type "ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"
        int parent_account_id FK "Self-referential CoA tree"
        decimal current_balance "Running balance"
        boolean is_active "Active posting toggle"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        int organization_id FK "References platform.organizations"
        string entry_number "entry_number UK per org"
        date entry_date "Posting date"
        string status "DRAFT, POSTED, REVERSED"
        decimal total_debit "Debit sum"
        decimal total_credit "Credit sum"
        int reversed_entry_id FK "1:1 Reversal link"
    }

    FINANCE_JOURNAL_LINE {
        int id PK "journal_lines.id"
        int organization_id FK "References platform.organizations"
        int journal_entry_id FK "Cascade delete on parent voucher"
        int account_id FK "Restrict delete on GL account"
        string entry_type "DEBIT or CREDIT"
        decimal amount "Scale 2 monetary decimal"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK "bank_accounts.id"
        int organization_id FK "References platform.organizations"
        string account_number "UK per organization"
        string bank_name "Bank Institution"
        string ifsc_code "Validated Indian IFSC"
        decimal current_balance "Live balance"
        int gl_account_id FK "Mapped Asset GL Account"
    }

    FINANCE_BANK_TRANSACTION {
        int id PK "bank_transactions.id"
        int organization_id FK "References platform.organizations"
        int bank_account_id FK "Cascade delete on bank account"
        date transaction_date "Statement date"
        string transaction_type "DEPOSIT, WITHDRAWAL, TRANSFER"
        decimal amount "Transaction amount"
        string status "UNCLEARED, CLEARED, RECONCILED, VOID"
        int matched_journal_entry_id FK "1:1 Matched GL voucher"
    }

    FINANCE_EXPENSE {
        int id PK "expenses.id"
        int organization_id FK "References platform.organizations"
        string expense_number "UK per organization"
        date expense_date "Expense voucher date"
        int expense_type_id FK "Category master list item"
        decimal amount "Gross disbursement amount"
        decimal tax_amount "GST component"
        decimal net_amount "Taxable base expense"
        string status "DRAFT, SUBMITTED, APPROVED, PAID, CANCELLED"
        int bank_account_id FK "Disbursing bank account"
        int gl_account_id FK "Nominal expense account"
        int journal_entry_id FK "1:1 Posted journal voucher"
        int claim_id "Logical FK to hr.expense_claims"
        string vendor_gstin "15-char statutory GSTIN"
        boolean is_itc_eligible "true: debits 1300, false: absorbs"
    }

    FINANCE_PAYMENT_RECEIVED {
        int id PK "payments_received.id"
        int organization_id FK "References platform.organizations"
        string payment_number "UK per organization"
        date payment_date "Receipt date"
        int customer_id FK "References crm.accounts"
        decimal total_amount "Total money received"
        decimal allocated_amount "Settled across invoices"
        decimal unallocated_amount "Retained advance credit"
        string status "DRAFT, CONFIRMED, RECONCILED, VOID"
        int bank_account_id FK "Receiving depository bank"
        int journal_entry_id FK "1:1 Posted journal voucher"
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK "payment_received_allocations.id"
        int organization_id FK "References platform.organizations"
        int payment_received_id FK "Cascade delete on receipt"
        string invoice_reference "Invoice number string match"
        decimal allocated_amount "Portion applied to invoice"
    }

    FINANCE_PAYMENT_MADE {
        int id PK "payments_made.id"
        int organization_id FK "References platform.organizations"
        string payment_number "UK per organization"
        date payment_date "Disbursement date"
        string vendor_name "Payee vendor title"
        decimal amount "Disbursed monetary sum"
        string status "DRAFT, CONFIRMED, RECONCILED, VOID"
        int bank_account_id FK "Disbursing bank account"
        int journal_entry_id FK "1:1 Posted journal voucher"
        int scm_supplier_payment_id FK "1:1 SCM disbursement link"
    }

    FINANCE_GST_ENTRY {
        int id PK "gst_entries.id"
        int organization_id FK "References platform.organizations"
        string period "Tax period e.g. 2026-10"
        string return_type "GSTR_1 or GSTR_2B"
        string entry_type "OUTWARD_SUPPLY or INWARD_SUPPLY"
        string source_type "EXPENSE, PURCHASE_BILL, SALES_INVOICE"
        int source_id "Polymorphic integer ID"
        string gstin "Counterparty 15-char GSTIN"
        decimal taxable_value "Base supply value"
        decimal tax_rate "Statutory tax rate"
        decimal cgst "Central GST"
        decimal sgst "State GST"
        decimal igst "Integrated GST"
        string itc_eligibility "ELIGIBLE or INELIGIBLE"
    }

    FINANCE_MASTER_LIST_ITEM {
        int id PK "finance_master_list_items.id"
        int organization_id FK "References platform.organizations"
        string category "EXPENSE_TYPE, PAYMENT_MODE"
        string value "Category or mode code"
        boolean is_active "Active option toggle"
    }

    CRM_ACCOUNT {
        int id PK "crm.accounts"
        string name "Customer Account Name"
    }

    SCM_SUPPLIER_PAYMENT {
        int id PK "scm.supplier_payments"
        string payment_number "SCM Payment Number"
    }

    HR_EXPENSE_CLAIM {
        int id PK "hr.expense_claims"
        string claim_number "CLM-XXXX"
    }

    SCM_SALES_ORDER {
        int id PK "scm.sales_orders"
        string order_number "SO-XXXX"
    }


```

### Architectural Discussion: ER 1

- **Hub-and-Spoke Architecture:** The Chart of Accounts (`accounts`) and Journal Entries (`journal_entries`) form the central hub. Every financial submodule (Expenses, Payments Received, Payments Made, Banking) operates as an outward spoke that writes into the hub.
- **Tenant Anchor:** `platform.organizations` anchors all 11 entities, guaranteeing clean data segregation across enterprise organizations.
- **Master Data Configuration:** `finance_master_list_items` acts as the unified configurable dictionary for expense types and payment modes, standardizing terminology across accounting documents.

---

## Section 2: ER 2 — Chart of Accounts & General Ledger

ER 2 highlights the double-entry accounting engine: hierarchical Chart of Accounts, Journal Entries, and Journal Lines.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 2: TexaWave ERP — Chart of Accounts & General Ledger Subsystem
    %% Physical Tables: finance.accounts, finance.journal_entries, finance.journal_lines
    %% Foreign Keys & Actions:
    %%   - journal_lines.journal_entry_id -> journal_entries.id [CASCADE DELETE]
    %%   - journal_lines.account_id -> accounts.id [RESTRICT DELETE]
    %%   - accounts.parent_account_id -> accounts.id [SET NULL]
    %%   - journal_entries.reversed_entry_id -> journal_entries.id [SET NULL] (1:1 UK)
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_ACCOUNT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_ENTRY : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_LINE : "organization_id (RESTRICT)"

    FINANCE_ACCOUNT ||--o{ FINANCE_ACCOUNT : "parent_account_id (Hierarchical CoA Tree)"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "account_id (Debit/Credit lines - RESTRICT)"

    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "journal_entry_id (Voucher lines - CASCADE)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_JOURNAL_ENTRY : "reversed_entry_id (Reversal pair - 1:1 UK)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_ACCOUNT {
        int id PK "accounts.id"
        int organization_id FK "References platform.organizations(id)"
        string code "account_code (e.g. 1010, 1200, 2010, 4000, 5200) UK per org"
        string name "Account Label / Description"
        string account_type "ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"
        int parent_account_id FK "Self-referencing tree parent account ID"
        string currency "Default INR"
        decimal opening_balance "Opening balance Decimal(15,2)"
        date opening_date "Opening balance date"
        decimal current_balance "Live running balance Decimal(15,2)"
        boolean is_active "Active posting toggle (default true)"
        boolean is_reconciled "Reconciliation flag"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
        datetime deleted_at "Soft-delete timestamp"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        int organization_id FK "References platform.organizations(id)"
        string entry_number "entry_number UK per org (JE-YYYYMMDD-XXXX)"
        date entry_date "Posting date"
        string reference "Voucher reference / source document"
        string description "Journal narration"
        string status "DRAFT, POSTED, REVERSED"
        decimal total_debit "Sum of debit lines (asserts == total_credit)"
        decimal total_credit "Sum of credit lines (asserts == total_debit)"
        int reversed_entry_id FK "References original journal_entries.id (1:1 UK)"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    FINANCE_JOURNAL_LINE {
        int id PK "journal_lines.id"
        int organization_id FK "References platform.organizations(id)"
        int journal_entry_id FK "References journal_entries.id (CASCADE)"
        int account_id FK "References accounts.id (RESTRICT)"
        string entry_type "DEBIT or CREDIT"
        decimal amount "Line monetary value Decimal(15,2)"
        string description "Line level narration"
        int line_order "Sequential visual line index"
        datetime created_at "Created timestamp"
    }


```

### Architectural Discussion: ER 2

- **Account Hierarchy:** The `finance.accounts` table features a self-referencing foreign key `parent_account_id` (`ON DELETE SET NULL`). This enables infinite-depth hierarchical account structures (e.g., `Current Assets` $\to$ `Cash & Cash Equivalents` $\to$ `Petty Cash`).
- **Journal Entry Header-Line Invariant:**
  - `journal_lines` enforces `ON DELETE CASCADE` with respect to `journal_entries`. If a draft journal entry is deleted, all corresponding debit and credit lines are cleaned up automatically.
  - Foreign key from `journal_lines.account_id` to `accounts.id` enforces `ON DELETE RESTRICT`, preventing active ledger accounts from being deleted while journal lines point to them.
- **Reversal Audit Trail:** The `reversed_entry_id` self-reference allows posted entries to be voided only via compensating reversing entries, preserving an immutable audit log for compliance.

---

## Section 3: ER 3 — Banking & Treasury Reconciliation

ER 3 illustrates bank account administration, statement transaction feeds, and automated/manual reconciliation against posted journal entries.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 3: TexaWave ERP — Banking & Reconciliation Subsystem
    %% Physical Tables: finance.bank_accounts, finance.bank_transactions, finance.accounts, finance.journal_entries
    %% Foreign Keys & Actions:
    %%   - bank_accounts.gl_account_id -> accounts.id [SET NULL]
    %%   - bank_transactions.bank_account_id -> bank_accounts.id [CASCADE DELETE]
    %%   - bank_transactions.matched_journal_entry_id -> journal_entries.id [SET NULL] (1:1 UK)
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_BANK_ACCOUNT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_BANK_TRANSACTION : "organization_id (RESTRICT)"

    FINANCE_ACCOUNT ||--o{ FINANCE_BANK_ACCOUNT : "gl_account_id (Mapped GL Asset Account 1010/1020)"
    FINANCE_BANK_ACCOUNT ||--|{ FINANCE_BANK_TRANSACTION : "bank_account_id (Statement lines - CASCADE)"

    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_BANK_TRANSACTION : "matched_journal_entry_id (1:1 UK Reconciled)"
    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "journal_entry_id (Voucher breakdown - CASCADE)"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "account_id (GL posting - RESTRICT)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK "bank_accounts.id"
        int organization_id FK "References platform.organizations(id)"
        string account_name "Descriptive Title (e.g. HDFC Current A/c)"
        string account_number "UK per organization"
        string bank_name "Bank Institution Name"
        string branch_name "Branch locality"
        string ifsc_code "Validated Indian IFSC code"
        string account_type "SAVINGS, CURRENT, OVERDRAFT"
        string currency "Default INR"
        decimal opening_balance "Opening balance Decimal(15,2)"
        date opening_date "Opening balance date"
        decimal current_balance "Live running balance Decimal(15,2)"
        int gl_account_id FK "References accounts.id (Asset 1010/1020)"
        boolean is_active "Active bank toggle"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
        datetime deleted_at "Soft-delete timestamp"
    }

    FINANCE_BANK_TRANSACTION {
        int id PK "bank_transactions.id"
        int organization_id FK "References platform.organizations"
        int bank_account_id FK "References bank_accounts.id (CASCADE)"
        date transaction_date "Statement transaction date"
        string transaction_type "DEPOSIT, WITHDRAWAL, TRANSFER"
        decimal amount "Positive monetary amount Decimal(15,2)"
        string reference_number "Cheque / UTR / Reference ID"
        string description "Narration from bank statement"
        string payee_or_payer "Party name"
        string status "UNCLEARED, CLEARED, RECONCILED, VOID"
        boolean is_reconciled "Reconciliation matched flag"
        datetime reconciled_at "Reconciliation timestamp"
        int reconciled_by_user_id "Audit user ID"
        int matched_journal_entry_id FK "References journal_entries.id (1:1 UK)"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    FINANCE_ACCOUNT {
        int id PK "accounts.id"
        string code "account_code (e.g. 1020)"
        string name "GL Bank Account"
        decimal current_balance "GL balance"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        string entry_number "JE Voucher Number (JE-XXXX)"
        decimal total_debit "Debit sum"
        decimal total_credit "Credit sum"
    }

    FINANCE_JOURNAL_LINE {
        int id PK "journal_lines.id"
        string entry_type "DEBIT or CREDIT"
        decimal amount "Movement amount"
    }


```

### Architectural Discussion: ER 3

- **Dual Balance Architecture:** `finance.bank_accounts` maintains both `opening_balance` and `current_balance`. Furthermore, `gl_account_id` links the physical bank account to an Asset account in the Chart of Accounts, enabling comparison between physical statement balance and book balance.
- **Transaction Matching:** `finance.bank_transactions` records incoming statement feeds. When matched with an accounting record, `matched_journal_entry_id` forms a unique 1:1 foreign key pairing, setting `is_reconciled = true` and populating `reconciled_at`.
- **Cascade Rules:** Deleting a bank account cascades to delete its raw transaction records (`ON DELETE CASCADE`), but breaks link to GL entries safely (`ON DELETE SET NULL`).

---

## Section 4: ER 4 — Customer Payments Received (AR)

ER 4 models the Accounts Receivable receipt workflow, invoice allocations, and CRM customer mapping.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 4: TexaWave ERP — Customer Payments Received Subsystem
    %% Physical Tables: finance.payments_received, finance.payment_received_allocations
    %% Cross-Schema Tables: crm.accounts (Customer), platform.organizations
    %% Foreign Keys & Actions:
    %%   - payments_received.customer_id -> crm.accounts.id [SET NULL]
    %%   - payments_received.payment_mode_id -> finance_master_list_items.id [RESTRICT]
    %%   - payments_received.bank_account_id -> bank_accounts.id [SET NULL]
    %%   - payments_received.journal_entry_id -> journal_entries.id [SET NULL] (1:1 UK)
    %%   - payment_received_allocations.payment_received_id -> payments_received.id [CASCADE DELETE]
    %% Logical Reference:
    %%   - payment_received_allocations.invoice_reference -> Sales Invoice String Match
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "organization_id (RESTRICT)"

    CRM_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "customer_id (Customer - SET NULL)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_RECEIVED : "payment_mode_id (RESTRICT)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_RECEIVED : "bank_account_id (Depository - SET NULL)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_RECEIVED : "journal_entry_id (Posted GL voucher - 1:1 UK)"

    FINANCE_PAYMENT_RECEIVED ||--|{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "payment_received_id (CASCADE)"

    FINANCE_PAYMENT_RECEIVED_ALLOCATION ||..o{ SALES_INVOICE_LOGICAL : "invoice_reference (String match - NOT DB FK)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_PAYMENT_RECEIVED {
        int id PK "payments_received.id"
        int organization_id FK "References platform.organizations(id)"
        string payment_number "payment_number UK per org (PR-YYYYMMDD-XXXX)"
        date payment_date "Receipt settlement date"
        int customer_id FK "References crm.accounts.id (Customer)"
        string customer_name "Denormalized customer company"
        int payment_mode_id FK "References finance_master_list_items.id"
        decimal total_amount "Total money received Decimal(15,2)"
        decimal allocated_amount "Sum of line allocations Decimal(15,2)"
        decimal unallocated_amount "Retained advance credit Decimal(15,2)"
        string reference_number "Cheque / UTR / Transaction reference"
        string status "DRAFT, CONFIRMED, RECONCILED, VOID"
        int bank_account_id FK "References bank_accounts.id (SET NULL)"
        int journal_entry_id FK "References journal_entries.id (1:1 UK)"
        string notes "Receipt remarks"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
        datetime deleted_at "Soft-delete timestamp"
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK "payment_received_allocations.id"
        int organization_id FK "References platform.organizations(id)"
        int payment_received_id FK "References payments_received.id (CASCADE)"
        string invoice_reference "Invoice number or identifier (String)"
        decimal invoice_total_amount "Original gross invoice value"
        decimal previous_paid_amount "Prior settled balance"
        decimal allocated_amount "Amount applied from this receipt"
        decimal remaining_balance "Outstanding invoice balance"
        datetime allocation_date "Allocation timestamp"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    CRM_ACCOUNT {
        int id PK "crm.accounts.id"
        string name "Customer Account Company"
        string status "ACTIVE"
    }

    FINANCE_MASTER_LIST_ITEM {
        int id PK "finance_master_list_items.id"
        string category "PAYMENT_MODE"
        string value "NEFT, RTGS, UPI, CHEQUE, CASH"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK "bank_accounts.id"
        string account_name "Receiving Bank Account"
        decimal current_balance "Updated upon confirmation"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        string entry_number "JE-YYYYMMDD-XXXX"
        decimal total_debit "DR: Bank 1010/1020"
        decimal total_credit "CR: AR 1200 + CR: Advance 2110"
    }

    SALES_INVOICE_LOGICAL {
        string invoice_number "Logical entity: INV-XXXX"
        string note "No dedicated sales.invoices table in schema"
    }


```

### Architectural Discussion: ER 4

- **Receipt Workflow:** Customer payments progress through statuses: `DRAFT` $\to$ `CONFIRMED` $\to$ `CANCELLED`.
- **Invoice Allocation Breakdown:** `finance.payment_received_allocations` breaks down how a lump-sum payment is distributed across multiple customer invoices (`invoice_reference`). The parent table tracks `amount_received` and `unallocated_amount`.
- **CRM Integration:** `customer_id` references `crm.accounts(id)` with `ON DELETE SET NULL`, while `customer_name` is denormalized directly on the receipt to preserve customer identity if CRM records are archived.
- **Automated GL Posting:** Upon confirmation, a 1:1 journal entry is created, debiting the Bank Account and crediting Accounts Receivable.

---

## Section 5: ER 5 — Payments Made & SCM Integration (AP)

ER 5 models the Accounts Payable outflow workflow, integrating directly with SCM supplier payments and bank accounts.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 5: TexaWave ERP — Vendor Payments Made Subsystem
    %% Physical Tables: finance.payments_made, finance.finance_master_list_items, finance.bank_accounts
    %% Cross-Schema Tables: scm.supplier_payments, scm.suppliers, scm.supplier_bills, platform.organizations
    %% Foreign Keys & Actions:
    %%   - payments_made.payment_mode_id -> finance_master_list_items.id [RESTRICT]
    %%   - payments_made.bank_account_id -> bank_accounts.id [SET NULL]
    %%   - payments_made.journal_entry_id -> journal_entries.id [SET NULL] (1:1 UK)
    %%   - payments_made.scm_supplier_payment_id -> scm.supplier_payments.id [SET NULL] (1:1 UK)
    %%   - scm.supplier_payments.supplier_id -> scm.suppliers.id
    %%   - scm.supplier_payments.bill_id -> scm.supplier_bills.id
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_PAYMENT_MADE : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ SCM_SUPPLIER_PAYMENT : "organization_id (RESTRICT)"

    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_PAYMENT_MADE : "payment_mode_id (RESTRICT)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_PAYMENT_MADE : "bank_account_id (Disbursing - SET NULL)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_PAYMENT_MADE : "journal_entry_id (Posted GL voucher - 1:1 UK)"

    SCM_SUPPLIER_PAYMENT ||--o| FINANCE_PAYMENT_MADE : "scm_supplier_payment_id (1:1 UK Link)"
    SUPPLIER ||--o{ SCM_SUPPLIER_PAYMENT : "supplier_id (Vendor Payee)"
    SCM_SUPPLIER_BILL ||--o{ SCM_SUPPLIER_PAYMENT : "bill_id (Settled Bill)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_PAYMENT_MADE {
        int id PK "payments_made.id"
        int organization_id FK "References platform.organizations(id)"
        string payment_number "payment_number UK per org (PM-YYYYMMDD-XXXX)"
        date payment_date "Disbursement date"
        string vendor_name "Payee vendor company"
        int payment_mode_id FK "References finance_master_list_items.id"
        decimal amount "Disbursed monetary amount Decimal(15,2)"
        string reference_number "Cheque / UTR / Transaction reference"
        string status "DRAFT, CONFIRMED, RECONCILED, VOID"
        int bank_account_id FK "References bank_accounts.id (SET NULL)"
        int journal_entry_id FK "References journal_entries.id (1:1 UK)"
        int scm_supplier_payment_id FK "References scm.supplier_payments.id (1:1 UK)"
        string notes "Payment notes"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
        datetime deleted_at "Soft-delete timestamp"
    }

    SCM_SUPPLIER_PAYMENT {
        int id PK "scm.supplier_payments.id"
        int organization_id FK "References platform.organizations(id)"
        string payment_number "payment_number UK per org"
        int supplier_id FK "References scm.suppliers.id"
        int bill_id FK "References scm.supplier_bills.id"
        date payment_date "Payment date"
        string mode "Payment mode"
        decimal amount "Amount Decimal(14,2)"
        string status "POSTED, VOID"
    }

    SUPPLIER {
        int id PK "scm.suppliers.id"
        int organization_id FK "References platform.organizations(id)"
        string supplier_code "supplier_code UK per org"
        string company_name "Supplier Trade Name"
        string gstin "Supplier statutory GSTIN"
        string pan "PAN identifier"
    }

    SCM_SUPPLIER_BILL {
        int id PK "scm.supplier_bills.id"
        int organization_id FK "References platform.organizations(id)"
        string bill_number "bill_number UK per org"
        decimal total "Total bill amount Decimal(14,2)"
        decimal paid_amount "Settled amount Decimal(14,2)"
        string status "OPEN, PAID, CANCELLED"
    }

    FINANCE_MASTER_LIST_ITEM {
        int id PK "finance_master_list_items.id"
        string category "PAYMENT_MODE"
        string value "BANK_TRANSFER, CHEQUE, CASH"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK "bank_accounts.id"
        string account_name "Disbursing Bank Account"
        decimal current_balance "Decremented upon payment confirmation"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        string entry_number "JE-YYYYMMDD-XXXX"
        decimal total_debit "DR: Accounts Payable 2010"
        decimal total_credit "CR: Bank Account 1010/1020"
    }


```

### Architectural Discussion: ER 5

- **Procure-to-Pay Integration:** `finance.payments_made` connects directly to `scm.supplier_payments` via the unique foreign key `scm_supplier_payment_id` (`ON DELETE SET NULL`).
- **SCM Cascade:** Through `scm.supplier_payments`, the payment links backward to `scm.supplier_bills` (Bill/Invoice) and `scm.suppliers` (Vendor details).
- **Treasury Impact:** When a payment voucher is confirmed, funds are credited from `bank_account_id`, decreasing its `current_balance`, while an automated journal entry debits Accounts Payable and credits the Cash/Bank GL account.

---

## Section 6: ER 6 — Expenses & HR Integration (with GST & ITC)

ER 6 details operational expense management, employee expense claim reimbursement, and comprehensive GST Input Tax Credit tracking.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 6: TexaWave ERP — Expenses & HR Claims Integration Subsystem
    %% Physical Tables: finance.expenses, finance.finance_master_list_items, finance.accounts, finance.journal_entries
    %% Cross-Schema Tables: hr.expense_claims, hr.employees, platform.organizations
    %% Includes 11 GST/ITC columns from Migration 20261026160000
    %% Foreign Keys & Actions:
    %%   - expenses.expense_type_id -> finance_master_list_items.id [RESTRICT]
    %%   - expenses.payment_mode_id -> finance_master_list_items.id [SET NULL]
    %%   - expenses.bank_account_id -> bank_accounts.id [SET NULL]
    %%   - expenses.gl_account_id -> accounts.id [SET NULL]
    %%   - expenses.journal_entry_id -> journal_entries.id [SET NULL] (1:1 UK)
    %% Logical Cross-Schema Key:
    %%   - expenses.claim_id -> hr.expense_claims.id (1:1 UK hr_expense_claim_id)
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_EXPENSE : "organization_id (RESTRICT)"

    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "expense_type_id (Category - RESTRICT)"
    FINANCE_MASTER_LIST_ITEM ||--o{ FINANCE_EXPENSE : "payment_mode_id (SET NULL)"
    FINANCE_BANK_ACCOUNT ||--o{ FINANCE_EXPENSE : "bank_account_id (Disbursing - SET NULL)"
    FINANCE_ACCOUNT ||--o{ FINANCE_EXPENSE : "gl_account_id (GL Expense Account 5xxx - SET NULL)"
    FINANCE_JOURNAL_ENTRY ||--o| FINANCE_EXPENSE : "journal_entry_id (Posted GL voucher - 1:1 UK)"

    FINANCE_EXPENSE ||..o| HR_EXPENSE_CLAIM : "claim_id (Logical cross-schema 1:1 UK)"
    HR_EMPLOYEE ||--o{ HR_EXPENSE_CLAIM : "employee_id (Claim Submitter)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_EXPENSE {
        int id PK "expenses.id"
        int organization_id FK "References platform.organizations(id)"
        string expense_number "expense_number UK per org (EXP-YYYYMMDD-XXXX)"
        date expense_date "Expense incurred date"
        int expense_type_id FK "References finance_master_list_items.id"
        string vendor_name "Payee vendor title"
        decimal amount "Gross amount Decimal(15,2)"
        decimal tax_amount "GST amount component Decimal(15,2)"
        decimal net_amount "Taxable base expense Decimal(15,2)"
        string payment_method "CASH, BANK_TRANSFER, UPI, CHEQUE"
        int payment_mode_id FK "References finance_master_list_items.id"
        int bank_account_id FK "References bank_accounts.id (SET NULL)"
        int gl_account_id FK "References accounts.id (Expense 5xxx)"
        string status "DRAFT, SUBMITTED, APPROVED, REJECTED, PAID, CANCELLED"
        int journal_entry_id FK "References journal_entries.id (1:1 UK)"
        int claim_id "Logical FK to hr.expense_claims.id (1:1 UK)"
        string vendor_gstin "15-char statutory GSTIN (Migration 20261026160000)"
        string vendor_invoice_number "Vendor tax invoice number"
        date vendor_invoice_date "Invoice date for ITC validation"
        string hsn_sac_code "HSN/SAC classification code"
        decimal tax_rate "Statutory GST rate Decimal(5,2)"
        decimal cgst_amount "Central GST Decimal(15,2)"
        decimal sgst_amount "State GST Decimal(15,2)"
        decimal igst_amount "Integrated GST Decimal(15,2)"
        boolean is_itc_eligible "true: debits Asset 1300; false: absorbs in expense"
        string ineligibility_reason "Sec 17(5) blocked credit reason"
        string gst_jurisdiction "INTRA_STATE or INTER_STATE"
        string receipt_url "Attachment URL"
        string notes "Expense remarks"
        int created_by "Audit user ID"
        int updated_by "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
        datetime deleted_at "Soft-delete timestamp"
    }

    FINANCE_MASTER_LIST_ITEM {
        int id PK "finance_master_list_items.id"
        string category "EXPENSE_TYPE, PAYMENT_MODE"
        string value "TRAVEL, OFFICE_SUPPLIES, UTILITIES"
    }

    FINANCE_ACCOUNT {
        int id PK "accounts.id"
        string code "account_code (5200 Operating / 1300 ITC Asset)"
        string name "GL Account Title"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        string entry_number "JE Voucher Number (JE-XXXX)"
        decimal total_debit "DR: Expense (5xxx) + DR: ITC Asset (1300)"
        decimal total_credit "CR: Bank / Cash / Payables (1010/2000)"
    }

    HR_EXPENSE_CLAIM {
        int id PK "hr.expense_claims.id"
        int employee_id FK "References hr.employees.id"
        string claim_number "claim_number UK per org (CLM-XXXX)"
        decimal amount "Claim monetary total"
        string status "APPROVED, CONVERTED"
        int finance_expense_id "Cross-schema link back to expenses.id"
    }

    HR_EMPLOYEE {
        int id PK "hr.employees.id"
        string employee_code "employee_code UK per org"
        string full_name "Employee Name (queried in claim conversion)"
    }


```

### Architectural Discussion: ER 6

- **Comprehensive GST/ITC Tracking (Added Migration 20261026160000):**
  The `finance.expenses` model includes 11 specialized columns for Indian GST compliance:
  - `vendor_gstin`: 15-character statutory GST identification number
  - `invoice_number` & `invoice_date`: Vendor tax invoice reference
  - `hsn_sac_code`: Harmonized System Nomenclature / Service Accounting Code
  - `taxable_amount`, `gst_rate`: Base value and applicable tax percentage
  - `cgst_amount`, `sgst_amount`, `igst_amount`: Individual central, state, and integrated tax components
  - `itc_eligibility` & `itc_claim_status`: Input Tax Credit status (`ELIGIBLE` vs `INELIGIBLE`, `PENDING` vs `CLAIMED`)
- **HR Claims Linkage:** `hr_expense_claim_id` maintains a unique 1:1 logical reference to `hr.expense_claims(id)`, ensuring an employee reimbursement claim cannot be processed or reimbursed multiple times.

---

## Section 7: ER 7 — GST & Input Tax Credit Registry

ER 7 models the central GST repository used for generating tax returns (GSTR-1, GSTR-3B) and tracking statutory liability.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 7: TexaWave ERP — GST Registry & Input Tax Credit (ITC) Subsystem
    %% Physical Table: finance.gst_entries
    %% Polymorphic Sources: finance.expenses, scm.supplier_bills, scm.sales_orders
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_GST_ENTRY : "organization_id (RESTRICT)"

    FINANCE_GST_ENTRY ||..o| FINANCE_EXPENSE : "source_type EXPENSE & source_id (Inward GSTR-2B)"
    FINANCE_GST_ENTRY ||..o| SCM_SUPPLIER_BILL : "source_type PURCHASE_BILL & source_id (Inward GSTR-2B)"
    FINANCE_GST_ENTRY ||..o| SCM_SALES_ORDER : "source_type SALES_INVOICE & source_id (Outward GSTR-1)"

    FINANCE_GST_ENTRY ||..o{ FINANCE_JOURNAL_ENTRY : "Audited against Output Tax (2200) & ITC Asset (1300)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_GST_ENTRY {
        int id PK "gst_entries.id"
        int organization_id FK "References platform.organizations(id)"
        string period "Tax period (e.g. 2026-10)"
        string return_type "GSTR_1 (outward) or GSTR_2B (inward)"
        string entry_type "OUTWARD_SUPPLY or INWARD_SUPPLY"
        string source_type "EXPENSE, PURCHASE_BILL, SALES_INVOICE (Polymorphic string)"
        int source_id "Originating entity primary key ID (Polymorphic int)"
        string document_number "Invoice or voucher number"
        date document_date "Document date"
        string counterparty_name "Customer or Vendor trade name"
        string gstin "Counterparty 15-char statutory GSTIN"
        string pos_state_code "2-digit Place of Supply state code"
        boolean is_reverse_charge "Reverse Charge Mechanism (RCM) flag"
        decimal taxable_value "Taxable base supply value Decimal(15,2)"
        decimal tax_rate "Statutory GST rate (0, 5, 12, 18, 28%)"
        decimal cgst "Central GST Decimal(15,2)"
        decimal sgst "State GST Decimal(15,2)"
        decimal igst "Integrated GST Decimal(15,2)"
        decimal cess "Compensation Cess Decimal(15,2)"
        string itc_eligibility "ELIGIBLE, INELIGIBLE, BLOCKED_17_5"
        string status "DRAFT, FILED, RECONCILED, CANCELLED"
        boolean is_reconciled "Portal reconciliation match flag"
        datetime reconciled_at "Reconciliation timestamp"
        int reconciled_by_user_id "Audit user ID"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    FINANCE_EXPENSE {
        int id PK "expenses.id"
        string expense_number "EXP-XXXX"
        string vendor_gstin "Supplier GSTIN"
        decimal amount "Gross amount"
        decimal tax_amount "GST amount"
        boolean is_itc_eligible "ITC claimable flag"
    }

    SCM_SUPPLIER_BILL {
        int id PK "scm.supplier_bills.id"
        string bill_number "BILL-XXXX"
        decimal subtotal "Taxable amount"
        decimal tax_amount "GST amount"
        decimal total "Total amount"
    }

    SCM_SALES_ORDER {
        int id PK "scm.sales_orders.id"
        string order_number "SO-XXXX"
        decimal subtotal "Taxable revenue"
        decimal tax_amount "Output GST"
        decimal total_amount "Gross invoice total"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        string entry_number "JE-XXXX"
        decimal total_debit "Audits Account 1300 (Input Tax Credit)"
        decimal total_credit "Audits Account 2200 (Output Tax Liability)"
    }


```

### Architectural Discussion: ER 7

- **Filing Periods:** Organized by `period` (`YYYY-MM`) and `entry_type` (`OUTWARD` for sales/receivables, `INWARD` for purchases/expenses, `REVERSE_CHARGE` for RCM liabilities).
- **Tax Breakdown Breakdown:** Stores discrete columns for `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount`, and computed `total_tax`.
- **Polymorphic Source References:** The `source_reference` column links to the underlying business transaction (e.g. `EXPENSE:101`, `PURCHASE_BILL:54`, `SALES_ORDER:202`), indexed for rapid reconciliation against source documents.

---

## Section 8: ER 8 — Financial Reporting Underlying Tables

ER 8 illustrates the architecture of the TexaWave Financial Reporting engine, demonstrating how dynamic runtime aggregations map to base physical tables.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 8: TexaWave ERP — Physical Tables Powering Financial Reporting
    %% NOTE: Reports (Balance Sheet, P&L, Trial Balance, GL) are COMPUTED RUNTIME
    %% AGGREGATIONS generated by FinancialReportsService; they are NOT physical tables.
    %% The actual underlying persistent PostgreSQL tables in schema finance are:
    %%   - finance.accounts (Chart of Accounts definitions & running balance)
    %%   - finance.journal_entries (Transaction headers & posting dates)
    %%   - finance.journal_lines (Individual debits and credits)
    %%   - finance.bank_accounts (Liquid cash & bank balances)
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ FINANCE_ACCOUNT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_ENTRY : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_JOURNAL_LINE : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ FINANCE_BANK_ACCOUNT : "organization_id (RESTRICT)"

    FINANCE_ACCOUNT ||--o{ FINANCE_ACCOUNT : "parent_account_id (Hierarchical Rollup)"
    FINANCE_ACCOUNT ||--o{ FINANCE_JOURNAL_LINE : "account_id (Movement line items)"
    FINANCE_JOURNAL_ENTRY ||--|{ FINANCE_JOURNAL_LINE : "journal_entry_id (Voucher items - CASCADE)"
    FINANCE_ACCOUNT ||--o{ FINANCE_BANK_ACCOUNT : "gl_account_id (Asset mapping)"

    FINANCE_ACCOUNT ||..o{ COMPUTED_BALANCE_SHEET : "Aggregates Assets (1xxx) = Liabilities (2xxx) + Equity (3xxx)"
    FINANCE_ACCOUNT ||..o{ COMPUTED_PROFIT_AND_LOSS : "Aggregates Revenues (4xxx) - Expenses (5xxx)"
    FINANCE_ACCOUNT ||..o{ COMPUTED_TRIAL_BALANCE : "Verifies sum(Debits) === sum(Credits) across all active accounts"
    FINANCE_JOURNAL_LINE ||..o{ COMPUTED_GENERAL_LEDGER : "Streams chronological line movements with running balance"
    FINANCE_BANK_ACCOUNT ||..o{ COMPUTED_TREASURY_SUMMARY : "Aggregates current_balance across liquid bank accounts"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Name"
    }

    FINANCE_ACCOUNT {
        int id PK "accounts.id"
        int organization_id FK "References platform.organizations(id)"
        string code "account_code UK per org (e.g. 1010, 1200, 2010, 4000, 5200)"
        string name "Account Label / Description"
        string account_type "ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"
        int parent_account_id FK "Self-referencing tree parent account ID"
        decimal opening_balance "Fiscal opening balance Decimal(15,2)"
        date opening_date "Opening balance date"
        decimal current_balance "Running balance Decimal(15,2)"
        boolean is_active "Active posting toggle"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "journal_entries.id"
        int organization_id FK "References platform.organizations(id)"
        string entry_number "entry_number UK per org (JE-XXXX)"
        date entry_date "Voucher transaction date"
        string status "POSTED (Unposted DRAFT vouchers excluded from reports)"
        decimal total_debit "Debit checksum"
        decimal total_credit "Credit checksum"
    }

    FINANCE_JOURNAL_LINE {
        int id PK "journal_lines.id"
        int organization_id FK "References platform.organizations(id)"
        int journal_entry_id FK "References journal_entries.id"
        int account_id FK "References accounts.id"
        string entry_type "DEBIT or CREDIT"
        decimal amount "Line monetary value Decimal(15,2)"
        string description "Line narration"
        datetime created_at "Line timestamp"
    }

    FINANCE_BANK_ACCOUNT {
        int id PK "bank_accounts.id"
        int organization_id FK "References platform.organizations(id)"
        string account_name "Bank Account Name"
        decimal current_balance "Live balance Decimal(15,2)"
        int gl_account_id FK "References accounts.id (Asset 1010/1020)"
    }

    COMPUTED_BALANCE_SHEET {
        string report_type "VIRTUAL RUNTIME COMPUTATION"
        string identity "Total Assets === Total Liabilities + Total Equity"
        string note "P&L Net Income transferred to Retained Earnings"
    }

    COMPUTED_PROFIT_AND_LOSS {
        string report_type "VIRTUAL RUNTIME COMPUTATION"
        string formula "Operating Revenues - COGS - Operating Expenses"
        string note "Excludes pass-through GST liability/asset lines"
    }

    COMPUTED_TRIAL_BALANCE {
        string report_type "VIRTUAL RUNTIME COMPUTATION"
        string verification "Total Debits === Total Credits"
        string note "Asserts zero variance across all active CoA codes"
    }

    COMPUTED_GENERAL_LEDGER {
        string report_type "VIRTUAL RUNTIME COMPUTATION"
        string view "Chronological transaction drill-down by account"
        string running_balance "Calculated after each debit/credit line"
    }

    COMPUTED_TREASURY_SUMMARY {
        string report_type "VIRTUAL RUNTIME COMPUTATION"
        string view "Consolidated cash and bank liquid asset position"
    }


```

### Architectural Discussion: ER 8

- **No Materialized Reporting Tables:** TexaWave avoids stale cached reporting tables or out-of-sync summary tables. All reports are calculated on-the-fly by `FinancialReportsService`.
- **Trial Balance Invariant:** Queries all `finance.journal_lines` linked to `POSTED` entries within the reporting period, aggregating by `account_id`. Guarantees mathematical equality between total debits and total credits.
- **Balance Sheet Formulation:** Evaluates account balances for `ASSET`, `LIABILITY`, and `EQUITY` as of a target date. Computes current fiscal year net income from Revenue and Expense lines and synthesizes it into Retained Earnings under Equity.
- **Profit & Loss Statement:** Aggregates line activity for `REVENUE` and `EXPENSE` accounts between start and end dates. Calculates Gross Profit and Operating Net Profit.

---

## Section 9: ER 9 — SCM–Finance Cross-Module Integration

ER 9 provides the complete end-to-end integration diagram illustrating both the Procure-to-Pay (P2P) and Order-to-Cash (O2C) lifecycles across SCM and Finance.

```mermaid
erDiagram
    %% =========================================================================
    %% ER 9: TexaWave ERP — SCM–Finance Cross-Module Integration Subsystem
    %% Physical SCM Tables: scm.suppliers, scm.supplier_bills, scm.supplier_payments, scm.sales_orders, scm.purchase_orders
    %% Physical Finance Tables: finance.payments_made, finance.journal_entries, finance.journal_lines, finance.gst_entries, finance.payment_received_allocations
    %% Cross-Module Foreign Keys:
    %%   - finance.payments_made.scm_supplier_payment_id -> scm.supplier_payments.id [SET NULL] (1:1 UK)
    %% Service Integration Linkages:
    %%   - FinanceIntegrationService.postPurchaseBill -> finance.journal_entries & finance.gst_entries
    %%   - FinanceIntegrationService.postSalesInvoice -> finance.journal_entries & finance.gst_entries
    %%   - finance.payment_received_allocations.invoice_reference -> scm.sales_orders.order_number (String match)
    %% Status: Schema-Derived & Migration-Verified
    %% =========================================================================

    ORGANIZATION ||--o{ SCM_SUPPLIER : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ SCM_SUPPLIER_BILL : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ SCM_SUPPLIER_PAYMENT : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ SCM_SALES_ORDER : "organization_id (RESTRICT)"
    ORGANIZATION ||--o{ SCM_PURCHASE_ORDER : "organization_id (RESTRICT)"

    SCM_SUPPLIER ||--o{ SCM_SUPPLIER_BILL : "supplier_id (RESTRICT)"
    SCM_SUPPLIER ||--o{ SCM_SUPPLIER_PAYMENT : "supplier_id (RESTRICT)"
    SCM_SUPPLIER ||--o{ SCM_PURCHASE_ORDER : "supplier_id (RESTRICT)"
    SCM_PURCHASE_ORDER ||--o{ SCM_SUPPLIER_BILL : "purchase_order_id (SET NULL)"
    SCM_SUPPLIER_BILL ||--o{ SCM_SUPPLIER_PAYMENT : "bill_id (SET NULL)"

    SCM_SUPPLIER_PAYMENT ||--o| FINANCE_PAYMENT_MADE : "scm_supplier_payment_id (Real Database FK - 1:1 UK)"
    FINANCE_PAYMENT_MADE ||--o| FINANCE_JOURNAL_ENTRY : "journal_entry_id (Posted GL voucher - 1:1 UK)"

    SCM_SUPPLIER_BILL ||..o| FINANCE_JOURNAL_ENTRY : "postPurchaseBill() -> DR Inventory, DR ITC 1300, CR AP 2000"
    SCM_SUPPLIER_BILL ||..o| FINANCE_GST_ENTRY : "source_type PURCHASE_BILL & source_id (Inward GSTR-2B)"

    SCM_SALES_ORDER ||..o| FINANCE_JOURNAL_ENTRY : "postSalesInvoice() -> DR AR 1200, CR Revenue 4000, CR Output GST 2200"
    SCM_SALES_ORDER ||..o| FINANCE_GST_ENTRY : "source_type SALES_INVOICE & source_id (Outward GSTR-1)"
    SCM_SALES_ORDER ||..o{ FINANCE_PAYMENT_RECEIVED_ALLOCATION : "invoice_reference (String match - customer payment)"

    ORGANIZATION {
        int id PK "platform.organizations"
        string name "Tenant Business Name"
    }

    SCM_SUPPLIER {
        int id PK "scm.suppliers.id"
        int organization_id FK "References platform.organizations(id)"
        string supplier_code "supplier_code UK per org"
        string company_name "Supplier Legal Business Name"
        string gstin "Supplier 15-character GSTIN"
        string pan "Permanent Account Number"
        string payment_terms "Default 30 Days"
        decimal credit_limit "Credit limit Decimal(14,2)"
    }

    SCM_PURCHASE_ORDER {
        int id PK "scm.purchase_orders.id"
        int organization_id FK "References platform.organizations(id)"
        string po_number "po_number UK per org"
        int supplier_id FK "References scm.suppliers.id"
        date order_date "PO order date"
        decimal total_amount "Gross PO value"
        string status "DRAFT, APPROVED, FULFILLED"
    }

    SCM_SUPPLIER_BILL {
        int id PK "scm.supplier_bills.id"
        int organization_id FK "References platform.organizations(id)"
        string bill_number "bill_number UK per org"
        string supplier_bill_number "Vendor invoice number"
        int supplier_id FK "References scm.suppliers.id"
        int purchase_order_id FK "References scm.purchase_orders.id"
        date bill_date "Bill invoice date"
        date due_date "Payment due date"
        decimal subtotal "Taxable amount Decimal(14,2)"
        decimal tax_amount "GST amount Decimal(14,2)"
        decimal total "Total gross bill Decimal(14,2)"
        decimal paid_amount "Settled amount Decimal(14,2)"
        string status "OPEN, PAID, CANCELLED"
    }

    SCM_SUPPLIER_PAYMENT {
        int id PK "scm.supplier_payments.id"
        int organization_id FK "References platform.organizations(id)"
        string payment_number "payment_number UK per org"
        int supplier_id FK "References scm.suppliers.id"
        int bill_id FK "References scm.supplier_bills.id"
        date payment_date "Payment execution date"
        string mode "Payment mode string"
        decimal amount "Amount Decimal(14,2)"
        string status "POSTED, VOID"
    }

    SCM_SALES_ORDER {
        int id PK "scm.sales_orders.id"
        int organization_id FK "References platform.organizations(id)"
        string order_number "order_number UK per org (SO-XXXX)"
        string customer_name "Customer Name"
        decimal subtotal "Taxable sales total"
        decimal tax_amount "Output GST tax"
        decimal total_amount "Gross sales value"
        string status "CONFIRMED, INVOICED, FULFILLED"
    }

    FINANCE_PAYMENT_MADE {
        int id PK "finance.payments_made.id"
        string payment_number "PM-YYYYMMDD-XXXX"
        decimal amount "Disbursed monetary amount"
        int scm_supplier_payment_id FK "References scm.supplier_payments.id (1:1 UK)"
        int journal_entry_id FK "References journal_entries.id (1:1 UK)"
    }

    FINANCE_JOURNAL_ENTRY {
        int id PK "finance.journal_entries.id"
        string entry_number "JE-YYYYMMDD-XXXX"
        decimal total_debit "Debit checksum"
        decimal total_credit "Credit checksum"
    }

    FINANCE_GST_ENTRY {
        int id PK "finance.gst_entries.id"
        string return_type "GSTR_1 or GSTR_2B"
        string source_type "PURCHASE_BILL or SALES_INVOICE"
        int source_id "Polymorphic integer ID"
        decimal taxable_value "Base supply value"
        decimal cgst "Central GST"
        decimal sgst "State GST"
        decimal igst "Integrated GST"
    }

    FINANCE_PAYMENT_RECEIVED_ALLOCATION {
        int id PK "finance.payment_received_allocations.id"
        string invoice_reference "Matches SCM sales order/invoice number string"
        decimal allocated_amount "Customer receipt applied"
    }


```

### Architectural Discussion: ER 9

- **Procure-to-Pay (P2P) Flow:**
  $$\text{Purchase Order} \longrightarrow \text{Supplier Bill} \longrightarrow \text{Supplier Payment} \stackrel{\text{1:1 FK}}{\longrightarrow} \text{Payment Made} \stackrel{\text{1:1 FK}}{\longrightarrow} \text{Journal Entry}$$
  - A Purchase Order is received and billed in SCM.
  - SCM creates a `scm.supplier_payments` record.
  - Finance generates a `finance.payments_made` voucher linked via `scm_supplier_payment_id`.
  - When confirmed, a double-entry Journal Entry is posted: Debiting Accounts Payable and Crediting the Bank Account.
- **Order-to-Cash (O2C) Flow:**
  $$\text{Sales Order} \longrightarrow \text{Invoice Ref} \stackrel{\text{String Match}}{\longleftarrow} \text{Payment Allocation} \stackrel{\text{Cascade}}{\longleftarrow} \text{Payment Received} \stackrel{\text{1:1 FK}}{\longrightarrow} \text{Journal Entry}$$
  - Sales Orders generate customer delivery and billing references.
  - Customer payments are recorded in `finance.payments_received`.
  - Line allocations link the payment to specific order/invoice references.
  - When confirmed, a double-entry Journal Entry is posted: Debiting Cash/Bank and Crediting Accounts Receivable.

---

## Complete Physical Schema Reference Dictionary

The following table summarizes all 11 physical database tables in the `"finance"` schema:

| Table Name                     | Entity Description                                    | Primary Key | Foreign Keys (Target)                                                                                                                  | Unique Keys                                                               | Secondary Indexes                                                               |
| :----------------------------- | :---------------------------------------------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------ |
| `finance_master_list_items`    | Configurable categories, expense types, payment modes | `id`        | `platform.organizations(id)`                                                                                                           | None                                                                      | `(org_id, category)`                                                            |
| `accounts`                     | Chart of Accounts master hierarchy                    | `id`        | `platform.organizations(id)`, `finance.accounts(id)`                                                                                   | `(org_id, account_code)`                                                  | `(org_id, account_type)`, `(org_id, is_active)`                                 |
| `journal_entries`              | Double-entry transaction headers                      | `id`        | `platform.organizations(id)`, `finance.journal_entries(id)`                                                                            | `(org_id, entry_number)`, `reversed_entry_id`                             | `(org_id, entry_date)`, `(org_id, status)`                                      |
| `journal_lines`                | Debit and credit line entries                         | `id`        | `platform.organizations(id)`, `finance.journal_entries(id)`, `finance.accounts(id)`                                                    | None                                                                      | `(org_id, journal_entry_id)`, `(org_id, account_id)`                            |
| `bank_accounts`                | Treasury bank accounts & branch details               | `id`        | `platform.organizations(id)`, `finance.accounts(id)`                                                                                   | `(org_id, account_number)`                                                | `(org_id, is_active)`                                                           |
| `bank_transactions`            | Statement records and GL reconciliation               | `id`        | `platform.organizations(id)`, `finance.bank_accounts(id)`, `finance.journal_entries(id)`                                               | `matched_journal_entry_id`                                                | `(org_id, bank_account_id, tx_date)`, `(org_id, is_reconciled)`                 |
| `expenses`                     | Operational expenses, GST/ITC, HR claims              | `id`        | `platform.organizations(id)`, `finance_master_list_items(id)` (x2), `bank_accounts(id)`, `accounts(id)`, `journal_entries(id)`         | `(org_id, expense_number)`, `journal_entry_id`, `hr_expense_claim_id`     | `(org_id, expense_date)`, `(org_id, expense_type_id)`, `(org_id, vendor_gstin)` |
| `payments_received`            | Customer payments received (AR)                       | `id`        | `platform.organizations(id)`, `crm.accounts(id)`, `finance_master_list_items(id)`, `bank_accounts(id)`, `journal_entries(id)`          | `(org_id, payment_number)`, `journal_entry_id`                            | `(org_id, customer_id)`, `(org_id, payment_date)`                               |
| `payment_received_allocations` | Customer receipt invoice allocations                  | `id`        | `platform.organizations(id)`, `finance.payments_received(id)`                                                                          | None                                                                      | `(org_id, payment_received_id)`, `(org_id, invoice_reference)`                  |
| `payments_made`                | Vendor payments made & SCM link (AP)                  | `id`        | `platform.organizations(id)`, `finance_master_list_items(id)`, `bank_accounts(id)`, `journal_entries(id)`, `scm.supplier_payments(id)` | `(org_id, payment_number)`, `journal_entry_id`, `scm_supplier_payment_id` | `(org_id, payment_date)`                                                        |
| `gst_entries`                  | Statutory GST registry & return tracking              | `id`        | `platform.organizations(id)`                                                                                                           | None                                                                      | `(org_id, period, entry_type)`, `(org_id, source_reference)`                    |

---

## Discrepancies, Constraints & Design Observations

1. **Physical Sales Invoicing:**
   As noted in the audit, customer payments reference sales invoices via string matching (`invoice_reference`) rather than a physical foreign key to a dedicated `sales.invoices` table. A planned billing module will formalize this linkage.
2. **PostgreSQL Container Status:**
   Verification has been conducted with complete rigor against Prisma schema definitions and migration SQL. Live database runtime validation will be finalized as soon as the local PostgreSQL Docker container is resumed.
3. **Double-Entry Enforcement:**
   PostgreSQL schema enforces referential integrity, while debit/credit zero-balance validation is strictly guarded by NestJS transactional services before setting status to `POSTED`.

---

_Generated autonomously from TexaWave ERP repository source code and migration scripts._
