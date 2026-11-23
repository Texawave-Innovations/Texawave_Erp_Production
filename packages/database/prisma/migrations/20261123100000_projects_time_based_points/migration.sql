-- Time-based task points: finishing a task against its ETA (timer minutes).
-- Additive only: nullable ledger breakdown columns and a config switch that is
-- OFF by default, so existing points and behaviour are unchanged until it is
-- switched on.

-- AlterTable
ALTER TABLE "projects"."project_points_ledger" ADD COLUMN     "base_points" INTEGER,
ADD COLUMN     "bonus_points" INTEGER,
ADD COLUMN     "eta_minutes" INTEGER,
ADD COLUMN     "overrun_minutes" INTEGER,
ADD COLUMN     "rule" TEXT,
ADD COLUMN     "worked_minutes" INTEGER;

-- AlterTable
ALTER TABLE "projects"."project_points_config" ADD COLUMN     "default_task_points" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "grace_minutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "on_time_bonus" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "time_based_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "projects"."project_points_config"
  ADD CONSTRAINT "project_points_config_time_rules_check"
  CHECK ("default_task_points" >= 0 AND "on_time_bonus" >= 0 AND "grace_minutes" >= 0);
