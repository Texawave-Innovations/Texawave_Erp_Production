/*
  Warnings:

  - You are about to drop the column `created_at` on the `authorized_signatories` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `authorized_signatories` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `authorized_signatories` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `authorized_signatories` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `authorized_signatories` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `company_details` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `company_details` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `company_details` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `company_details` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `company_details` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `salespersons` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `salespersons` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `seal_signatures` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `seal_signatures` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "crm"."crm_mining_rows_organization_id_idx";

-- AlterTable
ALTER TABLE "sales"."authorized_signatories" DROP COLUMN "created_at",
DROP COLUMN "created_by",
DROP COLUMN "deleted_at",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "sales"."company_details" DROP COLUMN "created_at",
DROP COLUMN "created_by",
DROP COLUMN "deleted_at",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "sales"."salespersons" DROP COLUMN "created_by",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "sales"."seal_signatures" DROP COLUMN "created_by",
DROP COLUMN "updated_by";
