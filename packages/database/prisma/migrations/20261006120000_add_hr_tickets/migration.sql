-- CreateTable
CREATE TABLE "hr"."tickets" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raised_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "raised_by_user_id" INTEGER,
    "resolved_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ticket_comments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "author_kind" TEXT NOT NULL,
    "author_user_id" INTEGER,
    "author_employee_id" INTEGER,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_organization_id_employee_id_status_idx" ON "hr"."tickets"("organization_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "tickets_organization_id_status_idx" ON "hr"."tickets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tickets_organization_id_created_at_idx" ON "hr"."tickets"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_comments_organization_id_ticket_id_created_at_idx" ON "hr"."ticket_comments"("organization_id", "ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "hr"."tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tickets" ADD CONSTRAINT "tickets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."tickets" ADD CONSTRAINT "tickets_raised_by_user_id_fkey" FOREIGN KEY ("raised_by_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ticket_comments" ADD CONSTRAINT "ticket_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "hr"."tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ticket_comments" ADD CONSTRAINT "ticket_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ticket_comments" ADD CONSTRAINT "ticket_comments_author_employee_id_fkey" FOREIGN KEY ("author_employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma cannot express.

-- Categories: the legacy employee form offers the first seven; the legacy admin
-- form adds Notice and Warning. The service restricts which set each caller may
-- use; the database accepts only the union.
ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_category_check"
  CHECK ("category" IN ('Attendance', 'Salary', 'Leave', 'Documents', 'IT Support', 'HR Query', 'Notice', 'Warning', 'Other'));

-- The four legacy statuses (open, in_progress, resolved, closed), upper-cased.
ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_status_check"
  CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'));

-- A ticket must carry real text, not a blank string.
ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_subject_not_blank_check"
  CHECK (length(btrim("subject")) > 0);

ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_description_not_blank_check"
  CHECK (length(btrim("description")) > 0);

-- Admin-raised tickets name the admin who raised them; employee-raised tickets
-- name no admin.
ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_origin_consistency_check"
  CHECK (
    ("raised_by_admin" = false AND "raised_by_user_id" IS NULL)
    OR ("raised_by_admin" = true AND "raised_by_user_id" IS NOT NULL)
  );

-- A resolved or closed ticket always carries the time it was last closed out.
-- Reopening (back to OPEN) keeps the stamp, as the legacy screen does.
ALTER TABLE "hr"."tickets"
  ADD CONSTRAINT "tickets_resolved_at_check"
  CHECK ("status" NOT IN ('RESOLVED', 'CLOSED') OR "resolved_at" IS NOT NULL);

-- Comment authors: HR replies name a user, employee replies name an employee.
ALTER TABLE "hr"."ticket_comments"
  ADD CONSTRAINT "ticket_comments_author_kind_check"
  CHECK ("author_kind" IN ('HR', 'EMPLOYEE'));

ALTER TABLE "hr"."ticket_comments"
  ADD CONSTRAINT "ticket_comments_author_consistency_check"
  CHECK (
    ("author_kind" = 'HR' AND "author_user_id" IS NOT NULL AND "author_employee_id" IS NULL)
    OR ("author_kind" = 'EMPLOYEE' AND "author_employee_id" IS NOT NULL AND "author_user_id" IS NULL)
  );

ALTER TABLE "hr"."ticket_comments"
  ADD CONSTRAINT "ticket_comments_body_not_blank_check"
  CHECK (length(btrim("body")) > 0);

-- Replies are the conversation's record: any UPDATE, DELETE or TRUNCATE is
-- rejected, so a reply cannot be changed or removed after it is posted. The
-- function is the one audit_logs uses (see 20260930095406_add_audit_logs).
CREATE TRIGGER "ticket_comments_no_update_delete"
  BEFORE UPDATE OR DELETE ON "hr"."ticket_comments"
  FOR EACH ROW EXECUTE FUNCTION "platform"."prevent_row_mutation"();

CREATE TRIGGER "ticket_comments_no_truncate"
  BEFORE TRUNCATE ON "hr"."ticket_comments"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform"."prevent_row_mutation"();
