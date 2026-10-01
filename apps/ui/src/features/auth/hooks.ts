"use client";

import type {
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
} from "@texawave-erp/core";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword, resetPassword } from "./api";

// No cache to invalidate — both mutations are unauthenticated and there is
// no org-scoped query key to speak of yet.
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordFormValues) => forgotPassword(input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (
      input: Pick<ResetPasswordFormValues, "token" | "newPassword">,
    ) => resetPassword(input),
  });
}
