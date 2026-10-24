-- CreateTable
CREATE TABLE "scm"."scm_master_list_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numeric_value" DECIMAL(10,4),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "scm_master_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_master_list_items_organization_id_category_idx" ON "scm"."scm_master_list_items"("organization_id", "category");

-- AddForeignKey
ALTER TABLE "scm"."scm_master_list_items" ADD CONSTRAINT "scm_master_list_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
