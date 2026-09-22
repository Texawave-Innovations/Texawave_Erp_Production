import { z } from "zod";

/** Shared client-side validation for the settings/roles feature — mirrors
 * apps/api/src/modules/settings/roles/dto/create-role.dto.ts so the form
 * fails the same way the API would, before a round trip
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). */
export const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
});

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>;
