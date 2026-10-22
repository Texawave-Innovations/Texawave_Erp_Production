-- CreateTable
CREATE TABLE "scm"."location_stock" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "location_id" INTEGER NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."putaways" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "putaway_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "grn_id" INTEGER,
    "grn_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,

    CONSTRAINT "putaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."putaway_items" (
    "id" SERIAL NOT NULL,
    "putaway_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "destination_location_id" INTEGER,
    "put_away_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "batch_id" INTEGER,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],
    "notes" TEXT,

    CONSTRAINT "putaway_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."warehouse_movements" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "movement_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,

    CONSTRAINT "warehouse_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm"."warehouse_movement_items" (
    "id" SERIAL NOT NULL,
    "movement_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "source_location_id" INTEGER NOT NULL,
    "destination_location_id" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "batch_number" TEXT,
    "serial_numbers" TEXT[],

    CONSTRAINT "warehouse_movement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "location_stock_product_id_warehouse_id_location_id_key" ON "scm"."location_stock"("product_id", "warehouse_id", "location_id");

-- CreateIndex
CREATE INDEX "putaways_organization_id_status_idx" ON "scm"."putaways"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "putaways_organization_id_putaway_number_key" ON "scm"."putaways"("organization_id", "putaway_number");

-- CreateIndex
CREATE INDEX "putaway_items_putaway_id_idx" ON "scm"."putaway_items"("putaway_id");

-- CreateIndex
CREATE INDEX "warehouse_movements_organization_id_status_idx" ON "scm"."warehouse_movements"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_movements_organization_id_movement_number_key" ON "scm"."warehouse_movements"("organization_id", "movement_number");

-- CreateIndex
CREATE INDEX "warehouse_movement_items_movement_id_idx" ON "scm"."warehouse_movement_items"("movement_id");

-- AddForeignKey
ALTER TABLE "scm"."location_stock" ADD CONSTRAINT "location_stock_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."location_stock" ADD CONSTRAINT "location_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."location_stock" ADD CONSTRAINT "location_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."location_stock" ADD CONSTRAINT "location_stock_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "scm"."warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."putaways" ADD CONSTRAINT "putaways_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."putaways" ADD CONSTRAINT "putaways_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."putaway_items" ADD CONSTRAINT "putaway_items_putaway_id_fkey" FOREIGN KEY ("putaway_id") REFERENCES "scm"."putaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."putaway_items" ADD CONSTRAINT "putaway_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_movements" ADD CONSTRAINT "warehouse_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_movements" ADD CONSTRAINT "warehouse_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "scm"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_movement_items" ADD CONSTRAINT "warehouse_movement_items_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "scm"."warehouse_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm"."warehouse_movement_items" ADD CONSTRAINT "warehouse_movement_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "scm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
