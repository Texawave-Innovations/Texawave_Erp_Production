-- CreateTable
CREATE TABLE "hr"."attendance_records" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."attendance_sessions" (
    "id" SERIAL NOT NULL,
    "attendance_record_id" INTEGER NOT NULL,
    "check_in_at" TIMESTAMPTZ(6) NOT NULL,
    "check_out_at" TIMESTAMPTZ(6),
    "source" TEXT NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."attendance_corrections" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_record_id" INTEGER,
    "attendance_date" DATE NOT NULL,
    "correction_type" TEXT NOT NULL,
    "requested_check_in_at" TIMESTAMPTZ(6),
    "requested_check_out_at" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
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

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_organization_id_attendance_date_idx" ON "hr"."attendance_records"("organization_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_organization_id_employee_id_attendance_d_key" ON "hr"."attendance_records"("organization_id", "employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_sessions_attendance_record_id_check_in_at_idx" ON "hr"."attendance_sessions"("attendance_record_id", "check_in_at");

-- CreateIndex
CREATE INDEX "attendance_corrections_organization_id_employee_id_attendan_idx" ON "hr"."attendance_corrections"("organization_id", "employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_corrections_organization_id_status_idx" ON "hr"."attendance_corrections"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "hr"."attendance_records" ADD CONSTRAINT "attendance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "hr"."attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "hr"."attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express (hand-written; see schema.prisma comments)
-- ---------------------------------------------------------------------------

-- Stored status is only what was explicitly set. NULL = nothing stored.
ALTER TABLE "hr"."attendance_records"
  ADD CONSTRAINT "attendance_records_status_check"
  CHECK ("status" IS NULL OR "status" IN ('PRESENT', 'ABSENT', 'HALF_DAY'));

ALTER TABLE "hr"."attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_source_check"
  CHECK ("source" IN ('SELF', 'HR', 'CORRECTION'));

-- A closed session must end after it starts (zero-length punches are rejected).
ALTER TABLE "hr"."attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_time_order_check"
  CHECK ("check_out_at" IS NULL OR "check_out_at" > "check_in_at");

-- At most one open session per record. Cross-day "one open session per
-- employee" is enforced under a per-employee advisory lock in the service.
CREATE UNIQUE INDEX "attendance_sessions_one_open_per_record_key"
  ON "hr"."attendance_sessions" ("attendance_record_id")
  WHERE "check_out_at" IS NULL;

ALTER TABLE "hr"."attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_type_check"
  CHECK ("correction_type" IN ('MISSED_CHECK_IN', 'MISSED_CHECK_OUT', 'INCORRECT_TIME', 'LATE_ARRIVAL', 'EARLY_DEPARTURE'));

ALTER TABLE "hr"."attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_status_check"
  CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'REJECTED'));

-- Decision fields must agree with the status; a rejection must carry a reason.
ALTER TABLE "hr"."attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_decision_check"
  CHECK (
    ("status" = 'SUBMITTED' AND "decided_by" IS NULL AND "decided_at" IS NULL AND "decision_note" IS NULL)
    OR ("status" = 'APPROVED' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
    OR ("status" = 'REJECTED' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL AND "decision_note" IS NOT NULL)
  );

-- A correction must request at least one time, and any requested pair is ordered.
ALTER TABLE "hr"."attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_requested_times_check"
  CHECK (
    ("requested_check_in_at" IS NOT NULL OR "requested_check_out_at" IS NOT NULL)
    AND ("requested_check_in_at" IS NULL OR "requested_check_out_at" IS NULL
         OR "requested_check_out_at" > "requested_check_in_at")
  );
