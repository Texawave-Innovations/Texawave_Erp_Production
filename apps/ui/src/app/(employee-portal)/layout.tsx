"use client";

import { ApiError } from "@texawave-erp/core";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { DynamicSidebar } from "@/components/DynamicSidebar";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { useMe } from "@/hooks/usePermission";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

import { useUserPreferences } from "@/features/settings/preferences/hooks";
import {
  applyDensityToDom,
  applyPortalThemeToDom,
  getStoredDensity,
  getStoredPortalTheme,
} from "@/features/settings/preferences/theme-manager";

/**
 * Employee-portal route guard (Docs/ARCHITECTURE.md §7). Routes by the user's
 * state, in this order: signed out → sign-in; still on a temporary password →
 * change-password; no employee record at all → admin area (not an error —
 * see below); profile not complete → onboarding wizard; complete → portal.
 * Client-side only, like the dashboard guard — the API independently refuses
 * submit until the password is changed, so this is UX routing, not security.
 */
export default function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useMe();
  const employee = useMyEmployee();
  const [navOpen, setNavOpen] = useState(false);

  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);

  const userId = me.data?.userId;

  // Manage independent theme for employee self-service portal
  const [portalTheme, setPortalTheme] = useState<"light" | "dark">(() => {
    return getStoredPortalTheme(userId) ?? "light";
  });
  const [prevUserId, setPrevUserId] = useState(userId);

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setPortalTheme(getStoredPortalTheme(userId) ?? "light");
  }

  useEffect(() => {
    applyPortalThemeToDom(portalTheme, userId);
  }, [portalTheme, userId]);

  const handleTogglePortalTheme = () => {
    const nextTheme: "light" | "dark" =
      portalTheme === "dark" ? "light" : "dark";
    setPortalTheme(nextTheme);
    applyPortalThemeToDom(nextTheme, userId);
  };

  // Synchronize UI density with DOM in the portal shell (isolated from theme)
  const prefQuery = useUserPreferences();

  useEffect(() => {
    if (prefQuery.data?.effective) {
      const { density } = prefQuery.data.effective;
      const userDensityPref = prefQuery.data.preferences?.density;

      if (userDensityPref) {
        applyDensityToDom(
          userDensityPref as "compact" | "comfortable" | "spacious",
        );
      } else {
        const storedDensity = getStoredDensity();
        if (storedDensity) {
          applyDensityToDom(storedDensity);
        } else if (density) {
          applyDensityToDom(density as "compact" | "comfortable" | "spacious");
        }
      }
    }
  }, [prefQuery.data?.effective, prefQuery.data?.preferences]);

  function handleSignOut() {
    void apiClient.post("/auth/logout").catch(() => undefined);
    clear();
    queryClient.clear();
    router.push("/login");
  }

  const mustChangePassword = me.data?.mustChangePassword === true;
  const isComplete = employee.data?.onboardingStatus === "COMPLETE";
  const onOnboarding = pathname.startsWith("/onboarding");
  // NOT_AN_EMPLOYEE means the backend positively confirmed there is no
  // Employee row for this account (e.g. Super Admin, who is granted every
  // permission but has no employee record) — a stale bookmark or shared link
  // can land such an account here, and it belongs in the admin area, not an
  // error screen. Any OTHER lookup failure is a genuine anomaly and keeps
  // the existing error screen below.
  const hasNoEmployeeRecord =
    employee.error instanceof ApiError &&
    employee.error.errorCode === "NOT_AN_EMPLOYEE";
  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    if (hasNoEmployeeRecord) {
      router.replace("/hr");
      return;
    }
    if (!employee.data) return;
    if (isComplete && onOnboarding) {
      router.replace("/portal");
    } else if (!isComplete && !onOnboarding) {
      router.replace("/onboarding");
    }
  }, [
    accessToken,
    mustChangePassword,
    hasNoEmployeeRecord,
    employee.data,
    isComplete,
    onOnboarding,
    router,
  ]);

  if (!accessToken || mustChangePassword || hasNoEmployeeRecord) {
    return null;
  }

  if (employee.isError) {
    return (
      <ErrorState
        title="Could not load your profile"
        description="Something went wrong checking your employee record. Try again, or contact HR if this keeps happening."
        onRetry={() => void employee.refetch()}
      />
    );
  }

  if (!employee.data) {
    return (
      <div className="p-6" aria-busy="true">
        <Skeleton />
      </div>
    );
  }

  if (isComplete === onOnboarding) return null;

  // Onboarding isn't finished yet, so there's nothing in the self-service
  // menu for this user to see — keep the wizard's plain single-column chrome
  // (no sidebar) until the profile is complete.
  if (!isComplete) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50/50 text-gray-900 dark:bg-[#08090D] dark:text-[#F8FAFC]">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-[#08090D]">
          <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            TexaWave ERP
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePortalTheme}
              aria-label={
                portalTheme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              title={
                portalTheme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/70 text-gray-600 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-cyan-500/40 dark:hover:bg-white/10 dark:hover:text-cyan-300 cursor-pointer"
            >
              {portalTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-gray-600 transition-transform hover:-rotate-12" />
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50/50 text-gray-900 dark:bg-[#08090D] dark:text-[#F8FAFC]"
      onKeyDown={(e) => {
        if (e.key === "Escape") setNavOpen(false);
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 lg:px-6 dark:border-[#1C2029] dark:bg-[#08090D]">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            TexaOne ERP
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Employee Portal Independent Theme Toggle */}
          <button
            type="button"
            onClick={handleTogglePortalTheme}
            aria-label={
              portalTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            title={
              portalTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/70 text-gray-600 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-cyan-500/40 dark:hover:bg-white/10 dark:hover:text-cyan-300 cursor-pointer"
          >
            {portalTheme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-gray-600 transition-transform hover:-rotate-12" />
            )}
          </button>
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {navOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
          />
        )}
        <DynamicSidebar
          open={navOpen}
          onNavigate={() => setNavOpen(false)}
          onlyRootCode="portal"
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
