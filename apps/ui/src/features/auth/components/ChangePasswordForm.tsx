"use client";

import {
  ApiError,
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@texawave-erp/core";
import { Alert, Button, Card, FormField, Input } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useChangePassword } from "../hooks";

type FieldKey = keyof ChangePasswordFormValues;

const EMPTY: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * Forced first-login password change (TEXA-16 onboarding). Shown to any user
 * whose `mustChangePassword` flag is set. On success the server has revoked
 * every session, so the client signs out and sends the user to sign in again.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const mutation = useChangePassword();

  const [values, setValues] = useState<ChangePasswordFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set<K extends FieldKey>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const result = changePasswordSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in fieldErrors)) {
          fieldErrors[key as FieldKey] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    try {
      await mutation.mutateAsync({
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
      });
      setDone(true);
      clear();
      queryClient.clear();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setErrors({ currentPassword: "Current password is incorrect." });
      } else if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "Could not reach the server. Check your connection and try again.",
        );
      }
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Password changed
        </h1>
        <Alert variant="success" title="You're all set">
          Sign in with your new password to continue to your onboarding.
        </Alert>
        <div className="mt-6">
          <Button className="w-full" onClick={() => router.replace("/login")}>
            Go to sign in
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-1 text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Change your password
      </h1>
      <p className="mb-6 text-theme-sm text-gray-500 dark:text-gray-400">
        Your account was created with a temporary password. Choose a new one to
        continue.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {submitError && (
          <Alert variant="error" title="Could not change your password">
            {submitError}
          </Alert>
        )}

        <FormField
          label="Current (temporary) password"
          required
          error={errors.currentPassword}
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              value={values.currentPassword}
              disabled={mutation.isPending}
              onChange={(e) => set("currentPassword", e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="New password"
          required
          error={errors.newPassword}
          hint="At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character."
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={values.newPassword}
              disabled={mutation.isPending}
              onChange={(e) => set("newPassword", e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Confirm new password"
          required
          error={errors.confirmPassword}
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              disabled={mutation.isPending}
              onChange={(e) => set("confirmPassword", e.target.value)}
            />
          )}
        </FormField>

        <Button
          type="submit"
          className="w-full"
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Change password
        </Button>
      </form>

      <p className="mt-6 text-theme-sm text-gray-500 dark:text-gray-400">
        Changed your mind?{" "}
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
