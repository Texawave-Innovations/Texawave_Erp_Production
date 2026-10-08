-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_employee_id_document_type_key" ON "hr"."employee_documents"("employee_id", "document_type");

