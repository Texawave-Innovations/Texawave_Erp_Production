"use client";

import type { AuthTokens } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, FormField, Input } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { landingPathAfterLogin } from "@/features/auth/landing";
import { apiClient, applyAuthTokens } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setOrganization = useAuthStore((s) => s.setOrganization);

  const [organizationSlug, setOrganizationSlug] = useState(
    "texawave-innovations",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await apiClient.post<AuthTokens>("/auth/login", {
        organizationSlug,
        email,
        password,
      });
      // A previous session's cached queries (e.g. "am I an employee?") are
      // org-scoped, not user-scoped — without this, signing in as a second
      // user in the same organization can be served the first user's stale
      // cache entries before their own requests land. Mirrors
      // handleSignOut()'s queryClient.clear() in (employee-portal)/layout.tsx.
      queryClient.clear();
      setOrganization({ organizationId: 0, organizationSlug });
      applyAuthTokens(data);
      router.push(await landingPathAfterLogin());
    } catch (err) {
      // Values are intentionally NOT cleared on failure
      // (Docs/DESIGN_SYSTEM.md "Preserve entered form values when
      // submission fails") — only the password would typically be cleared
      // by a browser's own autofill behavior, which we don't fight.
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <Card className="w-full max-w-sm">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Sign in
        </h1>
        <p className="mt-1 mb-6 text-theme-sm text-gray-500 dark:text-gray-400">
          Enter your organization and email below to sign in to your account.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Organization">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                disabled={submitting}
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
                disabled={submitting}
                required
              />
            )}
          </FormField>
          <FormField
            label="Password"
            labelAction={
              <Link
                href="/forgot-password"
                className="text-theme-sm text-brand-800 hover:underline"
              >
                Forgot your password?
              </Link>
            }
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
            )}
          </FormField>
          {error ? (
            <Alert variant="error" title="Sign-in failed">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
