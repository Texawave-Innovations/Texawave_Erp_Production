-- CreateTable
CREATE TABLE "scm"."supplier_bills" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "bill_number" TEXT NOT NULL,
    "supplier_bill_number" TEXT,
    "supplier_id" INTEGER NOT NULL,
    "purchase_order_id" INTEGER,
    "goods_receipt_id" INTEGER,
    "bill_date" DATE NOT NULL,
    "due_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."supplier_payments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "payment_number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "bill_id" INTEGER,
    "payment_date" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "reference_number" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."supplier_documents" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_bills_organization_id_supplier_id_idx" ON "scm"."supplier_bills"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_bills_organization_id_status_idx" ON "scm"."supplier_bills"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_organization_id_bill_number_key" ON "scm"."supplier_bills"("organization_id", "bill_number");

-- CreateIndex
CREATE INDEX "supplier_payments_organization_id_supplier_id_idx" ON "scm"."supplier_payments"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payments_bill_id_idx" ON "scm"."supplier_payments"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_organization_id_payment_number_key" ON "scm"."supplier_payments"("organization_id", "payment_number");

-- CreateIndex
CREATE INDEX "supplier_documents_organization_id_supplier_id_idx" ON "scm"."supplier_documents"("organization_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "scm"."supplier_bills" ADD CONSTRAINT "supplier_bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_bills" ADD CONSTRAINT "supplier_bills_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_bills" ADD CONSTRAINT "supplier_bills_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "scm"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_bills" ADD CONSTRAINT "supplier_bills_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "scm"."goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_payments" ADD CONSTRAINT "supplier_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "scm"."supplier_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_documents" ADD CONSTRAINT "supplier_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

