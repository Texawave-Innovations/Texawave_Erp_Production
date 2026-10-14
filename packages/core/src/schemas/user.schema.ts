import { z } from "zod";

/** Mirrors apps/api/src/common/validation/password-policy.ts — same rule,
 * same messages, so the form rejects what the server would reject. */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password must be 100 characters or fewer")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/\d/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

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
  password: strongPasswordSchema,
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
