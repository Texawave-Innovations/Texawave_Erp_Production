-- Invariants Prisma cannot express for the Recruitment tables.

-- Interview: legacy status and mode vocabularies (InterviewSchedule.tsx).
ALTER TABLE "hr"."interviews"
  ADD CONSTRAINT "interviews_status_check"
  CHECK ("status" IN ('SCHEDULED', 'COMPLETED', 'SELECTED', 'REJECTED', 'NO_SHOW'));

ALTER TABLE "hr"."interviews"
  ADD CONSTRAINT "interviews_mode_check"
  CHECK ("mode" IN ('ONLINE', 'IN_PERSON', 'PHONE'));

ALTER TABLE "hr"."interviews"
  ADD CONSTRAINT "interviews_time_check"
  CHECK ("interview_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Offer letter: legacy only ever assigns Generated (Sent/Accepted are dead).
ALTER TABLE "hr"."offer_letters"
  ADD CONSTRAINT "offer_letters_status_check"
  CHECK ("status" IN ('GENERATED'));

-- Salary components are never negative.
ALTER TABLE "hr"."offer_letters"
  ADD CONSTRAINT "offer_letters_components_non_negative_check"
  CHECK ("basic" >= 0 AND "da" >= 0 AND "hra" >= 0 AND "ca" >= 0);
