"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useState } from "react";
import { useForgotPassword } from "../hooks";
import { TexaLogo } from "./login_page/TexaLogo";

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
          <p className="mt-2 text-xs font-mono text-slate-600 tracking-wider uppercase font-semibold">
            Enterprise Engineering Platform
          </p>
        </div>

        <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 sm:p-9.5 rounded-3xl relative z-30 pointer-events-auto transition-all">
          <div className="flex flex-col items-center justify-center mb-6">
            <TexaLogo size="md" is3d={true} />
            <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight font-sans">
              Check your email
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal text-center">
              Instructions have been sent to your inbox
            </p>
          </div>

          <Alert variant="success" title="Link Sent">
            If an account exists for that email, we&apos;ve sent a secure link
            to reset your password.
          </Alert>

          <Link
            href="/login"
            className="w-full h-11.5 bg-[#00c853] hover:bg-[#00b248] active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(0,200,83,0.32)] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-6"
          >
            Back to sign in →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile / Tablet Top Branding */}
      <div className="lg:hidden flex flex-col items-center mb-6 pointer-events-auto">
        <TexaLogo size="md" is3d={true} />
        <p className="mt-2 text-xs font-mono text-slate-600 tracking-wider uppercase font-semibold">
          Enterprise Engineering Platform
        </p>
      </div>

      <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 sm:p-9.5 rounded-3xl relative z-30 pointer-events-auto transition-all">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-6">
          <TexaLogo size="md" is3d={true} />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight font-sans">
            Forgot password
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal text-center">
            Enter your details to receive a password reset link
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="flex flex-col gap-4"
        >
          {/* Organization Field */}
          <div className="flex flex-col">
            <label
              htmlFor="forgot-org"
              className="block text-sm font-medium text-slate-700 mb-1.5"
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
              className="block text-sm font-medium text-slate-700 mb-1.5"
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

          {/* Error Alert */}
          {error ? (
            <Alert variant="error" title="Something went wrong">
              {error}
            </Alert>
          ) : null}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={forgotPasswordMutation.isPending}
            suppressHydrationWarning
            className="w-full h-11.5 bg-[#00c853] hover:bg-[#00b248] active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(0,200,83,0.32)] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-1"
          >
            {forgotPasswordMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Send reset link →</span>
            )}
          </button>

          <Link
            href="/login"
            className="text-center text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline pt-1"
          >
            Back to sign in
          </Link>
        </form>
      </div>
    </>
  );
}
