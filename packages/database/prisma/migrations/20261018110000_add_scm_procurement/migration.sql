-- CreateTable
CREATE TABLE "scm"."purchase_requisitions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "requisition_number" TEXT NOT NULL,
    "requested_by" INTEGER,
    "requested_by_name" TEXT NOT NULL,
    "department" TEXT,
    "request_date" DATE NOT NULL,
    "required_date" DATE,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "purpose" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approved_by" INTEGER,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "source_sales_order_id" INTEGER,
    "source_sales_order_number" TEXT,
    "fulfillment_id" INTEGER,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."purchase_requisition_items" (
    "id" SERIAL NOT NULL,
    "requisition_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "estimated_unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimated_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "required_date" DATE,
    "notes" TEXT,

    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."rfqs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "rfq_number" TEXT NOT NULL,
    "requisition_id" INTEGER,
    "issue_date" DATE NOT NULL,
    "response_due_date" DATE,
    "warehouse_id" INTEGER NOT NULL,
    "delivery_location" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."rfq_items" (
    "id" SERIAL NOT NULL,
    "rfq_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "rfq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."rfq_suppliers" (
    "id" SERIAL NOT NULL,
    "rfq_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "supplier_name_snapshot" TEXT NOT NULL,

    CONSTRAINT "rfq_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."supplier_quotations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "supplier_quotation_number" TEXT,
    "rfq_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "vendor_name_snapshot" TEXT NOT NULL,
    "vendor_gstin_snapshot" TEXT,
    "quotation_date" DATE NOT NULL,
    "valid_until" DATE,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."supplier_quotation_items" (
    "id" SERIAL NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "promised_delivery_date" DATE,
    "notes" TEXT,

    CONSTRAINT "supplier_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."quotation_comparisons" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "rfq_id" INTEGER NOT NULL,
    "quotation_ids" INTEGER[],
    "selected_quotation_ids" INTEGER[],
    "selected_by" INTEGER,
    "selected_at" TIMESTAMP(3),
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."purchase_orders" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "po_number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "vendor_name_snapshot" TEXT NOT NULL,
    "vendor_gstin_snapshot" TEXT,
    "rfq_id" INTEGER,
    "quotation_id" INTEGER,
    "po_date" DATE NOT NULL,
    "expected_delivery_date" DATE,
    "warehouse_id" INTEGER NOT NULL,
    "delivery_location" TEXT,
    "payment_terms" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approved_by" INTEGER,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "incoming_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."purchase_order_items" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "received_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."goods_receipts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "grn_number" TEXT NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "vendor_name_snapshot" TEXT NOT NULL,
    "receipt_date" DATE NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "received_by" INTEGER,
    "received_by_name" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."goods_receipt_items" (
    "id" SERIAL NOT NULL,
    "goods_receipt_id" INTEGER NOT NULL,
    "purchase_order_item_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "ordered_quantity" DECIMAL(14,3) NOT NULL,
    "previously_received_quantity" DECIMAL(14,3) NOT NULL,
    "receiving_quantity" DECIMAL(14,3) NOT NULL,
    "rejected_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(14,3) NOT NULL,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],
    "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_requisitions_organization_id_status_idx" ON "scm"."purchase_requisitions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_organization_id_requisition_number_key" ON "scm"."purchase_requisitions"("organization_id", "requisition_number");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_requisition_id_idx" ON "scm"."purchase_requisition_items"("requisition_id");

-- CreateIndex
CREATE INDEX "rfqs_organization_id_status_idx" ON "scm"."rfqs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_organization_id_rfq_number_key" ON "scm"."rfqs"("organization_id", "rfq_number");

-- CreateIndex
CREATE INDEX "rfq_items_rfq_id_idx" ON "scm"."rfq_items"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_suppliers_rfq_id_supplier_id_key" ON "scm"."rfq_suppliers"("rfq_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_quotations_organization_id_rfq_id_idx" ON "scm"."supplier_quotations"("organization_id", "rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotations_organization_id_quotation_number_key" ON "scm"."supplier_quotations"("organization_id", "quotation_number");

-- CreateIndex
CREATE INDEX "supplier_quotation_items_quotation_id_idx" ON "scm"."supplier_quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_comparisons_organization_id_rfq_id_idx" ON "scm"."quotation_comparisons"("organization_id", "rfq_id");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_status_idx" ON "scm"."purchase_orders"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_po_number_key" ON "scm"."purchase_orders"("organization_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "scm"."purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_organization_id_purchase_order_id_idx" ON "scm"."goods_receipts"("organization_id", "purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_organization_id_grn_number_key" ON "scm"."goods_receipts"("organization_id", "grn_number");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "scm"."goods_receipt_items"("goods_receipt_id");

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "scm"."purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfqs" ADD CONSTRAINT "rfqs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfqs" ADD CONSTRAINT "rfqs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfqs" ADD CONSTRAINT "rfqs_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "scm"."purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "scm"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfq_items" ADD CONSTRAINT "rfq_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "scm"."rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "scm"."rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_quotations" ADD CONSTRAINT "supplier_quotations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "scm"."supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quotation_comparisons" ADD CONSTRAINT "quotation_comparisons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."quotation_comparisons" ADD CONSTRAINT "quotation_comparisons_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "scm"."rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "scm"."rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_orders" ADD CONSTRAINT "purchase_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "scm"."supplier_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "scm"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "scm"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "scm"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "scm"."goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "scm"."purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Business invariants the application also enforces.
ALTER TABLE "scm"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_check"
  CHECK ("received_quantity" >= 0 AND "received_quantity" <= "quantity");
ALTER TABLE "scm"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_qty_check"
  CHECK ("receiving_quantity" >= 0 AND "rejected_quantity" >= 0 AND "rejected_quantity" <= "receiving_quantity");
-- A quotation may back at most one live (non-cancelled) purchase order.
CREATE UNIQUE INDEX "purchase_orders_quotation_live_key"
  ON "scm"."purchase_orders" ("quotation_id")
  WHERE "quotation_id" IS NOT NULL AND "status" <> 'CANCELLED';
-- A requisition converts into at most one live RFQ.
CREATE UNIQUE INDEX "rfqs_requisition_live_key"
  ON "scm"."rfqs" ("requisition_id")
  WHERE "requisition_id" IS NOT NULL AND "status" <> 'CANCELLED';
