-- CreateTable
CREATE TABLE "hr"."interviews" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "role_title" TEXT NOT NULL,
    "interviewer_name" TEXT NOT NULL,
    "interview_date" DATE NOT NULL,
    "interview_time" VARCHAR(5) NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."offer_letters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "reporting_manager" TEXT NOT NULL,
    "offer_date" DATE NOT NULL,
    "joining_date" DATE NOT NULL,
    "offer_validity_date" DATE NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "da" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL,
    "ca" DECIMAL(12,2) NOT NULL,
    "work_schedule_mon_fri" TEXT NOT NULL,
    "work_schedule_sat" TEXT NOT NULL,
    "work_schedule_sun" TEXT NOT NULL,
    "signatory_name" TEXT NOT NULL,
    "signatory_designation" TEXT NOT NULL,
    "company_email" TEXT NOT NULL,
    "company_phone" TEXT NOT NULL,
    "company_website" TEXT NOT NULL,
    "company_address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interviews_organization_id_interview_date_idx" ON "hr"."interviews"("organization_id", "interview_date");

-- CreateIndex
CREATE INDEX "interviews_organization_id_status_idx" ON "hr"."interviews"("organization_id", "status");

-- CreateIndex
CREATE INDEX "offer_letters_organization_id_joining_date_idx" ON "hr"."offer_letters"("organization_id", "joining_date");

-- CreateIndex
CREATE INDEX "offer_letters_organization_id_candidate_name_idx" ON "hr"."offer_letters"("organization_id", "candidate_name");

-- AddForeignKey
ALTER TABLE "hr"."interviews" ADD CONSTRAINT "interviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."offer_letters" ADD CONSTRAINT "offer_letters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
