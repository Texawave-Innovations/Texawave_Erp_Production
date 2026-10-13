-- Payroll statutory engine: salary component master + templates, pay-days /
-- attendance / overtime policy, PF EPS-EDLI split, Professional Tax, TDS
-- (regimes, slabs, declarations), loan approval + prepayments, period reopen,
-- frozen payslips. Generated changes first, then rules Prisma cannot express,
-- then data (component master + lines for every existing structure).

-- AlterTable
ALTER TABLE "hr"."payroll_settings" ADD COLUMN     "bonus_calculation_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 7000,
ADD COLUMN     "bonus_eligibility_limit" DECIMAL(12,2) NOT NULL DEFAULT 21000,
ADD COLUMN     "bonus_percent" DECIMAL(5,2) NOT NULL DEFAULT 8.33,
ADD COLUMN     "company_address" TEXT,
ADD COLUMN     "company_gstin" TEXT,
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "company_pan" TEXT,
ADD COLUMN     "company_tan" TEXT,
ADD COLUMN     "default_tax_regime" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "edli_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
ADD COLUMN     "edli_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 15000,
ADD COLUMN     "eps_age_limit" INTEGER NOT NULL DEFAULT 58,
ADD COLUMN     "eps_rate" DECIMAL(5,2) NOT NULL DEFAULT 8.33,
ADD COLUMN     "eps_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 15000,
ADD COLUMN     "esi_employer_code" TEXT,
ADD COLUMN     "gratuity_cap" DECIMAL(12,2) NOT NULL DEFAULT 2000000,
ADD COLUMN     "gratuity_min_years" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "loan_max_emi_percent" DECIMAL(5,2) NOT NULL DEFAULT 100,
ADD COLUMN     "loan_max_multiple" DECIMAL(5,2) NOT NULL DEFAULT 3,
ADD COLUMN     "overtime_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overtime_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 2,
ADD COLUMN     "overtime_rate_per_hour" DECIMAL(10,2),
ADD COLUMN     "pay_days_mode" TEXT NOT NULL DEFAULT 'CALENDAR',
ADD COLUMN     "pf_admin_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
ADD COLUMN     "pf_cap_at_ceiling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pf_establishment_code" TEXT,
ADD COLUMN     "pt_default_state_code" TEXT,
ADD COLUMN     "pt_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "standard_hours_per_day" DECIMAL(4,2) NOT NULL DEFAULT 8,
ADD COLUMN     "tds_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unmarked_days_as_absent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "use_attendance" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "hr"."payroll_periods" ADD COLUMN     "reopen_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reopen_reason" TEXT,
ADD COLUMN     "reopened_at" TIMESTAMPTZ(6),
ADD COLUMN     "reopened_by_id" INTEGER;

-- AlterTable
ALTER TABLE "hr"."payroll_entries" ADD COLUMN     "absent_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "attendance_lock_id" INTEGER,
ADD COLUMN     "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pay_days_divisor" DECIMAL(5,2),
ADD COLUMN     "pay_days_mode" TEXT,
ADD COLUMN     "tax_regime" TEXT,
ADD COLUMN     "taxable_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "hr"."employee_salaries" ADD COLUMN     "revision_letter_id" INTEGER,
ADD COLUMN     "salary_template_id" INTEGER;

-- AlterTable
ALTER TABLE "hr"."pf_contributions" ADD COLUMN     "admin_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "edli_contribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "edli_wage" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "epf_employer_contribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "eps_contribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "eps_wage" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gross_wage" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ncp_days" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "hr"."employee_loans" ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "approved_by_id" INTEGER,
ADD COLUMN     "decision_note" TEXT,
ADD COLUMN     "limit_override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "override_reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "hr"."payslips" ADD COLUMN     "pdf_content" BYTEA,
ADD COLUMN     "pdf_rendered_at" TIMESTAMPTZ(6),
ADD COLUMN     "regenerated_at" TIMESTAMPTZ(6),
ADD COLUMN     "regeneration_reason" TEXT,
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "hr"."salary_components" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "is_prorated" BOOLEAN NOT NULL DEFAULT true,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "pf_applicable" BOOLEAN NOT NULL DEFAULT false,
    "esi_applicable" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."salary_templates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "salary_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."salary_template_components" (
    "id" SERIAL NOT NULL,
    "salary_template_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "calculation_type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "salary_template_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_salary_components" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_salary_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."professional_tax_slabs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "state_code" TEXT NOT NULL,
    "min_monthly_wage" DECIMAL(12,2) NOT NULL,
    "max_monthly_wage" DECIMAL(12,2),
    "monthly_amount" DECIMAL(10,2) NOT NULL,
    "special_month" INTEGER,
    "special_amount" DECIMAL(10,2),
    "applicable_months" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "professional_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."pt_location_states" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "work_location_id" INTEGER NOT NULL,
    "state_code" TEXT NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pt_location_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."income_tax_regimes" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "financial_year" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "standard_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rebate_income_limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rebate_max_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess_percent" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "section_80c_limit" DECIMAL(12,2) NOT NULL DEFAULT 150000,
    "home_loan_interest_limit" DECIMAL(12,2) NOT NULL DEFAULT 200000,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "income_tax_regimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."income_tax_slabs" (
    "id" SERIAL NOT NULL,
    "regime_id" INTEGER NOT NULL,
    "from_income" DECIMAL(14,2) NOT NULL,
    "to_income" DECIMAL(14,2),
    "rate_percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "income_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_tax_declarations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "financial_year" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "section_80c" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "section_80d" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hra_exemption" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "home_loan_interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previous_employer_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previous_employer_tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "verified_section_80c" DECIMAL(12,2),
    "verified_section_80d" DECIMAL(12,2),
    "verified_hra_exemption" DECIMAL(12,2),
    "verified_home_loan_interest" DECIMAL(12,2),
    "verified_other_deductions" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(6),
    "verified_by_id" INTEGER,
    "verified_at" TIMESTAMPTZ(6),
    "verification_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_tax_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."loan_prepayments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "received_on" DATE NOT NULL,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" INTEGER NOT NULL,
    "decided_by_id" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loan_prepayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_components_organization_id_is_active_idx" ON "hr"."salary_components"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_organization_id_code_key" ON "hr"."salary_components"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_templates_organization_id_code_key" ON "hr"."salary_templates"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_template_components_salary_template_id_salary_compon_key" ON "hr"."salary_template_components"("salary_template_id", "salary_component_id");

-- CreateIndex
CREATE INDEX "employee_salary_components_organization_id_employee_salary__idx" ON "hr"."employee_salary_components"("organization_id", "employee_salary_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_salary_components_employee_salary_id_salary_compon_key" ON "hr"."employee_salary_components"("employee_salary_id", "salary_component_id");

-- CreateIndex
CREATE INDEX "professional_tax_slabs_organization_id_state_code_idx" ON "hr"."professional_tax_slabs"("organization_id", "state_code");

-- CreateIndex
CREATE UNIQUE INDEX "pt_location_states_work_location_id_key" ON "hr"."pt_location_states"("work_location_id");

-- CreateIndex
CREATE INDEX "pt_location_states_organization_id_idx" ON "hr"."pt_location_states"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "income_tax_regimes_organization_id_financial_year_regime_key" ON "hr"."income_tax_regimes"("organization_id", "financial_year", "regime");

-- CreateIndex
CREATE UNIQUE INDEX "income_tax_slabs_regime_id_from_income_key" ON "hr"."income_tax_slabs"("regime_id", "from_income");

-- CreateIndex
CREATE INDEX "employee_tax_declarations_organization_id_financial_year_st_idx" ON "hr"."employee_tax_declarations"("organization_id", "financial_year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_tax_declarations_employee_id_financial_year_key" ON "hr"."employee_tax_declarations"("employee_id", "financial_year");

-- CreateIndex
CREATE INDEX "loan_prepayments_organization_id_loan_id_idx" ON "hr"."loan_prepayments"("organization_id", "loan_id");

-- CreateIndex
CREATE INDEX "loan_prepayments_organization_id_status_idx" ON "hr"."loan_prepayments"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "hr"."payroll_periods" ADD CONSTRAINT "payroll_periods_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_salaries" ADD CONSTRAINT "employee_salaries_salary_template_id_fkey" FOREIGN KEY ("salary_template_id") REFERENCES "hr"."salary_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_salaries" ADD CONSTRAINT "employee_salaries_revision_letter_id_fkey" FOREIGN KEY ("revision_letter_id") REFERENCES "hr"."revision_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_loans" ADD CONSTRAINT "employee_loans_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."salary_components" ADD CONSTRAINT "salary_components_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."salary_templates" ADD CONSTRAINT "salary_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."salary_template_components" ADD CONSTRAINT "salary_template_components_salary_template_id_fkey" FOREIGN KEY ("salary_template_id") REFERENCES "hr"."salary_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."salary_template_components" ADD CONSTRAINT "salary_template_components_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "hr"."salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_salary_components" ADD CONSTRAINT "employee_salary_components_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_salary_components" ADD CONSTRAINT "employee_salary_components_employee_salary_id_fkey" FOREIGN KEY ("employee_salary_id") REFERENCES "hr"."employee_salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_salary_components" ADD CONSTRAINT "employee_salary_components_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "hr"."salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."professional_tax_slabs" ADD CONSTRAINT "professional_tax_slabs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."pt_location_states" ADD CONSTRAINT "pt_location_states_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."pt_location_states" ADD CONSTRAINT "pt_location_states_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "hr"."work_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."income_tax_regimes" ADD CONSTRAINT "income_tax_regimes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."income_tax_slabs" ADD CONSTRAINT "income_tax_slabs_regime_id_fkey" FOREIGN KEY ("regime_id") REFERENCES "hr"."income_tax_regimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_tax_declarations" ADD CONSTRAINT "employee_tax_declarations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_tax_declarations" ADD CONSTRAINT "employee_tax_declarations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_tax_declarations" ADD CONSTRAINT "employee_tax_declarations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_prepayments" ADD CONSTRAINT "loan_prepayments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_prepayments" ADD CONSTRAINT "loan_prepayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "hr"."employee_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_prepayments" ADD CONSTRAINT "loan_prepayments_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."loan_prepayments" ADD CONSTRAINT "loan_prepayments_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express
-- ---------------------------------------------------------------------------

-- Payroll settings: policy enums and sane ranges.
ALTER TABLE "hr"."payroll_settings"
  ADD CONSTRAINT "payroll_settings_pay_days_mode_check"
  CHECK ("pay_days_mode" IN ('CALENDAR', 'FIXED_30', 'FIXED_26', 'WORKING_DAYS')),
  ADD CONSTRAINT "payroll_settings_default_tax_regime_check"
  CHECK ("default_tax_regime" IN ('OLD', 'NEW')),
  ADD CONSTRAINT "payroll_settings_statutory_rates_check"
  CHECK ("eps_rate" BETWEEN 0 AND 100
     AND "edli_rate" BETWEEN 0 AND 100
     AND "pf_admin_rate" BETWEEN 0 AND 100
     AND "bonus_percent" BETWEEN 0 AND 100
     AND "loan_max_emi_percent" > 0 AND "loan_max_emi_percent" <= 100),
  ADD CONSTRAINT "payroll_settings_statutory_limits_check"
  CHECK ("eps_wage_ceiling" > 0 AND "edli_wage_ceiling" > 0
     AND "bonus_eligibility_limit" > 0 AND "bonus_calculation_ceiling" > 0
     AND "gratuity_cap" > 0 AND "gratuity_min_years" >= 0
     AND "eps_age_limit" BETWEEN 18 AND 100
     AND "loan_max_multiple" > 0),
  ADD CONSTRAINT "payroll_settings_overtime_check"
  CHECK ("overtime_multiplier" > 0
     AND "standard_hours_per_day" > 0 AND "standard_hours_per_day" <= 24
     AND ("overtime_rate_per_hour" IS NULL OR "overtime_rate_per_hour" > 0));

-- Reopen: a reason always accompanies a reopen.
ALTER TABLE "hr"."payroll_periods"
  ADD CONSTRAINT "payroll_periods_reopen_check"
  CHECK ("reopened_at" IS NULL
      OR ("reopened_by_id" IS NOT NULL AND length(btrim("reopen_reason")) >= 10)),
  ADD CONSTRAINT "payroll_periods_reopen_count_check" CHECK ("reopen_count" >= 0);

ALTER TABLE "hr"."payroll_entries"
  ADD CONSTRAINT "payroll_entries_basis_check"
  CHECK ("absent_days" >= 0 AND "overtime_minutes" >= 0
     AND ("pay_days_mode" IS NULL OR "pay_days_mode" IN ('CALENDAR', 'FIXED_30', 'FIXED_26', 'WORKING_DAYS'))
     AND ("tax_regime" IS NULL OR "tax_regime" IN ('OLD', 'NEW')));

-- Loans: approval workflow. Existing loans were created ACTIVE and stay so.
ALTER TABLE "hr"."employee_loans"
  ADD CONSTRAINT "employee_loans_status_check"
  CHECK ("status" IN ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CLOSED', 'DEFAULTED', 'CANCELLED')),
  ADD CONSTRAINT "employee_loans_override_check"
  CHECK (NOT "limit_override" OR length(btrim(coalesce("override_reason", ''))) >= 10),
  ADD CONSTRAINT "employee_loans_rejection_note_check"
  CHECK ("status" <> 'REJECTED' OR length(btrim(coalesce("decision_note", ''))) >= 3);

ALTER TABLE "hr"."loan_repayments"
  ADD CONSTRAINT "loan_repayments_status_check"
  CHECK ("status" IN ('PENDING', 'PAID', 'SKIPPED', 'PREPAID'));

ALTER TABLE "hr"."loan_prepayments"
  ADD CONSTRAINT "loan_prepayments_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "loan_prepayments_reason_check" CHECK (length(btrim("reason")) >= 3),
  ADD CONSTRAINT "loan_prepayments_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT "loan_prepayments_decision_check"
  CHECK (("status" = 'PENDING') = ("decided_by_id" IS NULL AND "decided_at" IS NULL));

-- Payslips: a regeneration always carries its reason.
ALTER TABLE "hr"."payslips"
  ADD CONSTRAINT "payslips_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "payslips_regeneration_check"
  CHECK ("regenerated_at" IS NULL OR length(btrim(coalesce("regeneration_reason", ''))) >= 10);

-- Salary components: the engine's own line codes are reserved.
ALTER TABLE "hr"."salary_components"
  ADD CONSTRAINT "salary_components_kind_check" CHECK ("kind" IN ('EARNING', 'DEDUCTION')),
  ADD CONSTRAINT "salary_components_code_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,39}$'
     AND "code" NOT IN ('ARREARS', 'BONUS', 'OVERTIME', 'PF', 'ESI', 'PT', 'TDS', 'LOAN', 'GRATUITY')),
  ADD CONSTRAINT "salary_components_name_check" CHECK (length(btrim("name")) >= 2);

ALTER TABLE "hr"."salary_templates"
  ADD CONSTRAINT "salary_templates_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_-]{1,39}$'),
  ADD CONSTRAINT "salary_templates_name_check" CHECK (length(btrim("name")) >= 2);

ALTER TABLE "hr"."salary_template_components"
  ADD CONSTRAINT "salary_template_components_type_check"
  CHECK ("calculation_type" IN ('FIXED', 'PERCENT_OF_GROSS', 'PERCENT_OF_BASIC', 'REMAINDER')),
  ADD CONSTRAINT "salary_template_components_value_check"
  CHECK ("value" >= 0
     AND ("calculation_type" NOT IN ('PERCENT_OF_GROSS', 'PERCENT_OF_BASIC') OR "value" <= 100));

-- At most one REMAINDER line per template.
CREATE UNIQUE INDEX "salary_template_components_one_remainder"
  ON "hr"."salary_template_components" ("salary_template_id")
  WHERE "calculation_type" = 'REMAINDER';

ALTER TABLE "hr"."employee_salary_components"
  ADD CONSTRAINT "employee_salary_components_amount_check" CHECK ("monthly_amount" >= 0);

ALTER TABLE "hr"."professional_tax_slabs"
  ADD CONSTRAINT "professional_tax_slabs_state_check" CHECK ("state_code" ~ '^[A-Z]{2,3}$'),
  ADD CONSTRAINT "professional_tax_slabs_range_check"
  CHECK ("min_monthly_wage" >= 0 AND ("max_monthly_wage" IS NULL OR "max_monthly_wage" >= "min_monthly_wage")),
  ADD CONSTRAINT "professional_tax_slabs_amount_check"
  CHECK ("monthly_amount" >= 0 AND ("special_amount" IS NULL OR "special_amount" >= 0)),
  ADD CONSTRAINT "professional_tax_slabs_special_check"
  CHECK (("special_month" IS NULL) = ("special_amount" IS NULL)
     AND ("special_month" IS NULL OR "special_month" BETWEEN 1 AND 12)),
  ADD CONSTRAINT "professional_tax_slabs_months_check"
  CHECK ("applicable_months" IS NULL
      OR "applicable_months" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]),
  ADD CONSTRAINT "professional_tax_slabs_dates_check"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "hr"."pt_location_states"
  ADD CONSTRAINT "pt_location_states_state_check" CHECK ("state_code" ~ '^[A-Z]{2,3}$');

ALTER TABLE "hr"."income_tax_regimes"
  ADD CONSTRAINT "income_tax_regimes_regime_check" CHECK ("regime" IN ('OLD', 'NEW')),
  ADD CONSTRAINT "income_tax_regimes_fy_check" CHECK ("financial_year" ~ '^[0-9]{4}-[0-9]{2}$'),
  ADD CONSTRAINT "income_tax_regimes_amounts_check"
  CHECK ("standard_deduction" >= 0 AND "rebate_income_limit" >= 0 AND "rebate_max_amount" >= 0
     AND "cess_percent" BETWEEN 0 AND 100
     AND "section_80c_limit" >= 0 AND "home_loan_interest_limit" >= 0 AND "version" >= 1);

ALTER TABLE "hr"."income_tax_slabs"
  ADD CONSTRAINT "income_tax_slabs_range_check"
  CHECK ("from_income" >= 0 AND ("to_income" IS NULL OR "to_income" > "from_income")),
  ADD CONSTRAINT "income_tax_slabs_rate_check" CHECK ("rate_percent" BETWEEN 0 AND 100);

ALTER TABLE "hr"."employee_tax_declarations"
  ADD CONSTRAINT "employee_tax_declarations_regime_check" CHECK ("regime" IN ('OLD', 'NEW')),
  ADD CONSTRAINT "employee_tax_declarations_fy_check" CHECK ("financial_year" ~ '^[0-9]{4}-[0-9]{2}$'),
  ADD CONSTRAINT "employee_tax_declarations_status_check"
  CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
  ADD CONSTRAINT "employee_tax_declarations_amounts_check"
  CHECK ("section_80c" >= 0 AND "section_80d" >= 0 AND "hra_exemption" >= 0
     AND "home_loan_interest" >= 0 AND "other_deductions" >= 0 AND "other_income" >= 0
     AND "previous_employer_income" >= 0 AND "previous_employer_tds" >= 0
     AND coalesce("verified_section_80c", 0) >= 0 AND coalesce("verified_section_80d", 0) >= 0
     AND coalesce("verified_hra_exemption", 0) >= 0
     AND coalesce("verified_home_loan_interest", 0) >= 0
     AND coalesce("verified_other_deductions", 0) >= 0),
  ADD CONSTRAINT "employee_tax_declarations_verified_check"
  CHECK ("status" NOT IN ('VERIFIED', 'REJECTED') OR ("verified_by_id" IS NOT NULL AND "verified_at" IS NOT NULL)),
  ADD CONSTRAINT "employee_tax_declarations_rejection_check"
  CHECK ("status" <> 'REJECTED' OR length(btrim(coalesce("verification_note", ''))) >= 3);

-- ---------------------------------------------------------------------------
-- Data: the component master and every existing structure's lines
-- ---------------------------------------------------------------------------

-- The system components, for every organization. PF applies to Basic and DA
-- (statutory PF wage); everything is ESI wage and taxable by default.
INSERT INTO "hr"."salary_components"
  ("organization_id", "code", "name", "kind", "is_prorated", "is_taxable",
   "pf_applicable", "esi_applicable", "is_system", "display_order", "updated_at")
SELECT o."id", c.code, c.name, 'EARNING', true, true, c.pf, true, true, c.ord, now()
  FROM "platform"."organizations" o
 CROSS JOIN (VALUES
   ('BASIC', 'Basic Salary', true, 10),
   ('DA', 'Dearness Allowance', true, 20),
   ('HRA', 'House Rent Allowance', false, 30),
   ('CONVEYANCE', 'Conveyance Allowance', false, 40),
   ('OTHER_ALLOWANCE', 'Other Allowance', false, 50),
   ('SPECIAL_ALLOWANCE', 'Special Allowance', false, 60)
 ) AS c(code, name, pf, ord)
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- Existing structures become lines with exactly the amounts they had, so the
-- next run pays what the previous engine paid.
INSERT INTO "hr"."employee_salary_components"
  ("organization_id", "employee_salary_id", "salary_component_id", "monthly_amount",
   "created_by", "updated_by", "updated_at")
SELECT s."organization_id", s."id", c."id", v.amount, s."created_by", s."updated_by", now()
  FROM "hr"."employee_salaries" s
 CROSS JOIN LATERAL (VALUES
   ('BASIC', s."basic"),
   ('HRA', s."hra"),
   ('CONVEYANCE', s."conveyance"),
   ('OTHER_ALLOWANCE', s."other_allowance"),
   ('SPECIAL_ALLOWANCE', s."special_allowance")
 ) AS v(code, amount)
  JOIN "hr"."salary_components" c
    ON c."organization_id" = s."organization_id" AND c."code" = v.code
 WHERE v.amount > 0 OR v.code IN ('BASIC', 'HRA')
ON CONFLICT ("employee_salary_id", "salary_component_id") DO NOTHING;
