"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/usePermission";
import { hasWorkspaceAccess } from "@/features/auth/landing";
import { useMyEmployee } from "@/features/onboarding/hooks";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { HorizontalNavbar } from "@/components/layout/HorizontalNavbar";
import { AssistantWidget } from "@/features/scm/overview/assistant/AssistantWidget";
import { useUserPreferences } from "@/features/settings/preferences/hooks";
import {
  applyDensityToDom,
  applyThemeToDom,
  getStoredDensity,
  getStoredTheme,
} from "@/features/settings/preferences/theme-manager";

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

  // Prime the current user's profile and permissions
  const me = useMe();
  const mustChangePassword = me.data?.mustChangePassword === true;

  // Synchronize user preferences (density & theme) with DOM
  const prefQuery = useUserPreferences();

  useEffect(() => {
    // Enforce Main ERP theme immediately on mount and on preference update
    const userThemePref = prefQuery.data?.preferences?.theme;
    const storedTheme = getStoredTheme();
    const effectiveTheme = prefQuery.data?.effective?.theme;
    const targetTheme = (userThemePref ??
      storedTheme ??
      effectiveTheme ??
      "system") as "light" | "dark" | "system";
    applyThemeToDom(targetTheme);

    const userDensityPref = prefQuery.data?.preferences?.density;
    const storedDensity = getStoredDensity();
    const effectiveDensity = prefQuery.data?.effective?.density;
    const targetDensity = (userDensityPref ??
      storedDensity ??
      effectiveDensity ??
      "comfortable") as "compact" | "comfortable" | "spacious";
    applyDensityToDom(targetDensity);
  }, [prefQuery.data?.effective, prefQuery.data?.preferences]);

  // Route newly-invited users to onboarding on first login. Users who have
  // finished onboarding or who were provisioned via seed/admin bypass have
  // no data here and are never redirected.
  const employee = useMyEmployee();
  const onboardingIncomplete =
    employee.data !== undefined &&
    employee.data.onboardingStatus !== "COMPLETE";

  // Employees and Team Leads work in the portal: an account WITH an employee
  // record needs hr.workspace.access, sales.dashboard.read (or
  // settings.role.write) for this shell (hasWorkspaceAccess in
  // features/auth/landing.ts).
  // Accounts with no employee record (Super Admin) are never sent away. Wait
  // for both lookups so the HR shell never flashes for a portal-only user.
  const checkingShell =
    (me.data === undefined && !me.isError) ||
    (employee.data === undefined && !employee.isError);
  const portalOnly =
    me.data !== undefined &&
    employee.data !== undefined &&
    !hasWorkspaceAccess(me.data.permissions);

  async function handleSignOut() {
    void apiClient.post("/auth/logout").catch(() => undefined);
    clear();
    queryClient.clear();
    router.push("/login");
  }

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    } else if (mustChangePassword) {
      // A temporary password must be replaced before anything else is reachable.
      router.replace("/change-password");
    } else if (onboardingIncomplete) {
      router.replace("/onboarding");
    } else if (portalOnly) {
      router.replace("/portal");
    }
  }, [
    accessToken,
    mustChangePassword,
    onboardingIncomplete,
    portalOnly,
    router,
  ]);

  if (
    !accessToken ||
    mustChangePassword ||
    onboardingIncomplete ||
    portalOnly ||
    checkingShell
  ) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-linear-to-b from-[#f0f7ff] via-[#f4fbfb] to-[#f8fafc] dark:bg-[#08090D] dark:bg-none">
      {/* Full-width horizontal navigation — replaces left sidebar + old header */}
      <HorizontalNavbar onSignOut={() => void handleSignOut()} />

      {/* Page content — full width, no left offset */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>

      {/* SCM Copilot launcher — renders only on /scm screens. */}
      <AssistantWidget />
    </div>
  );
}
