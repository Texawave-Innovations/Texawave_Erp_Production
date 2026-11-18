-- Attendance auto check-out: an organization-level fixed cut-off (HR master) and
-- a flag on sessions the system closed, so the day stays pending until HR
-- regularizes it.

-- AlterTable
ALTER TABLE "hr"."attendance_sessions" ADD COLUMN "auto_closed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "hr"."attendance_settings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "auto_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_checkout_time" TEXT NOT NULL DEFAULT '20:00',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_settings_organization_id_key" ON "hr"."attendance_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "hr"."attendance_settings" ADD CONSTRAINT "attendance_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 24-hour HH:mm, and a positive optimistic-lock counter.
ALTER TABLE "hr"."attendance_settings" ADD CONSTRAINT "attendance_settings_time_check"
  CHECK ("auto_checkout_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "version" >= 1);
