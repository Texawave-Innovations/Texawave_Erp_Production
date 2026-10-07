import type {
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
} from "@texawave-erp/core";
import { apiClient } from "@/lib/api-client";

/**
 * Both endpoints are unauthenticated (@Public() on the backend), so no
 * `withAuthRetry` here — there is no access token to refresh yet
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
export async function forgotPassword(
  input: ForgotPasswordFormValues,
): Promise<void> {
  await apiClient.post<{ message: string }>("/auth/forgot-password", input);
}

export async function resetPassword(
  input: Pick<ResetPasswordFormValues, "token" | "newPassword">,
): Promise<void> {
  await apiClient.post<{ message: string }>("/auth/reset-password", input);
}

/** Authenticated, so no `withAuthRetry`: a 401 here means "wrong current
 * password", and a refresh-and-retry would mask that as a session problem. */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post<{ message: string }>("/auth/change-password", input);
}
