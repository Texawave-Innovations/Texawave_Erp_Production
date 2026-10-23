-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "projects";

-- CreateEnum
CREATE TYPE "projects"."ProjectMasterStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "projects"."projects" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" INTEGER,
    "project_manager_id" INTEGER,
    "status" "projects"."ProjectMasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL,
    "planned_end_date" DATE,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"."projects"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_code_key" ON "projects"."projects"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "platform"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
