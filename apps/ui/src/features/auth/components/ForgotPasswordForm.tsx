"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button, Card, FormField, Input } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useState } from "react";
import { useForgotPassword } from "../hooks";

export function ForgotPasswordForm() {
  const forgotPasswordMutation = useForgotPassword();

  const [organizationSlug, setOrganizationSlug] = useState(
    "texawave-innovations",
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await forgotPasswordMutation.mutateAsync({ organizationSlug, email });
      // The API returns the same 200 whether or not the email exists
      // (anti-enumeration) — the UI shows one generic success state either
      // way, never a "no account found" branch.
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server — check your connection and try again.",
      );
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Forgot password
        </h1>
        <Alert variant="success" title="Check your email">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password.
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Forgot password
      </h1>
      <p className="mt-1 mb-6 text-theme-sm text-gray-500 dark:text-gray-400">
        Enter your organization and email below and we&apos;ll send you a link
        to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Organization">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              disabled={forgotPasswordMutation.isPending}
              required
            />
          )}
        </FormField>
        <FormField label="Email">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              placeholder="you@texawave.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={forgotPasswordMutation.isPending}
              required
            />
          )}
        </FormField>
        {error ? (
          <Alert variant="error" title="Something went wrong">
            {error}
          </Alert>
        ) : null}
        <Button
          type="submit"
          loading={forgotPasswordMutation.isPending}
          className="w-full"
        >
          Send reset link
        </Button>
        <Link
          href="/login"
          className="text-center text-theme-sm text-brand-800 hover:underline"
        >
          Back to sign in
        </Link>
      </form>
    </Card>
  );
}
