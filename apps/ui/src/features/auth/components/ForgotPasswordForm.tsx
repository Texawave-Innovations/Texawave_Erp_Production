"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForgotPassword } from "../hooks";
import { TexaLogo } from "./login_page/TexaLogo";

export function ForgotPasswordForm() {
  const router = useRouter();
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
      setSubmitted(true);
    } catch (err) {
      console.error("Forgot password failed:", err);
      setError(
        ApiError.isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reach the server — check your connection and try again.",
      );
    }
  }

  if (submitted) {
    return (
      <>
        {/* Mobile / Tablet Top Branding */}
        <div className="lg:hidden flex flex-col items-center mb-6 pointer-events-auto">
          <TexaLogo size="md" is3d={true} />
          <p className="mt-2 text-xs font-sans text-slate-600 tracking-wider uppercase font-semibold">
            Enterprise Engineering Platform
          </p>
        </div>

        <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 rounded-3xl relative z-30 pointer-events-auto transition-all flex flex-col justify-between">
          <div className="flex flex-col items-center justify-center mb-6">
            <TexaLogo size="md" is3d={true} />
            <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight font-sans">
              Check your email
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal text-center">
              Instructions have been sent to your inbox
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <Alert variant="success" title="Link Sent">
              If an account exists for that email, we&apos;ve sent a secure link
              to reset your password.
            </Alert>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            onClick={() => router.push("/login")}
          >
            Back to sign in →
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile / Tablet Top Branding */}
      <div className="lg:hidden flex flex-col items-center mb-6 pointer-events-auto">
        <TexaLogo size="md" is3d={true} />
        <p className="mt-2 text-xs font-sans text-slate-600 tracking-wider uppercase font-semibold">
          Enterprise Engineering Platform
        </p>
      </div>

      <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 rounded-3xl relative z-30 pointer-events-auto transition-all flex flex-col justify-between">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-5">
          <TexaLogo size="md" is3d={true} />
          <h1 className="mt-3.5 text-2xl font-bold text-slate-900 tracking-tight font-sans">
            Forgot password
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal text-center">
            Enter your details to receive a password reset link
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="flex flex-col gap-3.5 flex-1 justify-between"
        >
          {/* Organization Field */}
          <div className="flex flex-col">
            <label
              htmlFor="forgot-org"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Organization
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              <input
                id="forgot-org"
                aria-label="Organization"
                type="text"
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                disabled={forgotPasswordMutation.isPending}
                required
                suppressHydrationWarning
                className="glass-input-field w-full h-11 pl-10.5 pr-4 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="flex flex-col">
            <label
              htmlFor="forgot-email"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                id="forgot-email"
                aria-label="Email"
                type="email"
                placeholder="you@texawave.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={forgotPasswordMutation.isPending}
                required
                suppressHydrationWarning
                className="glass-input-field w-full h-11 pl-10.5 pr-4 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Guidance Callout (Exact size of 3rd field) */}
          <div className="h-11 px-3.5 rounded-xl bg-blue-50/70 border border-blue-100/90 text-xs text-slate-600 flex items-center gap-2.5">
            <svg
              className="w-4 h-4 text-blue-600 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="truncate">
              Reset link will be sent to your corporate email
            </span>
          </div>

          {/* Auxiliary Row (Exact match with Login auxiliary row) */}
          <div className="flex items-center justify-between text-sm pt-0.5">
            <span className="text-xs text-slate-500">Need assistance?</span>

            <Link
              href="/login"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Back to sign in
            </Link>
          </div>

          {/* Error Alert */}
          {error ? (
            <Alert variant="error" title="Something went wrong">
              {error}
            </Alert>
          ) : null}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={forgotPasswordMutation.isPending}
            className="w-full mt-1"
          >
            Send reset link →
          </Button>
        </form>
      </div>
    </>
  );
}
