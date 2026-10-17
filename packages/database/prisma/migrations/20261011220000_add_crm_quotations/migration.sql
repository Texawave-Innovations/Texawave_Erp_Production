-- CreateTable
CREATE TABLE "crm"."quotations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "opportunity_id" INTEGER,
    "contact_id" INTEGER,
    "quotation_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "quote_owner" TEXT,
    "currency" TEXT DEFAULT 'INR',
    "quote_date" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "customer_reference" TEXT,
    "billing_street" TEXT,
    "billing_city" TEXT,
    "billing_state" TEXT,
    "billing_postal_code" TEXT,
    "billing_country" TEXT,
    "shipping_street" TEXT,
    "shipping_city" TEXT,
    "shipping_state" TEXT,
    "shipping_postal_code" TEXT,
    "shipping_country" TEXT,
    "carrier" TEXT,
    "delivery_notes" TEXT,
    "terms_conditions" TEXT,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."quotation_line_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_code" TEXT,
    "description" TEXT NOT NULL,
    "uom" TEXT,
    "quantity" DECIMAL(14,2) NOT NULL,
    "list_price" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_amount" DECIMAL(14,2),
    "tax_percent" DECIMAL(5,2),
    "tax_amount" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "line_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotations_organization_id_idx" ON "crm"."quotations"("organization_id");

-- CreateIndex
CREATE INDEX "quotations_account_id_idx" ON "crm"."quotations"("account_id");

-- CreateIndex
CREATE INDEX "quotations_opportunity_id_idx" ON "crm"."quotations"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organization_id_quotation_number_key" ON "crm"."quotations"("organization_id", "quotation_number");

-- CreateIndex
CREATE INDEX "quotation_line_items_organization_id_idx" ON "crm"."quotation_line_items"("organization_id");

-- CreateIndex
CREATE INDEX "quotation_line_items_quotation_id_idx" ON "crm"."quotation_line_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_line_items_product_id_idx" ON "crm"."quotation_line_items"("product_id");

-- AddForeignKey
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotation_line_items" ADD CONSTRAINT "quotation_line_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "crm"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."quotation_line_items" ADD CONSTRAINT "quotation_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "crm"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

