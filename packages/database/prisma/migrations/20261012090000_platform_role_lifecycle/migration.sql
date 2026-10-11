-- Role lifecycle for the access-control screen (Docs/ARCHITECTURE.md §11,
-- 2026-10-11): system-role flag, optimistic-lock version, description.

-- AlterTable
ALTER TABLE "platform"."roles" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;


-- The roles the platform seeds (prisma/seed.ts, permissions/default-roles.ts).
UPDATE "platform"."roles"
   SET "is_system" = true
 WHERE "name" IN ('Super Admin', 'HR Manager', 'Team Lead', 'Employee');

ALTER TABLE "platform"."roles" ADD CONSTRAINT "roles_version_positive_check" CHECK ("version" >= 1);
ALTER TABLE "platform"."roles" ADD CONSTRAINT "roles_name_not_blank_check" CHECK (btrim("name") <> '');
