import { z } from "zod";

/** Mirrors apps/api/src/platform/auth/dto/forgot-password.dto.ts so the form
 * fails the same way the API would, before a round trip
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard"). */
export const forgotPasswordSchema = z.object({
  organizationSlug: z.string().min(1, "Organization is required"),
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/** Mirrors apps/api/src/platform/auth/dto/reset-password.dto.ts, plus a
 * client-only `confirmPassword` check the API doesn't need. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing reset token"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
