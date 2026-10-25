"use client";

import { ApiError } from "@texawave-erp/core";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import { PortalSidebar } from "@/features/employee-self-service/portal/components/PortalSidebar";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { useMe } from "@/hooks/usePermission";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

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
      router.replace("/self-service");
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
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            TexaWave ERP
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
      </div>
    );
  }

  const fullName = employee.data.fullName;
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "E";

  // Same shell as the legacy employee portal (TexaWave_ERP_old
  // src/modules/employee/EmployeePortalLayout.tsx): a full-height frame with
  // a slim top bar (logo + "Texawave ERP / Employee Portal" on the left;
  // notifications, avatar + name + employee code, Logout on the right), the
  // grouped portal sidebar, and a scrolling content pane.
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950"
      onKeyDown={(e) => {
        if (e.key === "Escape") setNavOpen(false);
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200/60 bg-white/80 px-4 shadow-sm backdrop-blur-md lg:px-5 dark:border-gray-800 dark:bg-gray-900/80">
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700">
            <TexaLogo size="sm" variant="mark" className="h-6 w-auto" />
          </div>
          <div className="min-w-0 leading-none">
            <p className="truncate text-theme-sm font-bold text-gray-900 dark:text-white/90">
              Texawave ERP
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Employee Portal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2 border-l border-gray-200/60 pl-3 dark:border-gray-800">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan shadow-sm">
              <span className="text-[10px] font-bold text-white">
                {initials}
              </span>
            </div>
            <div className="hidden text-right leading-none sm:block">
              <p className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {fullName}
              </p>
              <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {employee.data.employeeCode}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 gap-1.5 text-gray-500 hover:text-error-600 dark:text-gray-400"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
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
        <PortalSidebar
          open={navOpen}
          onNavigate={() => setNavOpen(false)}
          name={fullName}
          initials={initials}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-50/60 dark:bg-gray-900/40">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
