-- CreateTable
CREATE TABLE hr.work_permissions (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "from_time" VARCHAR(5) NOT NULL,
    "to_time" VARCHAR(5) NOT NULL,
    "duration_mins" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hr_note" TEXT,
    "requested_by" INTEGER NOT NULL,
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_permissions_pkey" PRIMARY KEY ("id")
);

-- Constraints
ALTER TABLE hr.work_permissions
    ADD CONSTRAINT "work_permissions_status_check"
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD CONSTRAINT "work_permissions_duration_check"
        CHECK (duration_mins > 0 AND duration_mins <= 120),
    ADD CONSTRAINT "work_permissions_time_format_from"
        CHECK (from_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    ADD CONSTRAINT "work_permissions_time_format_to"
        CHECK (to_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- CreateIndex
CREATE INDEX "work_permissions_org_emp_date_idx"
    ON hr.work_permissions ("organization_id", "employee_id", "date" DESC);

CREATE INDEX "work_permissions_org_status_idx"
    ON hr.work_permissions ("organization_id", "status");

-- AddForeignKey
ALTER TABLE hr.work_permissions
    ADD CONSTRAINT "work_permissions_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES platform.organizations ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE hr.work_permissions
    ADD CONSTRAINT "work_permissions_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES hr.employees ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE hr.work_permissions
    ADD CONSTRAINT "work_permissions_requested_by_fkey"
        FOREIGN KEY ("requested_by") REFERENCES platform.users ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE hr.work_permissions
    ADD CONSTRAINT "work_permissions_decided_by_fkey"
        FOREIGN KEY ("decided_by") REFERENCES platform.users ("id") ON DELETE SET NULL ON UPDATE CASCADE;
