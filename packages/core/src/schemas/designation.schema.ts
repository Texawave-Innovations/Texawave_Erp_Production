import { z } from "zod";

/**
 * Shared client-side validation for designations — mirrors
 * apps/api/src/modules/master-data/designations/dto/create-designation.dto.ts
 */
export const createDesignationSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9_]{1,29}$/,
      "Code must be 2-30 characters: upper-case letters, digits or underscore, starting with a letter.",
    ),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
});

export type CreateDesignationFormValues = z.infer<
  typeof createDesignationSchema
>;
