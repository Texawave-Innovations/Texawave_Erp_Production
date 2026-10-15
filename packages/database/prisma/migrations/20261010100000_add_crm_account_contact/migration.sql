-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateTable
CREATE TABLE "crm"."accounts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "name" TEXT NOT NULL,
    "custom_fields" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."contacts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_decision_maker" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_organization_id_idx" ON "crm"."accounts"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_organization_id_team_id_idx" ON "crm"."accounts"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_idx" ON "crm"."contacts"("organization_id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_team_id_idx" ON "crm"."contacts"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "contacts_account_id_idx" ON "crm"."contacts"("account_id");

-- AddForeignKey
ALTER TABLE "crm"."accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."accounts" ADD CONSTRAINT "accounts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."contacts" ADD CONSTRAINT "contacts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."contacts" ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

