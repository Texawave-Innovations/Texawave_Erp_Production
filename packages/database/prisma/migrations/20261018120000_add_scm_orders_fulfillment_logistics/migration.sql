-- CreateTable
CREATE TABLE "scm"."customers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "customer_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "gstin" TEXT,
    "billing_address" TEXT,
    "shipping_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."sales_orders" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "so_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "ship_to_address" TEXT,
    "bill_to_address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shipped_status" TEXT NOT NULL DEFAULT 'Not Shipped',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."sales_order_items" (
    "id" SERIAL NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_description" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "sales_qty" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."fulfillments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "fulfillment_number" TEXT NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "sales_order_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "delivery_status" TEXT NOT NULL DEFAULT 'NOT_DELIVERED',
    "delivered_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."fulfillment_items" (
    "id" SERIAL NOT NULL,
    "fulfillment_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "sales_order_item_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_description" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "ordered_qty" DECIMAL(14,3) NOT NULL,
    "reserved_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "issued_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "fulfillment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."pickings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "pick_number" TEXT NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "sales_order_number" TEXT NOT NULL,
    "fulfillment_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "picker_id" INTEGER,
    "picker_name" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "stock_issued_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."picking_items" (
    "id" SERIAL NOT NULL,
    "picking_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "requested_quantity" DECIMAL(14,3) NOT NULL,
    "picked_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "source_location_id" INTEGER,
    "batch_id" INTEGER,
    "serial_numbers" TEXT[],
    "notes" TEXT,

    CONSTRAINT "picking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."packings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "pack_number" TEXT NOT NULL,
    "picking_id" INTEGER NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "sales_order_number" TEXT NOT NULL,
    "fulfillment_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "packer_id" INTEGER,
    "packer_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."packing_packages" (
    "id" SERIAL NOT NULL,
    "packing_id" INTEGER NOT NULL,
    "package_number" TEXT NOT NULL,
    "package_type" TEXT,
    "weight" DECIMAL(14,3),
    "length" DECIMAL(14,3),
    "width" DECIMAL(14,3),
    "height" DECIMAL(14,3),
    "notes" TEXT,

    CONSTRAINT "packing_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."packing_package_items" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "packing_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."carriers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "carrier_code" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "service_types" TEXT[],
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "tracking_url_template" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."shipments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "fulfillment_id" INTEGER NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "sales_order_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "packages" JSONB NOT NULL,
    "total_packages" INTEGER NOT NULL,
    "total_weight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "shipping_address" TEXT NOT NULL,
    "billing_address" TEXT,
    "carrier_id" INTEGER,
    "carrier_name" TEXT,
    "service_type" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "shipping_cost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'READY_TO_SHIP',
    "shipment_date" DATE,
    "expected_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "recipient_name" TEXT,
    "delivery_notes" TEXT,
    "proof_of_delivery_url" TEXT,
    "carrier_assigned_by" INTEGER,
    "carrier_assigned_at" TIMESTAMP(3),
    "dispatched_by" INTEGER,
    "dispatched_at" TIMESTAMP(3),
    "delivered_by" INTEGER,
    "delivered_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."shipment_packings" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "packing_id" INTEGER NOT NULL,

    CONSTRAINT "shipment_packings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."shipment_tracking_events" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."shipment_exceptions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "exception_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "scm"."customers"("organization_id", "customer_code");

-- CreateIndex
CREATE INDEX "sales_orders_organization_id_status_idx" ON "scm"."sales_orders"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_organization_id_so_number_key" ON "scm"."sales_orders"("organization_id", "so_number");

-- CreateIndex
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "scm"."sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "fulfillments_organization_id_status_idx" ON "scm"."fulfillments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "fulfillments_sales_order_id_idx" ON "scm"."fulfillments"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillments_organization_id_fulfillment_number_key" ON "scm"."fulfillments"("organization_id", "fulfillment_number");

-- CreateIndex
CREATE INDEX "fulfillment_items_fulfillment_id_idx" ON "scm"."fulfillment_items"("fulfillment_id");

-- CreateIndex
CREATE INDEX "pickings_organization_id_status_idx" ON "scm"."pickings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "pickings_fulfillment_id_idx" ON "scm"."pickings"("fulfillment_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickings_organization_id_pick_number_key" ON "scm"."pickings"("organization_id", "pick_number");

-- CreateIndex
CREATE INDEX "picking_items_picking_id_idx" ON "scm"."picking_items"("picking_id");

-- CreateIndex
CREATE INDEX "packings_organization_id_status_idx" ON "scm"."packings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "packings_fulfillment_id_idx" ON "scm"."packings"("fulfillment_id");

-- CreateIndex
CREATE UNIQUE INDEX "packings_organization_id_pack_number_key" ON "scm"."packings"("organization_id", "pack_number");

-- CreateIndex
CREATE INDEX "packing_packages_packing_id_idx" ON "scm"."packing_packages"("packing_id");

-- CreateIndex
CREATE INDEX "packing_package_items_package_id_idx" ON "scm"."packing_package_items"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "carriers_organization_id_carrier_code_key" ON "scm"."carriers"("organization_id", "carrier_code");

-- CreateIndex
CREATE INDEX "shipments_organization_id_status_idx" ON "scm"."shipments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "shipments_fulfillment_id_idx" ON "scm"."shipments"("fulfillment_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_organization_id_shipment_number_key" ON "scm"."shipments"("organization_id", "shipment_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_packings_shipment_id_packing_id_key" ON "scm"."shipment_packings"("shipment_id", "packing_id");

-- CreateIndex
CREATE INDEX "shipment_tracking_events_shipment_id_event_time_idx" ON "scm"."shipment_tracking_events"("shipment_id", "event_time");

-- CreateIndex
CREATE INDEX "shipment_exceptions_shipment_id_idx" ON "scm"."shipment_exceptions"("shipment_id");

-- AddForeignKey
ALTER TABLE "scm"."stock_reservations" ADD CONSTRAINT "stock_reservations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_reservations" ADD CONSTRAINT "stock_reservations_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_source_sales_order_id_fkey" FOREIGN KEY ("source_sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."sales_orders" ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "scm"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillments" ADD CONSTRAINT "fulfillments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillments" ADD CONSTRAINT "fulfillments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillments" ADD CONSTRAINT "fulfillments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "scm"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillments" ADD CONSTRAINT "fulfillments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillment_items" ADD CONSTRAINT "fulfillment_items_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillment_items" ADD CONSTRAINT "fulfillment_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "scm"."sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."fulfillment_items" ADD CONSTRAINT "fulfillment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."pickings" ADD CONSTRAINT "pickings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."pickings" ADD CONSTRAINT "pickings_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."pickings" ADD CONSTRAINT "pickings_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."pickings" ADD CONSTRAINT "pickings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."picking_items" ADD CONSTRAINT "picking_items_picking_id_fkey" FOREIGN KEY ("picking_id") REFERENCES "scm"."pickings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."picking_items" ADD CONSTRAINT "picking_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packings" ADD CONSTRAINT "packings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packings" ADD CONSTRAINT "packings_picking_id_fkey" FOREIGN KEY ("picking_id") REFERENCES "scm"."pickings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packings" ADD CONSTRAINT "packings_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packings" ADD CONSTRAINT "packings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packing_packages" ADD CONSTRAINT "packing_packages_packing_id_fkey" FOREIGN KEY ("packing_id") REFERENCES "scm"."packings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packing_package_items" ADD CONSTRAINT "packing_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "scm"."packing_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."packing_package_items" ADD CONSTRAINT "packing_package_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."carriers" ADD CONSTRAINT "carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "scm"."fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "scm"."sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "scm"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipments" ADD CONSTRAINT "shipments_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "scm"."carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipment_packings" ADD CONSTRAINT "shipment_packings_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "scm"."shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipment_packings" ADD CONSTRAINT "shipment_packings_packing_id_fkey" FOREIGN KEY ("packing_id") REFERENCES "scm"."packings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "scm"."shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."shipment_exceptions" ADD CONSTRAINT "shipment_exceptions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "scm"."shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Shipment timeline is append-only, like audit_logs.
CREATE TRIGGER "shipment_tracking_events_no_update_delete"
  BEFORE UPDATE OR DELETE ON "scm"."shipment_tracking_events"
  FOR EACH ROW EXECUTE FUNCTION "platform"."prevent_row_mutation"();
CREATE TRIGGER "shipment_tracking_events_no_truncate"
  BEFORE TRUNCATE ON "scm"."shipment_tracking_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform"."prevent_row_mutation"();

-- Quantity invariants the application also enforces.
ALTER TABLE "scm"."fulfillment_items" ADD CONSTRAINT "fulfillment_items_qty_check"
  CHECK ("reserved_qty" >= 0 AND "reserved_qty" <= "ordered_qty" AND "issued_qty" >= 0 AND "issued_qty" <= "reserved_qty");
ALTER TABLE "scm"."picking_items" ADD CONSTRAINT "picking_items_qty_check"
  CHECK ("picked_quantity" >= 0 AND "picked_quantity" <= "requested_quantity");
