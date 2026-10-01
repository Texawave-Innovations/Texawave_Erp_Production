import { z } from "zod";

/**
 * Shared client-side validation for users feature — mirrors
 * apps/api/src/platform/users/dto/create-user.dto.ts
 */
export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or fewer"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be 100 characters or fewer"),
  roleIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or fewer")
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
