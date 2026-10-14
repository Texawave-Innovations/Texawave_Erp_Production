-- CreateTable
CREATE TABLE "hr"."tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_id" INTEGER NOT NULL,
    "assigned_by_user_id" INTEGER NOT NULL,
    "created_by_employee_id" INTEGER,
    "due_date" DATE NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_employee_created" BOOLEAN NOT NULL DEFAULT false,
    "request_to_admin" BOOLEAN NOT NULL DEFAULT false,
    "admin_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_organization_id_assignee_id_status_idx" ON "hr"."tasks"("organization_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_idx" ON "hr"."tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tasks_organization_id_due_date_idx" ON "hr"."tasks"("organization_id", "due_date");

-- AddForeignKey
ALTER TABLE "hr"."tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tasks" ADD CONSTRAINT "tasks_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tasks" ADD CONSTRAINT "tasks_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tasks" ADD CONSTRAINT "tasks_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma cannot express.

-- Only the legacy statuses (Task Assignment screen: pending, in_progress, done,
-- cancelled) and priorities (low, medium, high, urgent), stored upper-case as
-- the other HR tables do.
ALTER TABLE "hr"."tasks"
  ADD CONSTRAINT "tasks_status_check"
  CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'));

ALTER TABLE "hr"."tasks"
  ADD CONSTRAINT "tasks_priority_check"
  CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));

-- A task must carry real text, not a blank string.
ALTER TABLE "hr"."tasks"
  ADD CONSTRAINT "tasks_title_not_blank_check"
  CHECK (length(btrim("title")) > 0);

-- Only a DONE task can be approved, and approval is recorded together (who +
-- when). Reopening clears both, so the pair is always consistent.
ALTER TABLE "hr"."tasks"
  ADD CONSTRAINT "tasks_approval_consistency_check"
  CHECK (
    ("admin_approved" = false AND "approved_by_user_id" IS NULL AND "approved_at" IS NULL)
    OR ("admin_approved" = true AND "status" = 'DONE'
        AND "approved_by_user_id" IS NOT NULL AND "approved_at" IS NOT NULL)
  );

-- Employee-created tasks name their creator, who is always the assignee (an
-- employee can only create work for themselves). Admin-assigned tasks name no
-- creator and cannot carry a request-to-admin flag.
ALTER TABLE "hr"."tasks"
  ADD CONSTRAINT "tasks_origin_consistency_check"
  CHECK (
    ("is_employee_created" = false AND "created_by_employee_id" IS NULL AND "request_to_admin" = false)
    OR ("is_employee_created" = true AND "created_by_employee_id" = "assignee_id")
  );
