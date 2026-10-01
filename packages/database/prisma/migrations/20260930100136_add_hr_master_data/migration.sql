-- CreateTable
CREATE TABLE "designations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_types" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "probation_days" INTEGER,
    "notice_days" INTEGER,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_locations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designations_organization_id_idx" ON "designations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "designations_organization_id_code_key" ON "designations"("organization_id", "code");

-- CreateIndex
CREATE INDEX "employment_types_organization_id_idx" ON "employment_types"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employment_types_organization_id_code_key" ON "employment_types"("organization_id", "code");

-- CreateIndex
CREATE INDEX "work_locations_organization_id_idx" ON "work_locations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_locations_organization_id_code_key" ON "work_locations"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_types" ADD CONSTRAINT "employment_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- Codes are upper-case identifiers; names are non-blank. The API validates the
-- same rules, but the database is the last line of defence.
ALTER TABLE "designations" ADD CONSTRAINT "designations_code_format_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,29}$');
ALTER TABLE "designations" ADD CONSTRAINT "designations_name_not_blank_check"
  CHECK (btrim("name") <> '');
ALTER TABLE "employment_types" ADD CONSTRAINT "employment_types_code_format_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,29}$');
ALTER TABLE "employment_types" ADD CONSTRAINT "employment_types_name_not_blank_check"
  CHECK (btrim("name") <> '');
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_code_format_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,29}$');
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_name_not_blank_check"
  CHECK (btrim("name") <> '');

-- Probation/notice are optional and not interpreted anywhere yet (open
-- business decision); when present they must at least be sane.
ALTER TABLE "employment_types" ADD CONSTRAINT "employment_types_days_check"
  CHECK (("probation_days" IS NULL OR "probation_days" BETWEEN 0 AND 3650)
     AND ("notice_days" IS NULL OR "notice_days" BETWEEN 0 AND 3650));

-- "Engineering" and "engineering " must not coexist in one organization.
CREATE UNIQUE INDEX "designations_org_lower_name_key"
  ON "designations" ("organization_id", lower("name"));
CREATE UNIQUE INDEX "employment_types_org_lower_name_key"
  ON "employment_types" ("organization_id", lower("name"));
CREATE UNIQUE INDEX "work_locations_org_lower_name_key"
  ON "work_locations" ("organization_id", lower("name"));

-- Approved starting set of employment types, for every organization that
-- already exists. Insert-only and idempotent (never overwrites an existing
-- row), so re-running or hand-edited data is safe. Probation/notice are left
-- NULL: those rules are not approved yet.
INSERT INTO "employment_types" ("organization_id", "code", "name", "updated_at")
SELECT o."id", v."code", v."name", CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES
  ('PERMANENT', 'Permanent'),
  ('CONTRACT',  'Contract'),
  ('TEMPORARY', 'Temporary'),
  ('INTERN',    'Intern')
) AS v("code", "name")
ON CONFLICT ("organization_id", "code") DO NOTHING;
