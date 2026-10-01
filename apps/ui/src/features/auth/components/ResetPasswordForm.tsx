"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button, Card, FormField, Input } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useResetPassword } from "../hooks";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const resetPasswordMutation = useResetPassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({ token, newPassword });
      setSubmitted(true);
    } catch (err) {
      // Never reveals *why* the token failed (invalid/expired/reused) — the
      // backend already collapses those into one generic message, and we
      // just surface it as-is (Docs' auth story non-negotiable).
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server — check your connection and try again.",
      );
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Reset password
        </h1>
        <Alert variant="error" title="Invalid link">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>{" "}
          page.
        </Alert>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Reset password
        </h1>
        <Alert variant="success" title="Password reset">
          Your password has been reset. All other active sessions have been
          signed out.
        </Alert>
        <Button className="mt-4 w-full" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Reset password
      </h1>
      <p className="mt-1 mb-6 text-theme-sm text-gray-500 dark:text-gray-400">
        Choose a new password for your account below.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="New password">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={resetPasswordMutation.isPending}
              required
            />
          )}
        </FormField>
        <FormField label="Confirm new password">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={resetPasswordMutation.isPending}
              required
            />
          )}
        </FormField>
        {error ? (
          <Alert variant="error" title="Could not reset password">
            {error}
          </Alert>
        ) : null}
        <Button
          type="submit"
          loading={resetPasswordMutation.isPending}
          className="w-full"
        >
          Reset password
        </Button>
      </form>
    </Card>
  );
}
