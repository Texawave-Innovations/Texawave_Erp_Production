-- Repairs migration drift on `main` (CI's `prisma migrate diff --exit-code` step).
--
-- 20260922075614_add_baseline_audit_columns added `updated_at ... DEFAULT
-- CURRENT_TIMESTAMP` on these three tables to back-fill existing rows, but
-- schema.prisma declares the column as `@updatedAt` (client-managed, no DB
-- default) and no later migration removed the default. Dropping it makes the
-- migration history match schema.prisma. No data is changed.

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "updated_at" DROP DEFAULT;
