-- CreateEnum
CREATE TYPE "projects"."ProposalTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "projects"."ProposalStatus" AS ENUM ('draft', 'under_review', 'changes_requested', 'approved', 'sent', 'accepted', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "projects"."MomTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "projects"."MomStatus" AS ENUM ('draft', 'finalized', 'archived');

-- DropIndex
-- Guarded with IF EXISTS: no migration in this repo's history ever created
-- this index (it must have existed only via an out-of-band `db push` on
-- whoever authored this migration), so on any database that was migrated
-- from a clean slate the unguarded DROP INDEX aborted migrate deploy/dev
-- here with "index ... does not exist" before any later migration could
-- run. The intended end state (no such index) is unaffected either way.
DROP INDEX IF EXISTS "projects"."projects_organization_id_department_idx";

-- AlterTable
ALTER TABLE "projects"."project_tasks" ADD COLUMN     "dependency_requirement" TEXT,
ADD COLUMN     "dependency_target_id" INTEGER,
ADD COLUMN     "dependency_target_name" TEXT,
ADD COLUMN     "dependency_type" TEXT;

-- AlterTable
ALTER TABLE "projects"."projects" DROP COLUMN "department",
ADD COLUMN     "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resource_names" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "projects"."proposal_templates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_version_id" INTEGER,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "status" "projects"."ProposalTemplateStatus" NOT NULL DEFAULT 'draft',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "schema_json" JSONB NOT NULL DEFAULT '[]',
    "created_by" INTEGER,
    "created_by_name" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."proposal_documents" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "proposal_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "project_id" INTEGER,
    "project_code" TEXT,
    "project_name" TEXT,
    "client_id" INTEGER,
    "client_name" TEXT,
    "template_id" INTEGER,
    "template_title" TEXT,
    "template_code" TEXT,
    "template_version" INTEGER,
    "template_snapshot" JSONB,
    "section_values" JSONB NOT NULL DEFAULT '{}',
    "status" "projects"."ProposalStatus" NOT NULL DEFAULT 'draft',
    "prepared_by" INTEGER,
    "proposal_date" DATE,
    "due_date" DATE,
    "follow_up_notes" TEXT,
    "follow_up_extension_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proposal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."proposal_activities" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "user_role" TEXT,
    "action" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."proposal_settings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "company_name" TEXT,
    "logo_url" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "show_header" BOOLEAN NOT NULL DEFAULT true,
    "show_footer" BOOLEAN NOT NULL DEFAULT true,
    "prefix" TEXT NOT NULL DEFAULT 'PROP',
    "year_format" TEXT NOT NULL DEFAULT 'YYYY',
    "sequence_digits" INTEGER NOT NULL DEFAULT 4,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."mom_templates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_version_id" INTEGER,
    "status" "projects"."MomTemplateStatus" NOT NULL DEFAULT 'draft',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sections_json" JSONB NOT NULL DEFAULT '[]',
    "default_agenda_json" JSONB NOT NULL DEFAULT '[]',
    "default_note_rows_json" JSONB NOT NULL DEFAULT '[]',
    "additional_sections_json" JSONB NOT NULL DEFAULT '[]',
    "created_by" INTEGER,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mom_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."mom_documents" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "project_id" INTEGER,
    "project_code" TEXT,
    "project_name" TEXT,
    "client_name" TEXT,
    "meeting_title" TEXT NOT NULL,
    "meeting_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "timezone" TEXT,
    "location" TEXT,
    "attendees_json" JSONB NOT NULL DEFAULT '[]',
    "absentees_json" JSONB NOT NULL DEFAULT '[]',
    "agenda_json" JSONB NOT NULL DEFAULT '[]',
    "meeting_notes_json" JSONB NOT NULL DEFAULT '[]',
    "additional_sections_json" JSONB NOT NULL DEFAULT '[]',
    "free_text_content" TEXT,
    "status" "projects"."MomStatus" NOT NULL DEFAULT 'draft',
    "previous_status" TEXT,
    "template_id" INTEGER,
    "template_title" TEXT,
    "template_version" INTEGER,
    "template_snapshot" JSONB,
    "current_revision" INTEGER NOT NULL DEFAULT 1,
    "working_revision" INTEGER,
    "working_revision_reason" TEXT,
    "version_token" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mom_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."mom_revisions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "mom_id" INTEGER NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "change_summary" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mom_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."mom_history_events" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "mom_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mom_history_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_templates_organization_id_status_idx" ON "projects"."proposal_templates"("organization_id", "status");

-- CreateIndex
CREATE INDEX "proposal_documents_organization_id_status_idx" ON "projects"."proposal_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "proposal_documents_organization_id_project_id_idx" ON "projects"."proposal_documents"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "proposal_documents_organization_id_due_date_idx" ON "projects"."proposal_documents"("organization_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_documents_organization_id_proposal_number_key" ON "projects"."proposal_documents"("organization_id", "proposal_number");

-- CreateIndex
CREATE INDEX "proposal_activities_proposal_id_created_at_idx" ON "projects"."proposal_activities"("proposal_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_settings_organization_id_key" ON "projects"."proposal_settings"("organization_id");

-- CreateIndex
CREATE INDEX "mom_templates_organization_id_status_idx" ON "projects"."mom_templates"("organization_id", "status");

-- CreateIndex
CREATE INDEX "mom_documents_organization_id_status_idx" ON "projects"."mom_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "mom_documents_organization_id_project_id_idx" ON "projects"."mom_documents"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "mom_documents_organization_id_reference_key" ON "projects"."mom_documents"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "mom_revisions_mom_id_revision_number_key" ON "projects"."mom_revisions"("mom_id", "revision_number");

-- CreateIndex
CREATE INDEX "mom_history_events_mom_id_created_at_idx" ON "projects"."mom_history_events"("mom_id", "created_at");

-- AddForeignKey
ALTER TABLE "projects"."proposal_templates" ADD CONSTRAINT "proposal_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_templates" ADD CONSTRAINT "proposal_templates_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "projects"."proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_documents" ADD CONSTRAINT "proposal_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_documents" ADD CONSTRAINT "proposal_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_documents" ADD CONSTRAINT "proposal_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "projects"."proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_activities" ADD CONSTRAINT "proposal_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_activities" ADD CONSTRAINT "proposal_activities_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "projects"."proposal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."proposal_settings" ADD CONSTRAINT "proposal_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_templates" ADD CONSTRAINT "mom_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_templates" ADD CONSTRAINT "mom_templates_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "projects"."mom_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_documents" ADD CONSTRAINT "mom_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_documents" ADD CONSTRAINT "mom_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_documents" ADD CONSTRAINT "mom_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "projects"."mom_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_revisions" ADD CONSTRAINT "mom_revisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_revisions" ADD CONSTRAINT "mom_revisions_mom_id_fkey" FOREIGN KEY ("mom_id") REFERENCES "projects"."mom_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_history_events" ADD CONSTRAINT "mom_history_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."mom_history_events" ADD CONSTRAINT "mom_history_events_mom_id_fkey" FOREIGN KEY ("mom_id") REFERENCES "projects"."mom_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

