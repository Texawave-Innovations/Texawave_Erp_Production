-- AlterTable
ALTER TABLE "crm"."accounts" ADD COLUMN     "account_type" TEXT,
ADD COLUMN     "annual_revenue" DECIMAL(16,2),
ADD COLUMN     "billing_city" TEXT,
ADD COLUMN     "billing_country" TEXT,
ADD COLUMN     "billing_postal_code" TEXT,
ADD COLUMN     "billing_state" TEXT,
ADD COLUMN     "billing_street" TEXT,
ADD COLUMN     "business_type" TEXT,
ADD COLUMN     "customer_category" TEXT,
ADD COLUMN     "customer_class" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "number_of_employees" INTEGER,
ADD COLUMN     "owner_name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "registration_number" TEXT,
ADD COLUMN     "reseller_type" TEXT,
ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_country" TEXT,
ADD COLUMN     "shipping_postal_code" TEXT,
ADD COLUMN     "shipping_state" TEXT,
ADD COLUMN     "shipping_street" TEXT,
ADD COLUMN     "status_date" TIMESTAMPTZ(6),
ADD COLUMN     "status_info_type" TEXT,
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "status_tag" TEXT,
ADD COLUMN     "status_updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "status_updated_by" INTEGER,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "crm"."crm_meetings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'Online',
    "meeting_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "location" TEXT,
    "meeting_link" TEXT,
    "agenda" TEXT,
    "participants" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "summary" TEXT,
    "requirements" TEXT,
    "concerns" TEXT,
    "competitors" TEXT,
    "budget" TEXT,
    "decision_maker" TEXT,
    "expected_timeline" TEXT,
    "next_follow_up_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_meeting_reschedules" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "previous_date" DATE NOT NULL,
    "reason" TEXT,
    "rescheduled_by" INTEGER,
    "rescheduled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_meeting_reschedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_follow_ups" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "notes" TEXT,
    "outcome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "next_follow_up_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_follow_up_reschedules" (
    "id" SERIAL NOT NULL,
    "follow_up_id" INTEGER NOT NULL,
    "previous_date" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "rescheduled_by" INTEGER,
    "rescheduled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_follow_up_reschedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_activities" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "notes" TEXT,
    "direction" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_documents" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "notes" TEXT,
    "uploaded_by" INTEGER,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."crm_notes" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_meetings_organization_id_related_type_related_id_idx" ON "crm"."crm_meetings"("organization_id", "related_type", "related_id");

-- CreateIndex
CREATE INDEX "crm_meetings_organization_id_status_idx" ON "crm"."crm_meetings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_meeting_reschedules_meeting_id_idx" ON "crm"."crm_meeting_reschedules"("meeting_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_organization_id_related_type_related_id_idx" ON "crm"."crm_follow_ups"("organization_id", "related_type", "related_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_organization_id_status_idx" ON "crm"."crm_follow_ups"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_follow_up_reschedules_follow_up_id_idx" ON "crm"."crm_follow_up_reschedules"("follow_up_id");

-- CreateIndex
CREATE INDEX "crm_activities_organization_id_related_type_related_id_idx" ON "crm"."crm_activities"("organization_id", "related_type", "related_id");

-- CreateIndex
CREATE INDEX "crm_activities_organization_id_type_idx" ON "crm"."crm_activities"("organization_id", "type");

-- CreateIndex
CREATE INDEX "crm_tasks_organization_id_related_type_related_id_idx" ON "crm"."crm_tasks"("organization_id", "related_type", "related_id");

-- CreateIndex
CREATE INDEX "crm_tasks_organization_id_status_idx" ON "crm"."crm_tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_documents_organization_id_related_type_related_id_idx" ON "crm"."crm_documents"("organization_id", "related_type", "related_id");

-- CreateIndex
CREATE INDEX "crm_notes_organization_id_account_id_idx" ON "crm"."crm_notes"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "accounts_organization_id_status_tag_idx" ON "crm"."accounts"("organization_id", "status_tag");

-- AddForeignKey
ALTER TABLE "crm"."crm_meetings" ADD CONSTRAINT "crm_meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_meeting_reschedules" ADD CONSTRAINT "crm_meeting_reschedules_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "crm"."crm_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_follow_up_reschedules" ADD CONSTRAINT "crm_follow_up_reschedules_follow_up_id_fkey" FOREIGN KEY ("follow_up_id") REFERENCES "crm"."crm_follow_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_activities" ADD CONSTRAINT "crm_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_tasks" ADD CONSTRAINT "crm_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_documents" ADD CONSTRAINT "crm_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_notes" ADD CONSTRAINT "crm_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."crm_notes" ADD CONSTRAINT "crm_notes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

