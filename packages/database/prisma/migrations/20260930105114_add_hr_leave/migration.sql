-- CreateTable
CREATE TABLE "leave_types" (
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

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_types_organization_id_idx" ON "leave_types"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_organization_id_code_key" ON "leave_types"("organization_id", "code");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_employee_id_start_date_idx" ON "leave_requests"("organization_id", "employee_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_status_idx" ON "leave_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_leave_type_id_idx" ON "leave_requests"("organization_id", "leave_type_id");

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- leave_types ----------------------------------------------------------------
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_code_format_check"
  CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,29}$');
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_name_not_blank_check"
  CHECK (btrim("name") <> '');
CREATE UNIQUE INDEX "leave_types_org_lower_name_key"
  ON "leave_types" ("organization_id", lower("name"));

-- leave_requests -------------------------------------------------------------
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_dates_check"
  CHECK ("end_date" >= "start_date");

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reason_check"
  CHECK (btrim("reason") <> '');

-- A request is decided exactly when it is no longer PENDING, and then it says
-- who and when. A rejection must explain itself.
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decision_consistency_check"
  CHECK (("status" = 'PENDING') = ("decided_by" IS NULL AND "decided_at" IS NULL)
     AND ("status" <> 'REJECTED' OR ("decision_note" IS NOT NULL AND btrim("decision_note") <> '')));

-- Two open requests (PENDING or APPROVED) of one employee may not share a day.
-- REJECTED requests are ignored, so a rejected range can be requested again.
-- Inclusive ranges; adjacent ranges are fine. As a constraint it holds under
-- concurrent submissions. (Whether overlap should be prohibited at all is an
-- assumption awaiting confirmation — see the readiness report, L-2.)
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED'));

-- What was submitted never changes, and a decision is final: once a request is
-- APPROVED or REJECTED nothing about it may be updated, and while PENDING only
-- the decision fields (status, decided_by, decided_at, decision_note) and the
-- bookkeeping columns may move. Enforced here so no code path — including a
-- future one — can rewrite leave history.
CREATE FUNCTION "leave_requests_protect"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'leave_requests: a % request is final and cannot be changed', OLD."status"
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
     OR NEW."employee_id"     IS DISTINCT FROM OLD."employee_id"
     OR NEW."leave_type_id"   IS DISTINCT FROM OLD."leave_type_id"
     OR NEW."start_date"      IS DISTINCT FROM OLD."start_date"
     OR NEW."end_date"        IS DISTINCT FROM OLD."end_date"
     OR NEW."reason"          IS DISTINCT FROM OLD."reason"
     OR NEW."requested_by"    IS DISTINCT FROM OLD."requested_by" THEN
    RAISE EXCEPTION 'leave_requests: the submitted request cannot be edited'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "leave_requests_protect"
  BEFORE UPDATE ON "leave_requests"
  FOR EACH ROW EXECUTE FUNCTION "leave_requests_protect"();

-- Leave history is never deleted.
CREATE TRIGGER "leave_requests_no_delete"
  BEFORE DELETE ON "leave_requests"
  FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();
