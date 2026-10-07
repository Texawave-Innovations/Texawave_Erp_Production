-- CreateTable
CREATE TABLE "hr"."revision_letters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "document_no" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
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

    CONSTRAINT "revision_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revision_letters_organization_id_employee_id_idx" ON "hr"."revision_letters"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "revision_letters_organization_id_document_no_key" ON "hr"."revision_letters"("organization_id", "document_no");

-- AddForeignKey
ALTER TABLE "hr"."revision_letters" ADD CONSTRAINT "revision_letters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."revision_letters" ADD CONSTRAINT "revision_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
