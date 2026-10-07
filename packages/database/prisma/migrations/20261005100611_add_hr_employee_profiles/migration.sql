-- CreateTable
CREATE TABLE "hr"."employee_profiles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "title" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "marital_status" TEXT,
    "blood_group" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "father_name" TEXT,
    "mother_name" TEXT,
    "spouse_name" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,
    "present_address" JSONB,
    "permanent_address" JSONB,
    "is_fresher" BOOLEAN NOT NULL DEFAULT false,
    "experience_years" DECIMAL(4,1),
    "previous_company" TEXT,
    "previous_role" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_sensitive_info" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "pan_number" TEXT,
    "aadhaar_number" TEXT,
    "esi_number" TEXT,
    "pf_number" TEXT,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "bank_account_no" TEXT,
    "bank_ifsc" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_sensitive_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_employee_id_key" ON "hr"."employee_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "employee_profiles_organization_id_idx" ON "hr"."employee_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_sensitive_info_employee_id_key" ON "hr"."employee_sensitive_info"("employee_id");

-- CreateIndex
CREATE INDEX "employee_sensitive_info_organization_id_idx" ON "hr"."employee_sensitive_info"("organization_id");

-- AddForeignKey
ALTER TABLE "hr"."employee_profiles" ADD CONSTRAINT "employee_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_profiles" ADD CONSTRAINT "employee_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_sensitive_info" ADD CONSTRAINT "employee_sensitive_info_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_sensitive_info" ADD CONSTRAINT "employee_sensitive_info_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
