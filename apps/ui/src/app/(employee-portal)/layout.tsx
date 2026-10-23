"use client";

import { ApiError } from "@texawave-erp/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  ErrorState,
  Skeleton,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { DynamicSidebar } from "@/components/DynamicSidebar";
import { TexaLogo } from "@/features/auth/components/login_page/TexaLogo";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { NavbarDateTimeCalendar } from "@/components/layout/NavbarDateTimeCalendar";
import { getResolvedAvatarUrl } from "@/features/hr/components/EmployeeIdentity";
import { useMyDocuments, useMyEmployee } from "@/features/onboarding/hooks";
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
  const documents = useMyDocuments();
  const [navOpen, setNavOpen] = useState(false);

  const photoDoc = documents.data?.find(
    (d) => d.documentType === "PROFILE_PHOTO",
  );
  const rawAvatarUrl =
    employee.data?.avatarUrl ||
    (photoDoc ? "/employee/profile/documents/PROFILE_PHOTO/file" : null);
  const resolvedAvatarUrl = getResolvedAvatarUrl(rawAvatarUrl);

  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const showAvatarImg = Boolean(
    resolvedAvatarUrl && failedAvatarUrl !== resolvedAvatarUrl,
  );

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
      <div className="flex min-h-screen flex-col bg-linear-to-b from-sky-50/60 via-[#f8fbff] to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-sky-200/80 bg-white/85 px-4 sm:px-6 lg:px-8 backdrop-blur-md shadow-2xs dark:border-slate-800 dark:bg-slate-900/85">
          <Link
            href="/onboarding"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label="TexaOne ERP"
          >
            <TexaLogo size="md" variant="full" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            {employee.data && (
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                <span className="font-bold text-[#0a3271] dark:text-sky-200">
                  {employee.data.fullName}
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  {employee.data.employeeCode}
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-xl border-sky-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Sign out</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  const empName = employee.data?.fullName || "Employee";
  const empCode = employee.data?.employeeCode || "";
  const initials = empName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-linear-to-b from-[#eef4fb] via-[#f1f5fa] to-[#eaf1f9] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans"
      onKeyDown={(e) => {
        if (e.key === "Escape") setNavOpen(false);
      }}
    >
      <header className="glass-navbar sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden dark:text-gray-300 dark:hover:bg-gray-800"
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
          <Link
            href="/portal"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label="TexaOne ERP"
          >
            <TexaLogo size="md" variant="full" className="h-8.5 w-auto" />
          </Link>
        </div>

        {/* Right Section: Interactive Calendar + Clock + Notifications + User Avatar Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NavbarDateTimeCalendar />
          <NotificationBell />

          {/* User Profile Avatar Dropdown Menu */}
          <div className="relative shrink-0">
            <DropdownMenu
              align="end"
              headerSlot={
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white/90">
                    {empName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {empCode ? `ID: ${empCode}` : "Self-Service"}
                  </p>
                </div>
              }
              options={[
                {
                  label: "Sign out",
                  Icon: <LogOut className="h-4 w-4" />,
                  variant: "destructive",
                  onClick: handleSignOut,
                },
              ]}
            >
              <button
                type="button"
                aria-label={`Profile menu for ${empName}`}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-md p-1 sm:px-2.5 sm:py-1.5 text-left hover:bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-sky-900/40 dark:bg-gray-800/70 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200/90 bg-linear-to-br from-[#1769F5] to-cyan-500 text-xs font-bold text-white shadow-xs">
                  {showAvatarImg ? (
                    <img
                      key={resolvedAvatarUrl}
                      src={resolvedAvatarUrl!}
                      alt={empName}
                      className="h-full w-full object-cover"
                      onError={() => setFailedAvatarUrl(resolvedAvatarUrl)}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white/90 max-w-36 truncate">
                    {empName}
                  </span>
                  <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 max-w-36 truncate">
                    {empCode}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Viewport Shell: Fixed Left Sidebar + Scrollable Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
