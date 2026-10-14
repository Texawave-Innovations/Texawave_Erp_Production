-- Invariants Prisma cannot express (see the revision_letters model doc).
-- Status: the legacy app only ever assigns GENERATED.
ALTER TABLE "hr"."revision_letters"
  ADD CONSTRAINT "revision_letters_status_check"
  CHECK ("status" IN ('GENERATED'));

-- Salary components are never negative.
ALTER TABLE "hr"."revision_letters"
  ADD CONSTRAINT "revision_letters_components_non_negative_check"
  CHECK ("basic" >= 0 AND "da" >= 0 AND "hra" >= 0 AND "ca" >= 0);
