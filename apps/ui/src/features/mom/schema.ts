import { z } from "zod";

/**
 * Feature-local zod schemas mirroring
 * apps/api/src/modules/projects/mom/dto/*.ts (Docs/CODING_STANDARDS.md
 * "Frontend API/state/error standard").
 */

export const createMomTemplateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  code: z.string().trim().max(30).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(100).optional(),
});
export type CreateMomTemplateFormValues = z.infer<
  typeof createMomTemplateSchema
>;
