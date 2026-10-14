-- CreateTable
CREATE TABLE "hr"."expense_claims" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "expense_type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "receipt_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_claims_organization_id_employee_id_expense_date_idx" ON "hr"."expense_claims"("organization_id", "employee_id", "expense_date");

-- CreateIndex
CREATE INDEX "expense_claims_organization_id_status_idx" ON "hr"."expense_claims"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "hr"."expense_claims" ADD CONSTRAINT "expense_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."expense_claims" ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."expense_claims" ADD CONSTRAINT "expense_claims_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."expense_claims" ADD CONSTRAINT "expense_claims_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma cannot express.

-- Legacy evidence: MyExpenses.tsx rejects amount <= 0. No maximum exists in legacy.
ALTER TABLE "hr"."expense_claims"
  ADD CONSTRAINT "expense_claims_amount_positive_check"
  CHECK ("amount" > 0);

-- Only the six legacy categories (EXPENSE_TYPES in ExpenseApprovals.tsx).
ALTER TABLE "hr"."expense_claims"
  ADD CONSTRAINT "expense_claims_expense_type_check"
  CHECK ("expense_type" IN ('Travel', 'Food', 'Accommodation', 'Office Supplies', 'Medical', 'Other'));

-- Only the three legacy statuses exist.
ALTER TABLE "hr"."expense_claims"
  ADD CONSTRAINT "expense_claims_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Legacy requires a description (MyExpenses.tsx), so it must carry real text.
ALTER TABLE "hr"."expense_claims"
  ADD CONSTRAINT "expense_claims_description_not_blank_check"
  CHECK (length(btrim("description")) > 0);

-- A decision is recorded together (who + when) and only once one exists.
ALTER TABLE "hr"."expense_claims"
  ADD CONSTRAINT "expense_claims_decision_consistency_check"
  CHECK (
    ("status" = 'PENDING' AND "decided_by" IS NULL AND "decided_at" IS NULL)
    OR ("status" <> 'PENDING' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
  );
