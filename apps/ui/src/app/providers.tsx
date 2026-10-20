"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@texawave-erp/ui-kit";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api-client";
import { createQueryClient } from "@/lib/query-client";

/** Server vs. Client Component boundary (Docs/CODING_STANDARDS.md "Frontend
 * API/state/error standard"): this is the one place the App Router tree
 * switches to client-rendered — everything below it may use hooks/state;
 * `app/layout.tsx` above it stays a Server Component. The QueryClient is
 * created inside `useState` (not at module scope) so each request/browser
 * tab gets its own instance — sharing one across requests on the server
 * would leak one user's cached data into another's response. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  // A reload drops the in-memory access token; restore the session from the
  // tab's saved refresh token BEFORE any page (and its auth guard) renders, so
  // a refresh keeps the user where they were instead of sending them to /login.
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    void restoreSession().finally(() => setSessionReady(true));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{sessionReady ? children : null}</ToastProvider>
    </QueryClientProvider>
  );
}
