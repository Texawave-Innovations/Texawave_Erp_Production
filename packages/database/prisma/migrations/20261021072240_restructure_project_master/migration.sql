/*
  Warnings:

  - You are about to drop the column `custom_fields` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `planned_end_date` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `project_manager_id` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `projects` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "projects"."projects" DROP CONSTRAINT "projects_department_id_fkey";

-- DropForeignKey
ALTER TABLE "projects"."projects" DROP CONSTRAINT "projects_project_manager_id_fkey";

-- DropIndex
DROP INDEX "projects"."projects_organization_id_status_idx";

-- AlterTable
ALTER TABLE "projects"."projects" DROP COLUMN "custom_fields",
DROP COLUMN "department_id",
DROP COLUMN "planned_end_date",
DROP COLUMN "project_manager_id",
DROP COLUMN "start_date",
DROP COLUMN "status",
ADD COLUMN     "description" TEXT;

-- DropEnum
DROP TYPE "projects"."ProjectMasterStatus";

-- CreateTable
CREATE TABLE "projects"."project_code_masters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "company_prefix" TEXT NOT NULL DEFAULT 'TXW',
    "module_identifier" TEXT NOT NULL DEFAULT 'PRJ',
    "default_project_code" TEXT NOT NULL DEFAULT '',
    "financial_year" TEXT NOT NULL DEFAULT '',
    "sequence_digits" INTEGER NOT NULL DEFAULT 3,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_code_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."task_running_number_masters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "task_prefix" TEXT NOT NULL DEFAULT 'T',
    "separator" TEXT NOT NULL DEFAULT '-',
    "sequence_digits" INTEGER NOT NULL DEFAULT 2,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_running_number_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_code_masters_organization_id_key" ON "projects"."project_code_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_running_number_masters_organization_id_key" ON "projects"."task_running_number_masters"("organization_id");

-- AddForeignKey
ALTER TABLE "projects"."project_code_masters" ADD CONSTRAINT "project_code_masters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."task_running_number_masters" ADD CONSTRAINT "task_running_number_masters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
