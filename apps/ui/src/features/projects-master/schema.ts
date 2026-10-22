import { z } from "zod";

/**
 * Feature-local zod schemas mirroring
 * apps/api/src/modules/projects-master/dto/*.ts (Docs/CODING_STANDARDS.md
 * "Frontend API/state/error standard").
 */

/** Tab 1: Project Master — a project type/category row (e.g. ME, SW, EC). */
export const createProjectSchema = z.object({
  code: z.string().trim().min(1, "Project code is required").max(20),
  name: z.string().trim().min(1, "Project name is required").max(150),
  description: z.string().trim().max(500).optional(),
});
export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

/** Tab 2: Project Code Master — the code format generator. */
export const projectCodeMasterSchema = z.object({
  companyPrefix: z.string().trim().max(20).optional(),
  moduleIdentifier: z.string().trim().max(20).optional(),
  defaultProjectCode: z.string().trim().max(20).optional(),
  financialYear: z.string().trim().max(20).optional(),
  sequenceDigits: z.number().int().min(1).max(10).optional(),
});
export type ProjectCodeMasterFormValues = z.infer<
  typeof projectCodeMasterSchema
>;

/** Tab 3: Task Running Number Master — the task-numbering format generator. */
export const taskRunningNumberMasterSchema = z.object({
  taskPrefix: z.string().trim().max(10).optional(),
  separator: z.string().trim().max(5).optional(),
  sequenceDigits: z.number().int().min(1).max(10).optional(),
});
export type TaskRunningNumberMasterFormValues = z.infer<
  typeof taskRunningNumberMasterSchema
>;
