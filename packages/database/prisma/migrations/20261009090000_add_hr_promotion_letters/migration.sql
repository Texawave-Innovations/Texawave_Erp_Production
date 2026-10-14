-- CreateTable
CREATE TABLE "hr"."promotion_letters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "designation_id" INTEGER NOT NULL,
    "document_no" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "previous_designation" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "letter_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "da" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL,
    "ca" DECIMAL(12,2) NOT NULL,
    "signatory_name" TEXT NOT NULL,
    "signatory_designation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotion_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_letters_organization_id_employee_id_idx" ON "hr"."promotion_letters"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "promotion_letters_designation_id_idx" ON "hr"."promotion_letters"("designation_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_letters_organization_id_document_no_key" ON "hr"."promotion_letters"("organization_id", "document_no");

-- AddForeignKey
ALTER TABLE "hr"."promotion_letters" ADD CONSTRAINT "promotion_letters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."promotion_letters" ADD CONSTRAINT "promotion_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."promotion_letters" ADD CONSTRAINT "promotion_letters_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "hr"."designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma cannot express (same as revision_letters).
-- Status: only GENERATED is ever assigned.
ALTER TABLE "hr"."promotion_letters"
  ADD CONSTRAINT "promotion_letters_status_check"
  CHECK ("status" IN ('GENERATED'));

-- Salary components are never negative.
ALTER TABLE "hr"."promotion_letters"
  ADD CONSTRAINT "promotion_letters_components_non_negative_check"
  CHECK ("basic" >= 0 AND "da" >= 0 AND "hra" >= 0 AND "ca" >= 0);
