-- CreateTable
CREATE TABLE "finance"."accounts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "parent_account_id" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."journal_entries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "entry_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "narration" TEXT NOT NULL,
    "reference_number" TEXT,
    "total_debit" DECIMAL(15,2) NOT NULL,
    "total_credit" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMPTZ(6),
    "posted_by" INTEGER,
    "reversed_entry_id" INTEGER,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."journal_lines" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "journal_entry_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "line_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."bank_accounts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "branch_name" TEXT,
    "account_type" TEXT NOT NULL DEFAULT 'CURRENT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gl_account_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."bank_transactions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "transaction_date" DATE NOT NULL,
    "reference_number" TEXT,
    "description" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "balance_after" DECIMAL(15,2),
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMPTZ(6),
    "matched_journal_entry_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."expenses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "expense_number" TEXT NOT NULL,
    "expense_type_id" INTEGER NOT NULL,
    "expense_date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "payment_mode_id" INTEGER,
    "bank_account_id" INTEGER,
    "vendor_name" TEXT,
    "notes" TEXT,
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "gl_account_id" INTEGER,
    "journal_entry_id" INTEGER,
    "hr_expense_claim_id" INTEGER,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payments_received" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payment_number" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "customer_id" INTEGER,
    "customer_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "allocated_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "unallocated_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "payment_mode_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER,
    "reference_number" TEXT,
    "invoice_reference" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "journal_entry_id" INTEGER,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_received_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payment_received_allocations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payment_received_id" INTEGER NOT NULL,
    "invoice_reference" TEXT NOT NULL,
    "allocated_amount" DECIMAL(15,2) NOT NULL,
    "allocation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_received_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payments_made" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payment_number" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_mode_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER,
    "reference_number" TEXT,
    "bill_reference" TEXT,
    "scm_supplier_payment_id" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "journal_entry_id" INTEGER,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_made_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."gst_entries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "gstin" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER,
    "source_reference" TEXT NOT NULL,
    "hsn_sac_code" TEXT,
    "taxable_amount" DECIMAL(15,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_tax_amount" DECIMAL(15,2) NOT NULL,
    "is_proforma_excluded" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gst_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_organization_id_account_type_idx" ON "finance"."accounts"("organization_id", "account_type");
CREATE INDEX "accounts_organization_id_is_active_idx" ON "finance"."accounts"("organization_id", "is_active");
CREATE UNIQUE INDEX "accounts_organization_id_account_code_key" ON "finance"."accounts"("organization_id", "account_code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversed_entry_id_key" ON "finance"."journal_entries"("reversed_entry_id");
CREATE INDEX "journal_entries_organization_id_entry_date_idx" ON "finance"."journal_entries"("organization_id", "entry_date");
CREATE INDEX "journal_entries_organization_id_status_idx" ON "finance"."journal_entries"("organization_id", "status");
CREATE UNIQUE INDEX "journal_entries_organization_id_entry_number_key" ON "finance"."journal_entries"("organization_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_lines_organization_id_journal_entry_id_idx" ON "finance"."journal_lines"("organization_id", "journal_entry_id");
CREATE INDEX "journal_lines_organization_id_account_id_idx" ON "finance"."journal_lines"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "bank_accounts_organization_id_is_active_idx" ON "finance"."bank_accounts"("organization_id", "is_active");
CREATE UNIQUE INDEX "bank_accounts_organization_id_account_number_key" ON "finance"."bank_accounts"("organization_id", "account_number");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_matched_journal_entry_id_key" ON "finance"."bank_transactions"("matched_journal_entry_id");
CREATE INDEX "bank_transactions_organization_id_bank_account_id_transacti_idx" ON "finance"."bank_transactions"("organization_id", "bank_account_id", "transaction_date");
CREATE INDEX "bank_transactions_organization_id_is_reconciled_idx" ON "finance"."bank_transactions"("organization_id", "is_reconciled");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_journal_entry_id_key" ON "finance"."expenses"("journal_entry_id");
CREATE UNIQUE INDEX "expenses_hr_expense_claim_id_key" ON "finance"."expenses"("hr_expense_claim_id");
CREATE INDEX "expenses_organization_id_expense_date_idx" ON "finance"."expenses"("organization_id", "expense_date");
CREATE INDEX "expenses_organization_id_expense_type_id_idx" ON "finance"."expenses"("organization_id", "expense_type_id");
CREATE UNIQUE INDEX "expenses_organization_id_expense_number_key" ON "finance"."expenses"("organization_id", "expense_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_received_journal_entry_id_key" ON "finance"."payments_received"("journal_entry_id");
CREATE INDEX "payments_received_organization_id_customer_id_idx" ON "finance"."payments_received"("organization_id", "customer_id");
CREATE INDEX "payments_received_organization_id_payment_date_idx" ON "finance"."payments_received"("organization_id", "payment_date");
CREATE UNIQUE INDEX "payments_received_organization_id_payment_number_key" ON "finance"."payments_received"("organization_id", "payment_number");

-- CreateIndex
CREATE INDEX "payment_received_allocations_organization_id_payment_receiv_idx" ON "finance"."payment_received_allocations"("organization_id", "payment_received_id");
CREATE INDEX "payment_received_allocations_organization_id_invoice_refere_idx" ON "finance"."payment_received_allocations"("organization_id", "invoice_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_made_scm_supplier_payment_id_key" ON "finance"."payments_made"("scm_supplier_payment_id");
CREATE UNIQUE INDEX "payments_made_journal_entry_id_key" ON "finance"."payments_made"("journal_entry_id");
CREATE INDEX "payments_made_organization_id_payment_date_idx" ON "finance"."payments_made"("organization_id", "payment_date");
CREATE UNIQUE INDEX "payments_made_organization_id_payment_number_key" ON "finance"."payments_made"("organization_id", "payment_number");

-- CreateIndex
CREATE INDEX "gst_entries_organization_id_period_entry_type_idx" ON "finance"."gst_entries"("organization_id", "period", "entry_type");
CREATE INDEX "gst_entries_organization_id_source_reference_idx" ON "finance"."gst_entries"("organization_id", "source_reference");

-- AddForeignKey
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "finance"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_reversed_entry_id_fkey" FOREIGN KEY ("reversed_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "finance"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "finance"."bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."bank_transactions" ADD CONSTRAINT "bank_transactions_matched_journal_entry_id_fkey" FOREIGN KEY ("matched_journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_expense_type_id_fkey" FOREIGN KEY ("expense_type_id") REFERENCES "finance"."finance_master_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_payment_mode_id_fkey" FOREIGN KEY ("payment_mode_id") REFERENCES "finance"."finance_master_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "finance"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "finance"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."expenses" ADD CONSTRAINT "expenses_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments_received" ADD CONSTRAINT "payments_received_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_received" ADD CONSTRAINT "payments_received_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_received" ADD CONSTRAINT "payments_received_payment_mode_id_fkey" FOREIGN KEY ("payment_mode_id") REFERENCES "finance"."finance_master_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_received" ADD CONSTRAINT "payments_received_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "finance"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_received" ADD CONSTRAINT "payments_received_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payment_received_allocations" ADD CONSTRAINT "payment_received_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payment_received_allocations" ADD CONSTRAINT "payment_received_allocations_payment_received_id_fkey" FOREIGN KEY ("payment_received_id") REFERENCES "finance"."payments_received"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_payment_mode_id_fkey" FOREIGN KEY ("payment_mode_id") REFERENCES "finance"."finance_master_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "finance"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."payments_made" ADD CONSTRAINT "payments_made_scm_supplier_payment_id_fkey" FOREIGN KEY ("scm_supplier_payment_id") REFERENCES "scm"."supplier_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."gst_entries" ADD CONSTRAINT "gst_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints for Financial Integrity
ALTER TABLE "finance"."journal_entries"
    ADD CONSTRAINT "chk_journal_entry_balance" CHECK ("total_debit" = "total_credit"),
    ADD CONSTRAINT "chk_journal_entry_positive" CHECK ("total_debit" > 0);

ALTER TABLE "finance"."journal_lines"
    ADD CONSTRAINT "chk_journal_line_debit_or_credit" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));

ALTER TABLE "finance"."payments_received"
    ADD CONSTRAINT "chk_payment_received_amounts" CHECK ("amount" > 0 AND "allocated_amount" >= 0 AND "unallocated_amount" >= 0);

ALTER TABLE "finance"."payment_received_allocations"
    ADD CONSTRAINT "chk_payment_allocation_amount" CHECK ("allocated_amount" > 0);

