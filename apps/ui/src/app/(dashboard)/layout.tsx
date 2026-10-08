"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/usePermission";
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
import { DynamicSidebar } from "@/components/DynamicSidebar";
import { ErpPrimarySidebar } from "@/components/layout/ErpPrimarySidebar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";

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
  useMe();

  async function handleSignOut() {
    void apiClient.post("/auth/logout").catch(() => undefined);
    clear();
    queryClient.clear();
    router.push("/login");
  }

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    }
  }, [accessToken, router]);

  if (!accessToken) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50/50 dark:bg-gray-900">
      {/* Tier 1: Leftmost ERP Primary Module Sidebar */}
      <ErpPrimarySidebar />

      {/* Tier 2: Dynamic RBAC Navigation Sidebar */}
      <DynamicSidebar />

      {/* Main Content Workspace Column with Top Global Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <GlobalHeader onSignOut={() => void handleSignOut()} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
