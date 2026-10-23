"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useResetPassword } from "../hooks";
import { TexaLogo } from "./login_page/TexaLogo";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const resetPasswordMutation = useResetPassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      console.error("Reset password failed:", err);
      setError(
        ApiError.isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reach the server — check your connection and try again.",
      );
    }
  }
  if (!token) {
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
              Invalid Reset Link
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal text-center">
              This security token is missing or expired
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <Alert variant="error" title="Invalid Token">
              This reset link is missing its token. Please request a new one
              from the{" "}
              <Link href="/forgot-password" className="underline font-semibold">
                forgot password
              </Link>{" "}
              page.
            </Alert>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            onClick={() => router.push("/forgot-password")}
          >
            Request New Link →
          </Button>
        </div>
      </>
    );
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
              Password Reset
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal text-center">
              Your credentials have been securely updated
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <Alert variant="success" title="Success">
              Your password has been reset. All other active sessions have been
              signed out for security.
            </Alert>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            onClick={() => router.push("/login")}
          >
            Sign in now →
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
            Reset password
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal text-center">
            Choose a new secure password for your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="flex flex-col gap-3.5 flex-1 justify-between"
        >
          <div className="flex flex-col gap-3.5">
            {/* New Password */}
            <div className="flex flex-col">
              <label
                htmlFor="new-password"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
              >
                New password
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="new-password"
                  aria-label="New password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={resetPasswordMutation.isPending}
                  required
                  suppressHydrationWarning
                  className="glass-input-field w-full h-11 pl-10.5 pr-11 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  suppressHydrationWarning
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="w-4.5 h-4.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4.5 h-4.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="flex flex-col">
              <label
                htmlFor="confirm-password"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
              >
                Confirm new password
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="confirm-password"
                  aria-label="Confirm new password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={resetPasswordMutation.isPending}
                  required
                  suppressHydrationWarning
                  className="glass-input-field w-full h-11 pl-10.5 pr-4 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Guidance Callout */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100/90 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
              <svg
                className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>
                Please ensure your password has at least 8 characters, including
                upper and lowercase letters, numbers, and special symbols.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {/* Error Alert */}
            {error ? (
              <Alert variant="error" title="Could not reset password">
                {error}
              </Alert>
            ) : null}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={resetPasswordMutation.isPending}
              className="w-full"
            >
              Reset password →
            </Button>

            <Link
              href="/login"
              className="text-center text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline pt-0.5"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
