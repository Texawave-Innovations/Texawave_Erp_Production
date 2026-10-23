"use client";

import {
  ApiError,
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@texawave-erp/core";
import { Alert, Button } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useChangePassword } from "../hooks";
import { TexaLogo } from "./login_page/TexaLogo";

type FieldKey = keyof ChangePasswordFormValues;

const EMPTY: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const mutation = useChangePassword();

  const [values, setValues] = useState<ChangePasswordFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function set<K extends FieldKey>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function clearError(key: FieldKey) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
      <>
        {/* Mobile / Tablet Top Branding */}
        <div className="lg:hidden flex flex-col items-center mb-6 pointer-events-auto">
          <TexaLogo size="md" is3d={true} />
          <p className="mt-2 text-[11px] font-sans text-slate-600 tracking-wider uppercase font-semibold">
            Enterprise Engineering Platform
          </p>
        </div>

        <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 rounded-3xl relative z-30 pointer-events-auto transition-all flex flex-col justify-between">
          <div className="flex flex-col items-center justify-center mb-6">
            <TexaLogo size="md" is3d={true} />
            <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight font-sans">
              Password Changed
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal text-center">
              Your credentials have been securely updated
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <Alert variant="success" title="You're all set">
              Your password has been updated successfully. Please sign in with
              your new password to continue.
            </Alert>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            onClick={() => router.replace("/login")}
          >
            Go to sign in →
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
        <p className="mt-2 text-[11px] font-sans text-slate-600 tracking-wider uppercase font-semibold">
          Enterprise Engineering Platform
        </p>
      </div>

      <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 rounded-3xl relative z-30 pointer-events-auto transition-all flex flex-col justify-between">
        {/* Header: Official TEXA Logo + Title + Subtitle */}
        <div className="flex flex-col items-center justify-center mb-4">
          <TexaLogo size="md" is3d={true} />
          <h1 className="mt-3 text-2xl font-bold text-slate-900 tracking-tight font-sans text-center">
            Change your password
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal text-center max-w-xs leading-snug">
            Choose a new password for your account to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="flex flex-col gap-3 flex-1 justify-between"
          noValidate
        >
          {/* Current Password Field */}
          <div className="flex flex-col">
            <label
              htmlFor="current-password"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Current (temporary) password{" "}
              <span className="text-red-500">*</span>
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
                id="current-password"
                aria-label="Current (temporary) password"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter current temporary password"
                value={values.currentPassword}
                onChange={(e) => {
                  set("currentPassword", e.target.value);
                  clearError("currentPassword");
                }}
                disabled={mutation.isPending}
                required
                suppressHydrationWarning
                className={`glass-input-field w-full h-11 pl-10.5 pr-11 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none ${
                  errors.currentPassword
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex={-1}
                suppressHydrationWarning
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={
                  showCurrentPassword ? "Hide password" : "Show password"
                }
              >
                {showCurrentPassword ? (
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
            {errors.currentPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {errors.currentPassword}
              </p>
            )}
          </div>

          {/* New Password Field */}
          <div className="flex flex-col">
            <label
              htmlFor="new-password"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              New password <span className="text-red-500">*</span>
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
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={values.newPassword}
                onChange={(e) => {
                  set("newPassword", e.target.value);
                  clearError("newPassword");
                }}
                disabled={mutation.isPending}
                required
                suppressHydrationWarning
                className={`glass-input-field w-full h-11 pl-10.5 pr-11 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none ${
                  errors.newPassword
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
                suppressHydrationWarning
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
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
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {errors.newPassword}
              </p>
            )}
          </div>

          {/* Confirm New Password Field */}
          <div className="flex flex-col">
            <label
              htmlFor="confirm-password"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Confirm new password <span className="text-red-500">*</span>
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
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={values.confirmPassword}
                onChange={(e) => {
                  set("confirmPassword", e.target.value);
                  clearError("confirmPassword");
                }}
                disabled={mutation.isPending}
                required
                suppressHydrationWarning
                className={`glass-input-field w-full h-11 pl-10.5 pr-11 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none ${
                  errors.confirmPassword
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                suppressHydrationWarning
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
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
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Password Requirement Hint & Back to Sign In Row (Exact match with Login auxiliary row) */}
          <div className="flex items-center justify-between text-sm pt-0.5">
            <span className="text-xs font-normal text-slate-500">
              Min. 8 chars (upper, lower, num, sym)
            </span>

            <Link
              href="/login"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Back to sign in
            </Link>
          </div>

          {/* Submit Error Alert */}
          {submitError && (
            <Alert variant="error" title="Could not change your password">
              {submitError}
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            className="w-full mt-1"
          >
            Change password →
          </Button>
        </form>
      </div>
    </>
  );
}
