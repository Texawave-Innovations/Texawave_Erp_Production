-- CreateTable
CREATE TABLE "hr"."employee_location_privileges" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_location_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."office_network_addresses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "office_network_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_location_privileges_employee_id_key" ON "hr"."employee_location_privileges"("employee_id");

-- CreateIndex
CREATE INDEX "employee_location_privileges_organization_id_idx" ON "hr"."employee_location_privileges"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "office_network_addresses_organization_id_ip_address_key" ON "hr"."office_network_addresses"("organization_id", "ip_address");

-- AddForeignKey
ALTER TABLE "hr"."employee_location_privileges" ADD CONSTRAINT "employee_location_privileges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_location_privileges" ADD CONSTRAINT "employee_location_privileges_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."office_network_addresses" ADD CONSTRAINT "office_network_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma cannot express.

-- Mode is one of the two values the attendance gate understands. Anything else
-- would silently fall through to the strict OFFICE rule in code.
ALTER TABLE "hr"."employee_location_privileges"
  ADD CONSTRAINT "employee_location_privileges_mode_check"
  CHECK ("mode" IN ('OFFICE', 'REMOTE'));

-- An allowlist entry must carry a real address, not a blank string.
ALTER TABLE "hr"."office_network_addresses"
  ADD CONSTRAINT "office_network_addresses_ip_not_blank_check"
  CHECK (length(btrim("ip_address")) > 0);
