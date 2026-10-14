-- Invariants Prisma cannot express for the employee profile tables.

-- Experience is a plausible span of years (legacy stores free text; see
-- Docs/HR_LEGACY_PARITY.md §11.7 P5).
ALTER TABLE "hr"."employee_profiles"
  ADD CONSTRAINT "employee_profiles_experience_range_check"
  CHECK ("experience_years" IS NULL OR ("experience_years" >= 0 AND "experience_years" <= 60));

-- Addresses, when present, are JSON objects, never arrays or scalars.
ALTER TABLE "hr"."employee_profiles"
  ADD CONSTRAINT "employee_profiles_addresses_shape_check"
  CHECK (
    ("present_address" IS NULL OR jsonb_typeof("present_address") = 'object')
    AND ("permanent_address" IS NULL OR jsonb_typeof("permanent_address") = 'object')
  );
