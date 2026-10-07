-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "onboarding_status" TEXT NOT NULL DEFAULT 'PENDING_PASSWORD_CHANGE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employee_personal_details" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date_of_birth" DATE,
    "gender" TEXT,
    "marital_status" TEXT,
    "blood_group" TEXT,
    "current_address" TEXT,
    "permanent_address" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_relation" TEXT,
    "emergency_contact_phone" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_personal_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bank_details" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_number_masked" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_family_members" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "date_of_birth" DATE,
    "contact_phone" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_experience" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employer" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE,
    "reason_for_leaving" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_personal_details_employee_id_key" ON "employee_personal_details"("employee_id");

-- CreateIndex
CREATE INDEX "employee_personal_details_organization_id_team_id_idx" ON "employee_personal_details"("organization_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_bank_details_employee_id_key" ON "employee_bank_details"("employee_id");

-- CreateIndex
CREATE INDEX "employee_bank_details_organization_id_team_id_idx" ON "employee_bank_details"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "employee_family_members_organization_id_team_id_employee_id_idx" ON "employee_family_members"("organization_id", "team_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_experience_organization_id_team_id_employee_id_idx" ON "employee_experience"("organization_id", "team_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_organization_id_team_id_employee_id_idx" ON "employee_documents"("organization_id", "team_id", "employee_id");

-- AddForeignKey
ALTER TABLE "employee_personal_details" ADD CONSTRAINT "employee_personal_details_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_personal_details" ADD CONSTRAINT "employee_personal_details_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_personal_details" ADD CONSTRAINT "employee_personal_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_experience" ADD CONSTRAINT "employee_experience_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_experience" ADD CONSTRAINT "employee_experience_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_experience" ADD CONSTRAINT "employee_experience_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
