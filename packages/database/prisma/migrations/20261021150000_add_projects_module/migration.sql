-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "projects";

-- CreateEnum
CREATE TYPE "projects"."ProjectStatus" AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "projects"."MilestoneStatus" AS ENUM ('not_started', 'in_progress', 'hold', 'completed');

-- CreateEnum
CREATE TYPE "projects"."TaskStatus" AS ENUM ('not_started', 'in_progress', 'hold', 'completed');

-- CreateEnum
CREATE TYPE "projects"."TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "projects"."ProjectExpenseStatus" AS ENUM ('unpaid', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "projects"."projects" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "project_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customer_id" INTEGER,
    "customer_name" TEXT,
    "project_type" TEXT,
    "department" TEXT,
    "expected_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "project_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actual_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "projects"."ProjectStatus" NOT NULL DEFAULT 'active',
    "start_date" DATE NOT NULL,
    "planned_end_date" DATE,
    "actual_end_date" DATE,
    "client_handling_person_id" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_members" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Contributor',
    "estimated_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "logged_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_milestones" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "actual_date" DATE,
    "status" "projects"."MilestoneStatus" NOT NULL DEFAULT 'not_started',
    "order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "task_code" TEXT NOT NULL,
    "milestone_id" INTEGER,
    "assigned_to_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "actual_end_date" DATE,
    "hours_to_complete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "logged_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "projects"."TaskStatus" NOT NULL DEFAULT 'not_started',
    "completion_percent" INTEGER NOT NULL DEFAULT 0,
    "priority" "projects"."TaskPriority" NOT NULL DEFAULT 'medium',
    "dependency_task_id" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 10,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_time_entries" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "entry_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_expenses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "department" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "vendor" TEXT,
    "reference_no" TEXT,
    "status" "projects"."ProjectExpenseStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_points_ledger" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "task_title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "project_points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_points_config" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "low" INTEGER NOT NULL DEFAULT 5,
    "medium" INTEGER NOT NULL DEFAULT 10,
    "high" INTEGER NOT NULL DEFAULT 20,
    "urgent" INTEGER NOT NULL DEFAULT 30,
    "custom_rules" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_points_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"."projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "projects_organization_id_department_idx" ON "projects"."projects"("organization_id", "department");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_project_code_key" ON "projects"."projects"("organization_id", "project_code");

-- CreateIndex
CREATE INDEX "project_members_organization_id_employee_id_idx" ON "projects"."project_members"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_employee_id_key" ON "projects"."project_members"("project_id", "employee_id");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_order_idx" ON "projects"."project_milestones"("project_id", "order");

-- CreateIndex
CREATE INDEX "project_tasks_project_id_status_idx" ON "projects"."project_tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_tasks_organization_id_assigned_to_id_idx" ON "projects"."project_tasks"("organization_id", "assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_tasks_organization_id_task_code_key" ON "projects"."project_tasks"("organization_id", "task_code");

-- CreateIndex
CREATE INDEX "project_time_entries_organization_id_employee_id_entry_date_idx" ON "projects"."project_time_entries"("organization_id", "employee_id", "entry_date");

-- CreateIndex
CREATE INDEX "project_time_entries_task_id_idx" ON "projects"."project_time_entries"("task_id");

-- CreateIndex
CREATE INDEX "project_expenses_organization_id_project_id_idx" ON "projects"."project_expenses"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "project_points_ledger_organization_id_employee_id_idx" ON "projects"."project_points_ledger"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_points_config_organization_id_key" ON "projects"."project_points_config"("organization_id");

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."projects" ADD CONSTRAINT "projects_client_handling_person_id_fkey" FOREIGN KEY ("client_handling_person_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_members" ADD CONSTRAINT "project_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_members" ADD CONSTRAINT "project_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_milestones" ADD CONSTRAINT "project_milestones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_tasks" ADD CONSTRAINT "project_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_tasks" ADD CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "projects"."project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_tasks" ADD CONSTRAINT "project_tasks_dependency_task_id_fkey" FOREIGN KEY ("dependency_task_id") REFERENCES "projects"."project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_time_entries" ADD CONSTRAINT "project_time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_time_entries" ADD CONSTRAINT "project_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "projects"."project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_time_entries" ADD CONSTRAINT "project_time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_expenses" ADD CONSTRAINT "project_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_expenses" ADD CONSTRAINT "project_expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_points_ledger" ADD CONSTRAINT "project_points_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_points_ledger" ADD CONSTRAINT "project_points_ledger_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_points_ledger" ADD CONSTRAINT "project_points_ledger_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "projects"."project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_points_config" ADD CONSTRAINT "project_points_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

