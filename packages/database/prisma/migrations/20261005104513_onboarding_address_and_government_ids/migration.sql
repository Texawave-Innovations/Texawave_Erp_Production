/*
  Warnings:

  - You are about to drop the column `current_address` on the `employee_personal_details` table. All the data in the column will be lost.
  - You are about to drop the column `permanent_address` on the `employee_personal_details` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "hr"."employee_bank_details" ADD COLUMN     "branch_name" TEXT;

-- AlterTable
ALTER TABLE "hr"."employee_personal_details" DROP COLUMN "current_address",
DROP COLUMN "permanent_address",
ADD COLUMN     "father_name" TEXT,
ADD COLUMN     "father_phone" TEXT,
ADD COLUMN     "mother_name" TEXT,
ADD COLUMN     "mother_phone" TEXT;

-- CreateTable
CREATE TABLE "hr"."employee_addresses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "address_type" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "area_locality" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_government_ids" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "aadhaar_number" TEXT,
    "pan_number" TEXT,
    "esi_number" TEXT,
    "pf_number" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_government_ids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_addresses_organization_id_team_id_idx" ON "hr"."employee_addresses"("organization_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_addresses_employee_id_address_type_key" ON "hr"."employee_addresses"("employee_id", "address_type");

-- CreateIndex
CREATE UNIQUE INDEX "employee_government_ids_employee_id_key" ON "hr"."employee_government_ids"("employee_id");

-- CreateIndex
CREATE INDEX "employee_government_ids_organization_id_team_id_idx" ON "hr"."employee_government_ids"("organization_id", "team_id");

-- AddForeignKey
ALTER TABLE "hr"."employee_addresses" ADD CONSTRAINT "employee_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_addresses" ADD CONSTRAINT "employee_addresses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_addresses" ADD CONSTRAINT "employee_addresses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_government_ids" ADD CONSTRAINT "employee_government_ids_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_government_ids" ADD CONSTRAINT "employee_government_ids_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_government_ids" ADD CONSTRAINT "employee_government_ids_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
