-- Per-user notification preferences. First use: Do Not Disturb (snooze), which
-- only quiets the bell badge; notifications are still created and stored.

-- CreateTable
CREATE TABLE "platform"."notification_preferences" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "dnd_until" TIMESTAMPTZ(6),
    "dnd_indefinite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "platform"."notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "platform"."notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- "Until I turn it off" and a timed snooze are mutually exclusive.
ALTER TABLE "platform"."notification_preferences" ADD CONSTRAINT "notification_preferences_dnd_check"
  CHECK (NOT ("dnd_indefinite" AND "dnd_until" IS NOT NULL));
