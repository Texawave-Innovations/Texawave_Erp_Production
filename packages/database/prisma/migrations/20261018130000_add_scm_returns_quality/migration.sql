-- CreateTable
CREATE TABLE "scm"."returns" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "return_number" TEXT NOT NULL,
    "return_type" TEXT NOT NULL,
    "sales_order_id" INTEGER,
    "sales_order_number" TEXT,
    "fulfillment_id" INTEGER,
    "fulfillment_number" TEXT,
    "shipment_id" INTEGER,
    "shipment_number" TEXT,
    "customer_id" INTEGER,
    "customer_name" TEXT,
    "purchase_order_id" INTEGER,
    "purchase_order_number" TEXT,
    "grn_id" INTEGER,
    "grn_number" TEXT,
    "supplier_id" INTEGER,
    "supplier_name" TEXT,
    "warehouse_id" INTEGER NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requested_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "received_by" INTEGER,
    "received_at" TIMESTAMP(3),
    "inspected_by" INTEGER,
    "inspected_at" TIMESTAMP(3),
    "shipped_by" INTEGER,
    "shipped_at" TIMESTAMP(3),
    "vendor_received_at" TIMESTAMP(3),
    "completed_by" INTEGER,
    "completed_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "return_shipment" JSONB,
    "quality_inspection_id" INTEGER,
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."return_items" (
    "id" SERIAL NOT NULL,
    "return_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "ordered_qty" DECIMAL(14,3),
    "source_qty" DECIMAL(14,3) NOT NULL,
    "previously_returned_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "requested_qty" DECIMAL(14,3) NOT NULL,
    "received_return_qty" DECIMAL(14,3),
    "accepted_qty" DECIMAL(14,3),
    "rejected_qty" DECIMAL(14,3),
    "condition" TEXT,
    "grn_item_id" INTEGER,
    "batch_id" INTEGER,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "posted_ledger_entry_id" INTEGER,
    "unit_cost" DECIMAL(14,4),
    "notes" TEXT,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."return_inspections" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "return_id" INTEGER NOT NULL,
    "inspector_id" INTEGER NOT NULL,
    "inspection_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condition" TEXT NOT NULL,
    "accepted_qty" DECIMAL(14,3) NOT NULL,
    "rejected_qty" DECIMAL(14,3) NOT NULL,
    "result" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."return_dispositions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "return_id" INTEGER NOT NULL,
    "return_item_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "disposition" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "notes" TEXT,
    "ledger_entry_ids" INTEGER[],
    "quarantine_record_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quality_defects" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "defect_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quality_templates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "template_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inspection_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "checkpoints" JSONB NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quality_inspections" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "inspection_number" TEXT NOT NULL,
    "inspection_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "source_number" TEXT,
    "template_id" INTEGER,
    "template_name" TEXT,
    "supplier_id" INTEGER,
    "supplier_name" TEXT,
    "customer_id" INTEGER,
    "customer_name" TEXT,
    "warehouse_id" INTEGER,
    "location_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_INSPECTION',
    "result" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "inspection_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "inspector_id" INTEGER,
    "inspector_name" TEXT,
    "notes" TEXT,
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quality_inspection_items" (
    "id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "source_line_id" INTEGER,
    "batch_id" INTEGER,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],
    "ordered_qty" DECIMAL(14,3),
    "source_qty" DECIMAL(14,3) NOT NULL,
    "inspected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "accepted_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "inspection_result" TEXT,
    "condition" TEXT,
    "defect_code" TEXT,
    "defect_description" TEXT,
    "disposition" TEXT,
    "notes" TEXT,
    "warehouse_id" INTEGER,
    "location_id" INTEGER,
    "unit_cost" DECIMAL(14,4),
    "checkpoint_results" JSONB NOT NULL DEFAULT '[]',
    "ledger_entry_id" INTEGER,
    "quarantine_record_id" INTEGER,

    CONSTRAINT "quality_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quarantine_records" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "batch_id" INTEGER,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "quantity" DECIMAL(14,3) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER,
    "source_number" TEXT,
    "inspection_id" INTEGER,
    "inspection_number" TEXT,
    "defect_code" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "quarantine_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "released_by" INTEGER,
    "released_at" TIMESTAMP(3),
    "release_ledger_entry_id" INTEGER,
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "reject_ledger_entry_id" INTEGER,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantine_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returns_organization_id_return_type_status_idx" ON "scm"."returns"("organization_id", "return_type", "status");

-- CreateIndex
CREATE INDEX "returns_fulfillment_id_idx" ON "scm"."returns"("fulfillment_id");

-- CreateIndex
CREATE INDEX "returns_grn_id_idx" ON "scm"."returns"("grn_id");

-- CreateIndex
CREATE UNIQUE INDEX "returns_organization_id_return_number_key" ON "scm"."returns"("organization_id", "return_number");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "scm"."return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_product_id_idx" ON "scm"."return_items"("product_id");

-- CreateIndex
CREATE INDEX "return_inspections_return_id_idx" ON "scm"."return_inspections"("return_id");

-- CreateIndex
CREATE INDEX "return_dispositions_return_id_idx" ON "scm"."return_dispositions"("return_id");

-- CreateIndex
CREATE INDEX "return_dispositions_return_item_id_idx" ON "scm"."return_dispositions"("return_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_defects_organization_id_defect_code_key" ON "scm"."quality_defects"("organization_id", "defect_code");

-- CreateIndex
CREATE UNIQUE INDEX "quality_templates_organization_id_template_code_key" ON "scm"."quality_templates"("organization_id", "template_code");

-- CreateIndex
CREATE INDEX "quality_inspections_organization_id_status_idx" ON "scm"."quality_inspections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "quality_inspections_organization_id_source_type_source_id_idx" ON "scm"."quality_inspections"("organization_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_organization_id_inspection_number_key" ON "scm"."quality_inspections"("organization_id", "inspection_number");

-- CreateIndex
CREATE INDEX "quality_inspection_items_inspection_id_idx" ON "scm"."quality_inspection_items"("inspection_id");

-- CreateIndex
CREATE INDEX "quality_inspection_items_product_id_idx" ON "scm"."quality_inspection_items"("product_id");

-- CreateIndex
CREATE INDEX "quarantine_records_organization_id_status_idx" ON "scm"."quarantine_records"("organization_id", "status");

-- CreateIndex
CREATE INDEX "quarantine_records_product_id_idx" ON "scm"."quarantine_records"("product_id");

-- AddForeignKey
ALTER TABLE "scm"."returns" ADD CONSTRAINT "returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."returns" ADD CONSTRAINT "returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "scm"."returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."return_items" ADD CONSTRAINT "return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."return_inspections" ADD CONSTRAINT "return_inspections_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "scm"."returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."return_dispositions" ADD CONSTRAINT "return_dispositions_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "scm"."returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."return_dispositions" ADD CONSTRAINT "return_dispositions_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "scm"."return_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quality_defects" ADD CONSTRAINT "quality_defects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quality_templates" ADD CONSTRAINT "quality_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quality_inspections" ADD CONSTRAINT "quality_inspections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "scm"."quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quarantine_records" ADD CONSTRAINT "quarantine_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quarantine_records" ADD CONSTRAINT "quarantine_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quarantine_records" ADD CONSTRAINT "quarantine_records_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dispositions are an append-only decision log.
CREATE TRIGGER "return_dispositions_no_update_delete"
  BEFORE UPDATE OR DELETE ON "scm"."return_dispositions"
  FOR EACH ROW EXECUTE FUNCTION "platform"."prevent_row_mutation"();
CREATE TRIGGER "return_dispositions_no_truncate"
  BEFORE TRUNCATE ON "scm"."return_dispositions"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform"."prevent_row_mutation"();

-- Value-set and quantity invariants the application also enforces.
ALTER TABLE "scm"."returns" ADD CONSTRAINT "returns_type_check"
  CHECK ("return_type" IN ('CUSTOMER_RETURN', 'VENDOR_RETURN'));
ALTER TABLE "scm"."return_items" ADD CONSTRAINT "return_items_qty_check"
  CHECK ("requested_qty" > 0 AND "source_qty" >= 0 AND "previously_returned_qty" >= 0);
ALTER TABLE "scm"."return_dispositions" ADD CONSTRAINT "return_dispositions_qty_check"
  CHECK ("quantity" > 0);
ALTER TABLE "scm"."quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_qty_check"
  CHECK ("inspected_qty" >= 0 AND "accepted_qty" >= 0 AND "rejected_qty" >= 0);
ALTER TABLE "scm"."quarantine_records" ADD CONSTRAINT "quarantine_records_qty_check"
  CHECK ("quantity" > 0);
