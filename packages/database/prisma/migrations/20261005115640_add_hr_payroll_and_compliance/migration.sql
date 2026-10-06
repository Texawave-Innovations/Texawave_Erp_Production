-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalized_at" TIMESTAMPTZ(6),
    "finalized_by_id" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "run_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_by_id" INTEGER,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_run_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "total_calendar_days" INTEGER NOT NULL,
    "required_working_days" INTEGER NOT NULL,
    "present_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "half_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "holiday_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "leave_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lop_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "payable_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthly_gross" DECIMAL(12,2) NOT NULL,
    "per_day_rate" DECIMAL(12,2) NOT NULL,
    "earning_ratio" DECIMAL(7,4) NOT NULL,
    "base_earnings" DECIMAL(12,2) NOT NULL,
    "total_gross_earnings" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_payable" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_earnings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "earning_ratio" DECIMAL(7,4) NOT NULL DEFAULT 1.0000,
    "calculated_amount" DECIMAL(12,2) NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_deductions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source_type" TEXT,
    "source_id" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salaries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "gross_monthly" DECIMAL(12,2) NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL,
    "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "special_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "arrears_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_pf_profiles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "pf_applicable" BOOLEAN NOT NULL DEFAULT true,
    "uan" TEXT,
    "pf_number" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_pf_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_contributions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "pf_included" BOOLEAN NOT NULL DEFAULT true,
    "pf_wage" DECIMAL(12,2) NOT NULL,
    "employee_contribution" DECIMAL(12,2) NOT NULL,
    "employer_contribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "salary_credited" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pf_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_esi_profiles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "esi_applicable" BOOLEAN NOT NULL DEFAULT true,
    "insurance_number" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_esi_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esi_contributions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "esi_included" BOOLEAN NOT NULL DEFAULT true,
    "esi_wage" DECIMAL(12,2) NOT NULL,
    "employee_contribution" DECIMAL(12,2) NOT NULL,
    "employer_contribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "salary_credited" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "esi_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "loan_number" TEXT NOT NULL,
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "emi_amount" DECIMAL(12,2) NOT NULL,
    "emi_months" INTEGER NOT NULL,
    "disbursed_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER,
    "installment_no" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_skip_requests" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" INTEGER NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loan_skip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bonuses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER,
    "bonus_type" TEXT NOT NULL,
    "calculation_base" TEXT,
    "tenure_months" INTEGER,
    "attendance_days" DECIMAL(5,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "payslip_number" TEXT NOT NULL,
    "net_payable" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_path" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payroll_period_id" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "total_employees" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "file_name" TEXT,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payment_batch_id" INTEGER NOT NULL,
    "payroll_entry_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bank_reference" TEXT,
    "credited_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bank_details" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "pan_number" TEXT,
    "aadhaar_number" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_periods_organization_id_status_idx" ON "payroll_periods"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_organization_id_year_month_key" ON "payroll_periods"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_payroll_period_id_idx" ON "payroll_runs"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_status_idx" ON "payroll_runs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_payroll_period_id_run_number_key" ON "payroll_runs"("payroll_period_id", "run_number");

-- CreateIndex
CREATE INDEX "payroll_entries_organization_id_payroll_run_id_idx" ON "payroll_entries"("organization_id", "payroll_run_id");

-- CreateIndex
CREATE INDEX "payroll_entries_organization_id_employee_id_idx" ON "payroll_entries"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_entries_organization_id_status_idx" ON "payroll_entries"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_payroll_run_id_employee_id_key" ON "payroll_entries"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_earnings_organization_id_payroll_entry_id_idx" ON "payroll_earnings"("organization_id", "payroll_entry_id");

-- CreateIndex
CREATE INDEX "payroll_earnings_payroll_entry_id_code_idx" ON "payroll_earnings"("payroll_entry_id", "code");

-- CreateIndex
CREATE INDEX "payroll_deductions_organization_id_payroll_entry_id_idx" ON "payroll_deductions"("organization_id", "payroll_entry_id");

-- CreateIndex
CREATE INDEX "payroll_deductions_payroll_entry_id_code_idx" ON "payroll_deductions"("payroll_entry_id", "code");

-- CreateIndex
CREATE INDEX "employee_salaries_organization_id_employee_id_effective_fro_idx" ON "employee_salaries"("organization_id", "employee_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "employee_pf_profiles_employee_id_key" ON "employee_pf_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "employee_pf_profiles_organization_id_employee_id_idx" ON "employee_pf_profiles"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "pf_contributions_organization_id_payroll_period_id_idx" ON "pf_contributions"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "pf_contributions_organization_id_employee_id_idx" ON "pf_contributions"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "pf_contributions_payroll_period_id_employee_id_key" ON "pf_contributions"("payroll_period_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_esi_profiles_employee_id_key" ON "employee_esi_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "employee_esi_profiles_organization_id_employee_id_idx" ON "employee_esi_profiles"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "esi_contributions_organization_id_payroll_period_id_idx" ON "esi_contributions"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "esi_contributions_organization_id_employee_id_idx" ON "esi_contributions"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "esi_contributions_payroll_period_id_employee_id_key" ON "esi_contributions"("payroll_period_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_loans_organization_id_employee_id_idx" ON "employee_loans"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_loans_organization_id_status_idx" ON "employee_loans"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_loans_organization_id_loan_number_key" ON "employee_loans"("organization_id", "loan_number");

-- CreateIndex
CREATE INDEX "loan_repayments_organization_id_loan_id_idx" ON "loan_repayments"("organization_id", "loan_id");

-- CreateIndex
CREATE INDEX "loan_repayments_loan_id_status_idx" ON "loan_repayments"("loan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_loan_id_installment_no_key" ON "loan_repayments"("loan_id", "installment_no");

-- CreateIndex
CREATE INDEX "loan_skip_requests_organization_id_loan_id_idx" ON "loan_skip_requests"("organization_id", "loan_id");

-- CreateIndex
CREATE INDEX "loan_skip_requests_organization_id_status_idx" ON "loan_skip_requests"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_skip_requests_loan_id_payroll_period_id_key" ON "loan_skip_requests"("loan_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "employee_bonuses_organization_id_employee_id_idx" ON "employee_bonuses"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_bonuses_organization_id_payroll_period_id_idx" ON "employee_bonuses"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "employee_bonuses_organization_id_status_idx" ON "employee_bonuses"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_entry_id_key" ON "payslips"("payroll_entry_id");

-- CreateIndex
CREATE INDEX "payslips_organization_id_employee_id_idx" ON "payslips"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "payslips_organization_id_payroll_period_id_idx" ON "payslips"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_organization_id_payslip_number_key" ON "payslips"("organization_id", "payslip_number");

-- CreateIndex
CREATE INDEX "payment_batches_organization_id_payroll_period_id_idx" ON "payment_batches"("organization_id", "payroll_period_id");

-- CreateIndex
CREATE INDEX "payment_batches_organization_id_status_idx" ON "payment_batches"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_organization_id_batch_number_key" ON "payment_batches"("organization_id", "batch_number");

-- CreateIndex
CREATE INDEX "payroll_payments_organization_id_employee_id_idx" ON "payroll_payments"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_payments_organization_id_status_idx" ON "payroll_payments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payments_payment_batch_id_payroll_entry_id_key" ON "payroll_payments"("payment_batch_id", "payroll_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_bank_details_employee_id_key" ON "employee_bank_details"("employee_id");

-- CreateIndex
CREATE INDEX "employee_bank_details_organization_id_employee_id_idx" ON "employee_bank_details"("organization_id", "employee_id");

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pf_profiles" ADD CONSTRAINT "employee_pf_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pf_profiles" ADD CONSTRAINT "employee_pf_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_contributions" ADD CONSTRAINT "pf_contributions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_contributions" ADD CONSTRAINT "pf_contributions_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_contributions" ADD CONSTRAINT "pf_contributions_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_contributions" ADD CONSTRAINT "pf_contributions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_esi_profiles" ADD CONSTRAINT "employee_esi_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_esi_profiles" ADD CONSTRAINT "employee_esi_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esi_contributions" ADD CONSTRAINT "esi_contributions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esi_contributions" ADD CONSTRAINT "esi_contributions_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esi_contributions" ADD CONSTRAINT "esi_contributions_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esi_contributions" ADD CONSTRAINT "esi_contributions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "employee_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_skip_requests" ADD CONSTRAINT "loan_skip_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_skip_requests" ADD CONSTRAINT "loan_skip_requests_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "employee_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_skip_requests" ADD CONSTRAINT "loan_skip_requests_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_skip_requests" ADD CONSTRAINT "loan_skip_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_skip_requests" ADD CONSTRAINT "loan_skip_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
