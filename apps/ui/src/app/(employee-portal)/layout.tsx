"use client";

import { ApiError } from "@texawave-erp/core";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
      router.replace("/reference/tags");
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
