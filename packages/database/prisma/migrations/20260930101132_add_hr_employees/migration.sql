-- CreateTable
CREATE TABLE "document_sequences" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "doc_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "user_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "work_email" TEXT,
    "phone" TEXT,
    "team_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "designation_id" INTEGER NOT NULL,
    "employment_type_id" INTEGER NOT NULL,
    "work_location_id" INTEGER,
    "reports_to_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "date_of_joining" DATE NOT NULL,
    "date_of_exit" DATE,
    "exit_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_status_history" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "change_type" TEXT NOT NULL DEFAULT 'transition',
    "effective_date" DATE NOT NULL,
    "reason" TEXT,
    "changed_by" INTEGER NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_organization_id_doc_type_key" ON "document_sequences"("organization_id", "doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "employees"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employees_organization_id_team_id_idx" ON "employees"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_department_id_idx" ON "employees"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_designation_id_idx" ON "employees"("organization_id", "designation_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_employment_type_id_idx" ON "employees"("organization_id", "employment_type_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_reports_to_id_idx" ON "employees"("organization_id", "reports_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_code_key" ON "employees"("organization_id", "employee_code");

-- CreateIndex
CREATE INDEX "employee_status_history_employee_idx" ON "employee_status_history"("organization_id", "employee_id", "id" DESC);

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- document_sequences ---------------------------------------------------------
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_values_check"
  CHECK ("next_number" >= 1 AND "padding" BETWEEN 1 AND 12 AND btrim("prefix") <> '');

-- employees ------------------------------------------------------------------

-- The four approved statuses; anything else is rejected by the database.
ALTER TABLE "employees" ADD CONSTRAINT "employees_status_check"
  CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'));

-- is_active is a mirror of "currently ACTIVE", never an independent flag.
ALTER TABLE "employees" ADD CONSTRAINT "employees_is_active_matches_status_check"
  CHECK ("is_active" = ("status" = 'ACTIVE'));

-- An exit date and reason exist exactly when the employee has left
-- (RESIGNED/TERMINATED) — so a leaver always has a last day, and a person who
-- is (again) ACTIVE/INACTIVE never carries a stale one.
ALTER TABLE "employees" ADD CONSTRAINT "employees_exit_consistency_check"
  CHECK (("status" IN ('RESIGNED', 'TERMINATED')) = ("date_of_exit" IS NOT NULL)
     AND ("status" IN ('RESIGNED', 'TERMINATED')) = ("exit_reason" IS NOT NULL));

ALTER TABLE "employees" ADD CONSTRAINT "employees_exit_after_joining_check"
  CHECK ("date_of_exit" IS NULL OR "date_of_exit" >= "date_of_joining");

ALTER TABLE "employees" ADD CONSTRAINT "employees_not_own_manager_check"
  CHECK ("reports_to_id" IS NULL OR "reports_to_id" <> "id");

ALTER TABLE "employees" ADD CONSTRAINT "employees_code_format_check"
  CHECK ("employee_code" ~ '^EMP-[0-9]{6,}$');

ALTER TABLE "employees" ADD CONSTRAINT "employees_text_check"
  CHECK (btrim("full_name") <> ''
     AND ("work_email" IS NULL OR btrim("work_email") <> '')
     AND ("phone" IS NULL OR btrim("phone") <> '')
     AND ("exit_reason" IS NULL OR btrim("exit_reason") <> ''));

ALTER TABLE "employees" ADD CONSTRAINT "employees_version_check" CHECK ("version" >= 1);

-- One work e-mail per person within an organization (case-insensitive).
CREATE UNIQUE INDEX "employees_org_lower_work_email_key"
  ON "employees" ("organization_id", lower("work_email"))
  WHERE "work_email" IS NOT NULL;

-- The human code and the owning organization never change after creation.
CREATE FUNCTION "employees_protect_identity"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."employee_code" IS DISTINCT FROM OLD."employee_code" THEN
    RAISE EXCEPTION 'employees.employee_code is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id" THEN
    RAISE EXCEPTION 'employees.organization_id is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "employees_protect_identity"
  BEFORE UPDATE ON "employees"
  FOR EACH ROW EXECUTE FUNCTION "employees_protect_identity"();

-- Backstop against a reporting-line cycle (A reports to B reports to A ...).
-- The service checks first for a friendly error; this catches everything
-- else. It sees committed rows only, so two concurrent transactions that each
-- close half of a cycle could still race — the service takes row locks on
-- the chain to make that vanishingly unlikely; see employees.repository.ts.
CREATE FUNCTION "employees_no_reporting_cycle"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cursor_id integer := NEW."reports_to_id";
  hops integer := 0;
BEGIN
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW."id" THEN
      RAISE EXCEPTION 'reporting line cycle: employee % would (indirectly) report to themselves', NEW."id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'employees_no_reporting_cycle';
    END IF;
    hops := hops + 1;
    IF hops > 1000 THEN
      RAISE EXCEPTION 'reporting line too deep or cyclic'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'employees_no_reporting_cycle';
    END IF;
    SELECT "reports_to_id" INTO cursor_id FROM "employees" WHERE "id" = cursor_id;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "employees_no_reporting_cycle"
  BEFORE INSERT OR UPDATE OF "reports_to_id" ON "employees"
  FOR EACH ROW WHEN (NEW."reports_to_id" IS NOT NULL)
  EXECUTE FUNCTION "employees_no_reporting_cycle"();

-- employee_status_history ----------------------------------------------------
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_status_check"
  CHECK ("to_status" IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED')
     AND ("from_status" IS NULL OR "from_status" IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED')));
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_change_type_check"
  CHECK ("change_type" IN ('transition', 'correction'));
-- A correction must say why.
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_correction_reason_check"
  CHECK ("change_type" <> 'correction' OR ("reason" IS NOT NULL AND btrim("reason") <> ''));

-- Append-only, like the audit trail (function created in add_audit_logs).
CREATE TRIGGER "employee_status_history_no_update_delete"
  BEFORE UPDATE OR DELETE ON "employee_status_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();
CREATE TRIGGER "employee_status_history_no_truncate"
  BEFORE TRUNCATE ON "employee_status_history"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_row_mutation"();
