-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "holiday_date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "work_location_id" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_off_rules" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "days_of_week" INTEGER[],
    "work_location_id" INTEGER,
    "team_id" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "weekly_off_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holidays_organization_id_holiday_date_idx" ON "holidays"("organization_id", "holiday_date");

-- CreateIndex
CREATE INDEX "weekly_off_rules_organization_id_effective_from_idx" ON "weekly_off_rules"("organization_id", "effective_from");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- holidays -------------------------------------------------------------------
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_name_not_blank_check"
  CHECK (btrim("name") <> '');

-- At most ONE active holiday per date per scope. NULL work_location_id (the
-- whole organization) needs its own index because NULLs are never equal in a
-- plain UNIQUE. Deactivated rows are ignored so a wrong entry can be replaced.
CREATE UNIQUE INDEX "holidays_org_date_all_locations_key"
  ON "holidays" ("organization_id", "holiday_date")
  WHERE "work_location_id" IS NULL AND "is_active";
CREATE UNIQUE INDEX "holidays_org_date_location_key"
  ON "holidays" ("organization_id", "holiday_date", "work_location_id")
  WHERE "work_location_id" IS NOT NULL AND "is_active";

-- weekly_off_rules -----------------------------------------------------------
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_name_not_blank_check"
  CHECK (btrim("name") <> '');

-- ISO weekdays 1..7, at least one, at most seven entries.
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_days_check"
  CHECK (cardinality("days_of_week") BETWEEN 1 AND 7
     AND "days_of_week" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]);

-- One scope: the whole organization (both NULL), one location, OR one team.
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_one_scope_check"
  CHECK ("work_location_id" IS NULL OR "team_id" IS NULL);

ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_dates_check"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

-- Two ACTIVE rules of the same scope may not cover a common day. COALESCE(…, 0)
-- makes "no location / no team" comparable (NULL = NULL is not true). Adjacent
-- ranges are fine; voided rules are ignored. Holds under concurrent requests.
ALTER TABLE "weekly_off_rules" ADD CONSTRAINT "weekly_off_rules_scope_no_overlap"
  EXCLUDE USING gist (
    "organization_id" WITH =,
    (COALESCE("work_location_id", 0)) WITH =,
    (COALESCE("team_id", 0)) WITH =,
    daterange("effective_from", "effective_to", '[]') WITH &&
  ) WHERE ("is_active");
