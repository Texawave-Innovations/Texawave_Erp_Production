-- `updated_at` on permissions/role_permissions/user_roles gets an explicit
-- DEFAULT CURRENT_TIMESTAMP below (Prisma's `@updatedAt` only sets values on
-- writes going through Prisma Client — it emits no SQL default, which fails
-- against these tables' existing rows) so existing rows backfill the same
-- way `created_at` does on every other table in this migration.
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "user_team_access" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "updated_by" INTEGER;
