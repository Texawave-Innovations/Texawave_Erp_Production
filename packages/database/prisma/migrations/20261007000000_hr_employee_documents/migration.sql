-- Hand-authored, NOT Prisma's auto-generated diff: Prisma's schema language
-- cannot express a partial (WHERE-qualified) unique index, which is what
-- this change needs — see the comment on EmployeeDocument in schema.prisma.
--
-- Employee Document Center (HR ad-hoc uploads, Docs conversation 2026-10-07):
-- the self-onboarding flow stores exactly one document per
-- (employee_id, document_type) via `employee_documents_employee_id_document_type_key`.
-- HR needs to store additional, free-form documents for the same employee —
-- including more than one of the same document_type/label, e.g. two
-- "Offer Letter" uploads — without weakening onboarding's own one-per-type
-- guarantee. Replacing the plain unique constraint with a unique index
-- scoped to `WHERE source = 'ONBOARDING'` keeps that guarantee exactly where
-- it already applies, while leaving HR's new `source = 'HR_UPLOADED'` rows
-- unconstrained.
--
-- `source` and `label` are added with a safe default so existing rows
-- (all of them onboarding uploads to date) classify correctly with no
-- backfill statement needed.

-- DropIndex
DROP INDEX "hr"."employee_documents_employee_id_document_type_key";

-- AlterTable
ALTER TABLE "hr"."employee_documents"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ONBOARDING',
  ADD COLUMN "label" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_employee_id_document_type_onboarding_key"
  ON "hr"."employee_documents" ("employee_id", "document_type")
  WHERE "source" = 'ONBOARDING';

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_document_type_idx"
  ON "hr"."employee_documents" ("employee_id", "document_type");
