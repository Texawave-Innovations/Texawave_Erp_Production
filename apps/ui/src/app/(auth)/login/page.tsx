"use client";

import type { AuthTokens } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Alert } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import { apiClient, applyAuthTokens } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setOrganization = useAuthStore((s) => s.setOrganization);

  const [organizationSlug, setOrganizationSlug] = useState(
    "texawave-innovations",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      setOrganization({ organizationId: 0, organizationSlug });
      applyAuthTokens(data);
      router.push("/reference/tags");
    } catch (err) {
      // Values are intentionally NOT cleared on failure (Docs/DESIGN_SYSTEM.md)
      console.error("Login failed:", err);
      setError(
        ApiError.isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
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

      {/* Premium Frosted Glassmorphism Login Card */}
      <div className="glass-login-card login-panel-card w-full sm:w-110 max-w-110 p-8 sm:p-9.5 rounded-3xl relative z-30 pointer-events-auto transition-all">
        {/* Header: Official TEXA Logo + Welcome back + Subtitle (Exact Image 1) */}
        <div className="flex flex-col items-center justify-center mb-6">
          <TexaLogo size="md" is3d={true} />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight font-sans">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Sign in to access TexaWave ERP
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="flex flex-col gap-4"
        >
          {/* Organization Field (Exact Image 1) */}
          <div className="flex flex-col">
            <label
              htmlFor="organization"
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
                id="organization"
                aria-label="Organization"
                type="text"
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                disabled={submitting}
                required
                suppressHydrationWarning
                className="glass-input-field w-full h-11 pl-10.5 pr-4 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Email Field (Exact Image 1) */}
          <div className="flex flex-col">
            <label
              htmlFor="email"
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
                id="email"
                aria-label="Email"
                type="email"
                placeholder="you@texawave.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
                suppressHydrationWarning
                className="glass-input-field w-full h-11 pl-10.5 pr-4 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Password Field with Lock Icon & Show/Hide Eye Toggle (Exact Image 1) */}
          <div className="flex flex-col">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Password
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
                id="password"
                aria-label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
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

          {/* Remember Me & Forgot Password Row (Exact Image 1) */}
          <div className="flex items-center justify-between text-sm pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                suppressHydrationWarning
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-600">
                Remember me
              </span>
            </label>

            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error Alert */}
          {error ? (
            <Alert variant="error" title="Sign-in failed">
              {error}
            </Alert>
          ) : null}

          {/* Primary Submit Button: Exact Green Button from Image 1 */}
          <button
            type="submit"
            disabled={submitting}
            suppressHydrationWarning
            className="w-full h-11.5 bg-[#00c853] hover:bg-[#00b248] active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(0,200,83,0.32)] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-1"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign in →</span>
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
}
