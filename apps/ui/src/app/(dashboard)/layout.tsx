"use client";

import { Button } from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          TexaWave ERP
        </span>
        <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <DynamicSidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
