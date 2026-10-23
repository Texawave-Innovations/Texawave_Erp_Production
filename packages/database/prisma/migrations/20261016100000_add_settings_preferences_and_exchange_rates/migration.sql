-- CreateTable
CREATE TABLE "platform"."organization_settings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "country" TEXT NOT NULL DEFAULT 'IN',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "time_format" TEXT NOT NULL DEFAULT '12h',
    "base_currency" TEXT NOT NULL DEFAULT 'INR',
    "currency_symbol_position" TEXT NOT NULL DEFAULT 'before',
    "number_format" TEXT NOT NULL DEFAULT 'indian',
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 4,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."user_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "theme" TEXT,
    "density" TEXT,
    "locale" TEXT,
    "timezone" TEXT,
    "date_format" TEXT,
    "time_format" TEXT,
    "display_currency" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."exchange_rates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "from_currency" VARCHAR(3) NOT NULL,
    "to_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source" VARCHAR(64) NOT NULL DEFAULT 'manual',
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "platform"."organization_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "platform"."user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_preferences_organization_id_idx" ON "platform"."user_preferences"("organization_id");

-- CreateIndex
CREATE INDEX "exchange_rates_organization_id_from_currency_to_currency_idx" ON "platform"."exchange_rates"("organization_id", "from_currency", "to_currency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_organization_id_from_currency_to_currency_ef_key" ON "platform"."exchange_rates"("organization_id", "from_currency", "to_currency", "effective_date");

-- AddForeignKey
ALTER TABLE "platform"."organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_preferences" ADD CONSTRAINT "user_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."exchange_rates" ADD CONSTRAINT "exchange_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

