-- CreateTable
CREATE TABLE "scm"."number_sequences" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."products" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "hsn" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(14,3),
    "minimum_stock" DECIMAL(14,3),
    "maximum_stock" DECIMAL(14,3),
    "batch_tracked" BOOLEAN NOT NULL DEFAULT false,
    "serial_tracked" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."warehouses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Main',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "manager_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "capacity" DECIMAL(14,3),
    "capacity_unit" TEXT,
    "operating_hours" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."warehouse_locations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "parent_location_id" INTEGER,
    "location_type" TEXT,
    "location_code" TEXT,
    "zone" TEXT,
    "rack" TEXT,
    "shelf" TEXT,
    "bin_code" TEXT NOT NULL,
    "location_name" TEXT,
    "capacity" DECIMAL(14,3),
    "capacity_unit" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_balances" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "incoming" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "damaged" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quarantine" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_ledger" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "batch_id" INTEGER,
    "serial_id" INTEGER,
    "transaction_type" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" INTEGER,
    "reference_number" TEXT,
    "quantity_in" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quantity_out" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(14,2),
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_batches" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."serial_numbers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "serial_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "current_reference" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_reservations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "sales_order_id" INTEGER,
    "sales_order_number" TEXT,
    "fulfillment_id" INTEGER,
    "quantity" DECIMAL(14,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_by" INTEGER,
    "released_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_transfers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "source_warehouse_id" INTEGER NOT NULL,
    "source_location_id" INTEGER,
    "destination_warehouse_id" INTEGER NOT NULL,
    "destination_location_id" INTEGER,
    "quantity" DECIMAL(14,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "dispatched_by" INTEGER,
    "received_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."stock_adjustments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "adjustment_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "quantity" DECIMAL(14,3) NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_organization_id_prefix_fiscal_year_key" ON "scm"."number_sequences"("organization_id", "prefix", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_product_code_key" ON "scm"."products"("organization_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "scm"."warehouses"("organization_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_locations_organization_id_warehouse_id_idx" ON "scm"."warehouse_locations"("organization_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_warehouse_id_location_code_key" ON "scm"."warehouse_locations"("warehouse_id", "location_code");

-- CreateIndex
CREATE INDEX "stock_balances_organization_id_warehouse_id_idx" ON "scm"."stock_balances"("organization_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_product_id_warehouse_id_key" ON "scm"."stock_balances"("product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_ledger_organization_id_product_id_warehouse_id_idx" ON "scm"."stock_ledger"("organization_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_ledger_organization_id_reference_type_reference_id_idx" ON "scm"."stock_ledger"("organization_id", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_ledger_organization_id_transaction_date_idx" ON "scm"."stock_ledger"("organization_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_ledger_organization_id_idempotency_key_key" ON "scm"."stock_ledger"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_organization_id_batch_number_product_id_wareh_key" ON "scm"."stock_batches"("organization_id", "batch_number", "product_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_organization_id_serial_number_key" ON "scm"."serial_numbers"("organization_id", "serial_number");

-- CreateIndex
CREATE INDEX "stock_reservations_organization_id_status_idx" ON "scm"."stock_reservations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organization_id_transfer_number_key" ON "scm"."stock_transfers"("organization_id", "transfer_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_organization_id_adjustment_number_key" ON "scm"."stock_adjustments"("organization_id", "adjustment_number");

-- AddForeignKey
ALTER TABLE "scm"."number_sequences" ADD CONSTRAINT "number_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_locations" ADD CONSTRAINT "warehouse_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_locations" ADD CONSTRAINT "warehouse_locations_parent_location_id_fkey" FOREIGN KEY ("parent_location_id") REFERENCES "scm"."warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_balances" ADD CONSTRAINT "stock_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_ledger" ADD CONSTRAINT "stock_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_ledger" ADD CONSTRAINT "stock_ledger_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_ledger" ADD CONSTRAINT "stock_ledger_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_batches" ADD CONSTRAINT "stock_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_batches" ADD CONSTRAINT "stock_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."serial_numbers" ADD CONSTRAINT "serial_numbers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."serial_numbers" ADD CONSTRAINT "serial_numbers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."serial_numbers" ADD CONSTRAINT "serial_numbers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_reservations" ADD CONSTRAINT "stock_reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_reservations" ADD CONSTRAINT "stock_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_transfers" ADD CONSTRAINT "stock_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_transfers" ADD CONSTRAINT "stock_transfers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_transfers" ADD CONSTRAINT "stock_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_transfers" ADD CONSTRAINT "stock_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stock ledger is append-only (same mechanism as audit_logs).
CREATE TRIGGER "stock_ledger_no_update_delete"
  BEFORE UPDATE OR DELETE ON "scm"."stock_ledger"
  FOR EACH ROW EXECUTE FUNCTION "platform"."prevent_row_mutation"();

CREATE TRIGGER "stock_ledger_no_truncate"
  BEFORE TRUNCATE ON "scm"."stock_ledger"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform"."prevent_row_mutation"();

-- Quantity invariants the application also enforces.
ALTER TABLE "scm"."stock_ledger" ADD CONSTRAINT "stock_ledger_qty_check"
  CHECK ("quantity_in" >= 0 AND "quantity_out" >= 0 AND ("quantity_in" > 0 OR "quantity_out" > 0));
ALTER TABLE "scm"."stock_balances" ADD CONSTRAINT "stock_balances_nonneg_check"
  CHECK ("reserved" >= 0 AND "incoming" >= 0 AND "damaged" >= 0 AND "quarantine" >= 0);
ALTER TABLE "scm"."stock_batches" ADD CONSTRAINT "stock_batches_qty_check" CHECK ("quantity" >= 0);
