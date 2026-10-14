-- HR employees backend gaps (Docs/HR_API.md, Employees and Profiles):
--   1. Employee fields: probation/confirmation dates, referred-by, work domain.
--   2. HR review of a submitted onboarding profile (separate from
--      onboarding_status; Docs/ARCHITECTURE.md §7).
--   3. One source of truth for personal details: the HR-only profile columns
--      move onto employee_personal_details, and the retired employee_profiles /
--      employee_sensitive_info rows are copied into the onboarding tables.
--      The retired tables are NOT dropped (dropping needs explicit approval).
--      Bank accounts need application-side encryption, so they are moved by
--      apps/api/scripts/backfill-hr-bank-details.ts, not here.
--   4. Duplicate prevention: phone, PAN and Aadhaar are unique per organization.
--   5. Organization payroll settings (salary auto-split, PF/ESI limits).

-- ---------------------------------------------------------------------------
-- 1 + 2. Employee columns
-- ---------------------------------------------------------------------------
ALTER TABLE "hr"."employees" ADD COLUMN     "confirmation_date" DATE,
ADD COLUMN     "onboarding_review_note" TEXT,
ADD COLUMN     "onboarding_review_status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "onboarding_reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN     "onboarding_reviewed_by" INTEGER,
ADD COLUMN     "onboarding_submitted_at" TIMESTAMPTZ(6),
ADD COLUMN     "probation_end_date" DATE,
ADD COLUMN     "referred_by" TEXT,
ADD COLUMN     "work_domain" TEXT;

CREATE INDEX "employees_organization_id_onboarding_review_status_idx" ON "hr"."employees"("organization_id", "onboarding_review_status");

-- Employees who completed onboarding before the review step existed are
-- treated as already approved (reviewer unknown), so the review queue starts
-- with genuinely new submissions only.
UPDATE "hr"."employees"
   SET "onboarding_review_status" = 'APPROVED'
 WHERE "onboarding_status" = 'COMPLETE';

ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_onboarding_review_status_check"
  CHECK ("onboarding_review_status" IN ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED'));

-- Sending a profile back always carries a reason the employee can act on.
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_onboarding_review_note_check"
  CHECK ("onboarding_review_status" <> 'CHANGES_REQUESTED'
         OR ("onboarding_review_note" IS NOT NULL AND btrim("onboarding_review_note") <> ''));

ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_probation_after_joining_check"
  CHECK ("probation_end_date" IS NULL OR "probation_end_date" >= "date_of_joining");

ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_confirmation_after_joining_check"
  CHECK ("confirmation_date" IS NULL OR "confirmation_date" >= "date_of_joining");

ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_new_text_not_blank_check"
  CHECK (("referred_by" IS NULL OR btrim("referred_by") <> '')
     AND ("work_domain" IS NULL OR btrim("work_domain") <> ''));

-- ---------------------------------------------------------------------------
-- 3. Personal details: new columns, then copy the retired profile rows
-- ---------------------------------------------------------------------------
ALTER TABLE "hr"."employee_personal_details" ADD COLUMN     "experience_years" DECIMAL(4,1),
ADD COLUMN     "is_fresher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "previous_company" TEXT,
ADD COLUMN     "previous_role" TEXT,
ADD COLUMN     "spouse_name" TEXT,
ADD COLUMN     "title" TEXT;

ALTER TABLE "hr"."employee_personal_details"
  ADD CONSTRAINT "employee_personal_details_experience_range_check"
  CHECK ("experience_years" IS NULL OR ("experience_years" >= 0 AND "experience_years" <= 60));

ALTER TABLE "hr"."employee_addresses" ADD COLUMN     "country" TEXT,
ALTER COLUMN "district" DROP NOT NULL;

-- HR profiles stored gender / marital status / blood group as free text; the
-- onboarding wizard uses fixed codes. Known spellings are mapped to the codes,
-- anything else is copied as it was.
CREATE FUNCTION "pg_temp"."hr_gender_code"(v TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(btrim(v))
    WHEN 'MALE' THEN 'MALE' WHEN 'M' THEN 'MALE'
    WHEN 'FEMALE' THEN 'FEMALE' WHEN 'F' THEN 'FEMALE'
    WHEN 'OTHER' THEN 'OTHER'
    ELSE v END
$$;
CREATE FUNCTION "pg_temp"."hr_marital_code"(v TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(btrim(v))
    WHEN 'SINGLE' THEN 'SINGLE' WHEN 'UNMARRIED' THEN 'SINGLE'
    WHEN 'MARRIED' THEN 'MARRIED'
    WHEN 'OTHER' THEN 'OTHER'
    ELSE v END
$$;

-- Where both rows exist, what the employee entered during onboarding wins and
-- the HR value only fills gaps. The HR-only columns are new, so they are copied.
INSERT INTO "hr"."employee_personal_details" (
  "organization_id", "team_id", "employee_id",
  "title", "languages", "spouse_name", "is_fresher", "experience_years",
  "previous_company", "previous_role",
  "date_of_birth", "gender", "marital_status", "blood_group",
  "father_name", "mother_name",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
  "created_by", "updated_by", "created_at", "updated_at")
SELECT ep."organization_id", e."team_id", ep."employee_id",
       ep."title", ep."languages", ep."spouse_name", ep."is_fresher", ep."experience_years",
       ep."previous_company", ep."previous_role",
       ep."date_of_birth", "pg_temp"."hr_gender_code"(ep."gender"),
       "pg_temp"."hr_marital_code"(ep."marital_status"), upper(btrim(ep."blood_group")),
       ep."father_name", ep."mother_name",
       ep."emergency_contact_name", ep."emergency_contact_phone", ep."emergency_contact_relation",
       ep."created_by", ep."updated_by", ep."created_at", ep."updated_at"
  FROM "hr"."employee_profiles" ep
  JOIN "hr"."employees" e ON e."id" = ep."employee_id"
ON CONFLICT ("employee_id") DO UPDATE SET
  "title"            = EXCLUDED."title",
  "languages"        = EXCLUDED."languages",
  "spouse_name"      = EXCLUDED."spouse_name",
  "is_fresher"       = EXCLUDED."is_fresher",
  "experience_years" = EXCLUDED."experience_years",
  "previous_company" = EXCLUDED."previous_company",
  "previous_role"    = EXCLUDED."previous_role",
  "date_of_birth"    = COALESCE("employee_personal_details"."date_of_birth", EXCLUDED."date_of_birth"),
  "gender"           = COALESCE("employee_personal_details"."gender", EXCLUDED."gender"),
  "marital_status"   = COALESCE("employee_personal_details"."marital_status", EXCLUDED."marital_status"),
  "blood_group"      = COALESCE("employee_personal_details"."blood_group", EXCLUDED."blood_group"),
  "father_name"      = COALESCE("employee_personal_details"."father_name", EXCLUDED."father_name"),
  "mother_name"      = COALESCE("employee_personal_details"."mother_name", EXCLUDED."mother_name"),
  "emergency_contact_name"     = COALESCE("employee_personal_details"."emergency_contact_name", EXCLUDED."emergency_contact_name"),
  "emergency_contact_phone"    = COALESCE("employee_personal_details"."emergency_contact_phone", EXCLUDED."emergency_contact_phone"),
  "emergency_contact_relation" = COALESCE("employee_personal_details"."emergency_contact_relation", EXCLUDED."emergency_contact_relation");

-- Addresses: the retired table held JSON objects ({address, area, district,
-- city, state, pincode, country}). Copied only where the employee has no row of
-- that type yet, and only when the required parts are present.
INSERT INTO "hr"."employee_addresses" (
  "organization_id", "team_id", "employee_id", "address_type",
  "address_line", "area_locality", "district", "city", "state", "pincode", "country",
  "created_by", "updated_by", "created_at", "updated_at")
SELECT ep."organization_id", e."team_id", ep."employee_id", a."address_type",
       a."doc"->>'address', NULLIF(a."doc"->>'area', ''), NULLIF(a."doc"->>'district', ''),
       a."doc"->>'city', a."doc"->>'state', a."doc"->>'pincode', NULLIF(a."doc"->>'country', ''),
       ep."created_by", ep."updated_by", ep."created_at", ep."updated_at"
  FROM "hr"."employee_profiles" ep
  JOIN "hr"."employees" e ON e."id" = ep."employee_id"
  CROSS JOIN LATERAL (VALUES ('PERMANENT', ep."permanent_address"),
                             ('PRESENT', ep."present_address")) AS a("address_type", "doc")
 WHERE a."doc" IS NOT NULL
   AND COALESCE(a."doc"->>'address', '') <> ''
   AND COALESCE(a."doc"->>'city', '') <> ''
   AND COALESCE(a."doc"->>'state', '') <> ''
   AND COALESCE(a."doc"->>'pincode', '') <> ''
ON CONFLICT ("employee_id", "address_type") DO NOTHING;

-- Government identifiers: same rule, onboarding values win.
INSERT INTO "hr"."employee_government_ids" (
  "organization_id", "team_id", "employee_id",
  "pan_number", "aadhaar_number", "esi_number", "pf_number",
  "created_by", "updated_by", "created_at", "updated_at")
SELECT si."organization_id", e."team_id", si."employee_id",
       upper(si."pan_number"), si."aadhaar_number", si."esi_number", si."pf_number",
       si."created_by", si."updated_by", si."created_at", si."updated_at"
  FROM "hr"."employee_sensitive_info" si
  JOIN "hr"."employees" e ON e."id" = si."employee_id"
 WHERE COALESCE(si."pan_number", si."aadhaar_number", si."esi_number", si."pf_number") IS NOT NULL
ON CONFLICT ("employee_id") DO UPDATE SET
  "pan_number"     = COALESCE("employee_government_ids"."pan_number", EXCLUDED."pan_number"),
  "aadhaar_number" = COALESCE("employee_government_ids"."aadhaar_number", EXCLUDED."aadhaar_number"),
  "esi_number"     = COALESCE("employee_government_ids"."esi_number", EXCLUDED."esi_number"),
  "pf_number"      = COALESCE("employee_government_ids"."pf_number", EXCLUDED."pf_number");

-- ---------------------------------------------------------------------------
-- 4. Duplicate prevention
-- ---------------------------------------------------------------------------
-- Fail with a readable list instead of a bare unique-violation if existing
-- data already has duplicates; HR must resolve them before this migration.
DO $$
DECLARE
  dupes TEXT;
BEGIN
  SELECT string_agg(format('org %s phone %s (employees %s)', org, digits, ids), '; ')
    INTO dupes
    FROM (SELECT "organization_id" AS org,
                 regexp_replace("phone", '\D', '', 'g') AS digits,
                 string_agg("employee_code", ', ' ORDER BY "employee_code") AS ids
            FROM "hr"."employees"
           WHERE "phone" IS NOT NULL AND "deleted_at" IS NULL
           GROUP BY 1, 2 HAVING count(*) > 1) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate employee phone numbers must be fixed first: %', dupes;
  END IF;

  SELECT string_agg(format('org %s PAN %s (employee ids %s)', org, pan, ids), '; ')
    INTO dupes
    FROM (SELECT "organization_id" AS org, upper("pan_number") AS pan,
                 string_agg("employee_id"::TEXT, ', ' ORDER BY "employee_id") AS ids
            FROM "hr"."employee_government_ids"
           WHERE "pan_number" IS NOT NULL AND "deleted_at" IS NULL
           GROUP BY 1, 2 HAVING count(*) > 1) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate PAN numbers must be fixed first: %', dupes;
  END IF;

  SELECT string_agg(format('org %s Aadhaar ending %s (employee ids %s)', org, right(aadhaar, 4), ids), '; ')
    INTO dupes
    FROM (SELECT "organization_id" AS org, "aadhaar_number" AS aadhaar,
                 string_agg("employee_id"::TEXT, ', ' ORDER BY "employee_id") AS ids
            FROM "hr"."employee_government_ids"
           WHERE "aadhaar_number" IS NOT NULL AND "deleted_at" IS NULL
           GROUP BY 1, 2 HAVING count(*) > 1) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate Aadhaar numbers must be fixed first: %', dupes;
  END IF;
END $$;

-- Phone numbers compare by their digits, so "98400 12345" and "9840012345"
-- are the same number.
CREATE UNIQUE INDEX "employees_org_phone_digits_key"
  ON "hr"."employees" ("organization_id", regexp_replace("phone", '\D', '', 'g'))
  WHERE "phone" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "employee_government_ids_org_pan_key"
  ON "hr"."employee_government_ids" ("organization_id", upper("pan_number"))
  WHERE "pan_number" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "employee_government_ids_org_aadhaar_key"
  ON "hr"."employee_government_ids" ("organization_id", "aadhaar_number")
  WHERE "aadhaar_number" IS NOT NULL AND "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Payroll settings
-- ---------------------------------------------------------------------------
CREATE TABLE "hr"."payroll_settings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "basic_percent" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "hra_percent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "conveyance_percent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "pf_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 15000,
    "pf_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "pf_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "esi_wage_threshold" DECIMAL(12,2) NOT NULL DEFAULT 21000,
    "esi_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.75,
    "esi_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 3.25,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_settings_organization_id_key" ON "hr"."payroll_settings"("organization_id");

ALTER TABLE "hr"."payroll_settings" ADD CONSTRAINT "payroll_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hr"."payroll_settings" ADD CONSTRAINT "payroll_settings_percent_range_check"
  CHECK ("basic_percent" BETWEEN 0 AND 100
     AND "hra_percent" BETWEEN 0 AND 100
     AND "conveyance_percent" BETWEEN 0 AND 100
     AND "pf_employee_rate" BETWEEN 0 AND 100
     AND "pf_employer_rate" BETWEEN 0 AND 100
     AND "esi_employee_rate" BETWEEN 0 AND 100
     AND "esi_employer_rate" BETWEEN 0 AND 100);

-- The split components cannot exceed the whole salary.
ALTER TABLE "hr"."payroll_settings" ADD CONSTRAINT "payroll_settings_split_total_check"
  CHECK ("basic_percent" + "hra_percent" + "conveyance_percent" <= 100);

ALTER TABLE "hr"."payroll_settings" ADD CONSTRAINT "payroll_settings_limits_check"
  CHECK ("pf_wage_ceiling" > 0 AND "esi_wage_threshold" > 0 AND "version" >= 1);
