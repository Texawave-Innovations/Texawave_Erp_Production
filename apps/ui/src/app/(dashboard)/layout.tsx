"use client";

import { Button } from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DynamicSidebar } from "@/components/DynamicSidebar";
import { useMe } from "@/hooks/usePermission";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Client-side route guard ONLY — see Docs/CODING_STANDARDS.md "Frontend
 * API/state/error standard" for why: the access token lives in memory
 * (Zustand), never a cookie, so Next.js middleware (which runs
 * server/edge-side and can't see in-memory JS state) cannot gate this
 * route. A real server-verified gate needs the token moved into an
 * httpOnly cookie via a BFF — not implemented here, out of scope for this
 * foundation. This guard is enough to keep an unauthenticated user from
 * seeing the dashboard shell flash before redirecting, nothing more.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);
  const [navOpen, setNavOpen] = useState(false);

  // Prime the current user's profile and permissions
  const me = useMe();
  const mustChangePassword = me.data?.mustChangePassword === true;

  async function handleSignOut() {
    // Best-effort: revoke server-side refresh tokens too, but don't block
    // the UI on it — the local state clear below is what actually matters
    // for this browser tab.
    void apiClient.post("/auth/logout").catch(() => undefined);
    clear();
    queryClient.clear();
    router.push("/login");
  }

  // A hire with an employee record who has not finished onboarding belongs
  // in the wizard, not the admin area. Accounts with no employee record get
  // no data here and are never redirected.
  const employee = useMyEmployee();
  const onboardingIncomplete =
    employee.data !== undefined &&
    employee.data.onboardingStatus !== "COMPLETE";

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    } else if (mustChangePassword) {
      // A temporary password must be replaced before anything else is reachable.
      router.replace("/change-password");
    } else if (onboardingIncomplete) {
      router.replace("/onboarding");
    }
  }, [accessToken, mustChangePassword, onboardingIncomplete, router]);

  if (!accessToken || mustChangePassword || onboardingIncomplete) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape") setNavOpen(false);
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 lg:px-6 dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-3">
          {/* Below lg the sidebar is an off-canvas drawer; this button is its only opener. */}
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
            TexaWave ERP
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
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
        <DynamicSidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
