-- CreateTable
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_overnight" BOOLEAN NOT NULL,
    "working_minutes" INTEGER NOT NULL,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "employee_id" INTEGER,
    "team_id" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "reason" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_organization_id_idx" ON "shifts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_organization_id_code_key" ON "shifts"("organization_id", "code");

-- CreateIndex
CREATE INDEX "shift_assignments_organization_id_shift_id_idx" ON "shift_assignments"("organization_id", "shift_id");

-- CreateIndex
CREATE INDEX "shift_assignments_organization_id_employee_id_effective_fro_idx" ON "shift_assignments"("organization_id", "employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "shift_assignments_organization_id_team_id_effective_from_idx" ON "shift_assignments"("organization_id", "team_id", "effective_from");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- Needed so integer columns can take part in GiST exclusion constraints
-- (employee_id WITH =, daterange WITH &&). Ships with PostgreSQL contrib and is
-- a "trusted" extension since PG13, so a database owner can create it. On a
-- managed service confirm it is allow-listed before deploying.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- shifts ---------------------------------------------------------------------
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_code_format_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,29}$');
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_name_not_blank_check"
  CHECK (btrim("name") <> '');

-- "HH:MM", 24-hour, zero-padded.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_time_format_check"
  CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     AND "end_time"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- A shift crosses midnight exactly when it ends earlier than it starts. Equal
-- start and end is rejected (zero-length or a full 24 h — ambiguous). "HH:MM"
-- zero-padded text compares in time order, so plain < / > is correct.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_overnight_consistency_check"
  CHECK (("is_overnight" AND "end_time" < "start_time")
      OR (NOT "is_overnight" AND "end_time" > "start_time"));

-- The working duration is positive and fits inside the shift window.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_working_minutes_check"
  CHECK ("working_minutes" >= 1
     AND "working_minutes" <=
         (CASE WHEN "is_overnight" THEN 1440 ELSE 0 END)
         + (substr("end_time", 1, 2)::int * 60 + substr("end_time", 4, 2)::int)
         - (substr("start_time", 1, 2)::int * 60 + substr("start_time", 4, 2)::int));

CREATE UNIQUE INDEX "shifts_org_lower_name_key" ON "shifts" ("organization_id", lower("name"));

-- shift_assignments ----------------------------------------------------------
-- Exactly one target: an employee OR a team.
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_one_target_check"
  CHECK (("employee_id" IS NULL) <> ("team_id" IS NULL));

ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_dates_check"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

-- No two ACTIVE assignments for the same employee (or the same team) may cover
-- a common day. Ranges are inclusive ('[]'); NULL effective_to is unbounded.
-- Adjacent ranges (one ends on the 9th, the next starts on the 10th) are fine.
-- Voided assignments (is_active = false) are ignored. Being a constraint, this
-- holds under concurrent requests — no check-then-insert race.
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("effective_from", "effective_to", '[]') WITH &&
  ) WHERE ("employee_id" IS NOT NULL AND "is_active");

ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_team_no_overlap"
  EXCLUDE USING gist (
    "team_id" WITH =,
    daterange("effective_from", "effective_to", '[]') WITH &&
  ) WHERE ("team_id" IS NOT NULL AND "is_active");
