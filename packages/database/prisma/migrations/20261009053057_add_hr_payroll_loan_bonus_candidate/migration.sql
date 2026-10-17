-- AlterTable
ALTER TABLE "hr"."interviews" ADD COLUMN     "candidate_id" INTEGER;

-- AlterTable
ALTER TABLE "hr"."offer_letters" ADD COLUMN     "candidate_id" INTEGER;

-- CreateTable
CREATE TABLE "hr"."candidates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role_applied" TEXT NOT NULL,
    "source" TEXT,
    "resume_url" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."loans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "approved_amount" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "emi_months" INTEGER,
    "emi_amount" DECIMAL(14,2),
    "remaining_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "disbursed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "override_requested_amount" DECIMAL(14,2),
    "override_status" TEXT,
    "override_decided_by" INTEGER,
    "override_decided_at" TIMESTAMPTZ(6),
    "override_reason" TEXT,
    "employee_gross_at_request" DECIMAL(14,2),
    "standard_max_at_request" DECIMAL(14,2),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."loan_emi_payments" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "payroll_credited" BOOLEAN NOT NULL DEFAULT false,
    "remaining_balance_after" DECIMAL(14,2) NOT NULL,
    "deducted_from" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_emi_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."loan_skip_emi_requests" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "reason" TEXT,

    CONSTRAINT "loan_skip_emi_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."bonuses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bonus_type" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payroll_periods" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "finalized_by" INTEGER,
    "finalized_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payslips" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "monthly_salary" DECIMAL(14,2) NOT NULL,
    "present_days" DECIMAL(14,2) NOT NULL,
    "half_days" DECIMAL(14,2) NOT NULL,
    "leave_days" DECIMAL(14,2) NOT NULL,
    "payable_days" DECIMAL(14,2) NOT NULL,
    "per_day_rate" DECIMAL(14,2) NOT NULL,
    "pd_pay" DECIMAL(14,2) NOT NULL,
    "hd_pay" DECIMAL(14,2) NOT NULL,
    "holiday_pay" DECIMAL(14,2) NOT NULL,
    "loan_deduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "basic" DECIMAL(14,2) NOT NULL,
    "hra" DECIMAL(14,2) NOT NULL,
    "conveyance" DECIMAL(14,2) NOT NULL,
    "other_allowance" DECIMAL(14,2) NOT NULL,
    "special_allowance" DECIMAL(14,2) NOT NULL,
    "arrears_salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "esi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "total_earnings" DECIMAL(14,2) NOT NULL,
    "net_payable" DECIMAL(14,2) NOT NULL,
    "credit_status" TEXT NOT NULL DEFAULT 'PENDING',
    "credited_at" TIMESTAMPTZ(6),
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "generated_by" INTEGER NOT NULL,
    "regenerated_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payroll_audit_logs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" INTEGER NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "details" JSONB,

    CONSTRAINT "payroll_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidates_organization_id_stage_idx" ON "hr"."candidates"("organization_id", "stage");

-- CreateIndex
CREATE INDEX "loans_organization_id_status_idx" ON "hr"."loans"("organization_id", "status");

-- CreateIndex
CREATE INDEX "loan_emi_payments_loan_id_month_idx" ON "hr"."loan_emi_payments"("loan_id", "month");

-- CreateIndex
CREATE INDEX "loan_skip_emi_requests_loan_id_month_idx" ON "hr"."loan_skip_emi_requests"("loan_id", "month");

-- CreateIndex
CREATE INDEX "bonuses_organization_id_status_idx" ON "hr"."bonuses"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bonuses_organization_id_month_idx" ON "hr"."bonuses"("organization_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_organization_id_period_key" ON "hr"."payroll_periods"("organization_id", "period");

-- CreateIndex
CREATE INDEX "payslips_period_id_credit_status_idx" ON "hr"."payslips"("period_id", "credit_status");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_period_id_employee_id_key" ON "hr"."payslips"("period_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_audit_logs_organization_id_period_idx" ON "hr"."payroll_audit_logs"("organization_id", "period");

-- AddForeignKey
ALTER TABLE "hr"."interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "hr"."candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."offer_letters" ADD CONSTRAINT "offer_letters_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "hr"."candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."candidates" ADD CONSTRAINT "candidates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loans" ADD CONSTRAINT "loans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loans" ADD CONSTRAINT "loans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_emi_payments" ADD CONSTRAINT "loan_emi_payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "hr"."loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_skip_emi_requests" ADD CONSTRAINT "loan_skip_emi_requests_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "hr"."loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."bonuses" ADD CONSTRAINT "bonuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."bonuses" ADD CONSTRAINT "bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payroll_periods" ADD CONSTRAINT "payroll_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payslips" ADD CONSTRAINT "payslips_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

