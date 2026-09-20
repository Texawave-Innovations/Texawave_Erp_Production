"use client";

import { Button } from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

  async function handleSignOut() {
    // Best-effort: revoke server-side refresh tokens too, but don't block
    // the UI on it — the local state clear below is what actually matters
    // for this browser tab.
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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          TexaWave ERP
        </span>
        <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
