import { z } from "zod";

/**
 * Shared client-side validation for departments feature — mirrors
 * apps/api/src/modules/departments/dto/create-department.dto.ts
 */
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  isActive: z.boolean().default(true),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>;
