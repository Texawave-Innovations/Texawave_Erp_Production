-- CreateTable
CREATE TABLE "crm"."products" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT,
    "vendor" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(5,2),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields" JSONB,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."opportunity_products" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "tax_percent" DECIMAL(5,2),
    "total" DECIMAL(14,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "opportunity_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "crm"."products"("organization_id");

-- CreateIndex
CREATE INDEX "opportunity_products_organization_id_idx" ON "crm"."opportunity_products"("organization_id");

-- CreateIndex
CREATE INDEX "opportunity_products_opportunity_id_idx" ON "crm"."opportunity_products"("opportunity_id");

-- CreateIndex
CREATE INDEX "opportunity_products_product_id_idx" ON "crm"."opportunity_products"("product_id");

-- AddForeignKey
ALTER TABLE "crm"."products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_products" ADD CONSTRAINT "opportunity_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_products" ADD CONSTRAINT "opportunity_products_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."opportunity_products" ADD CONSTRAINT "opportunity_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "crm"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

