import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@texawave-erp/core";

/** One shared instance per browser tab (created lazily in `providers.tsx` via
 * `useState` so server-rendering never leaks state between requests — see
 * TanStack Query's own Next.js App Router guidance). Retry policy: never
 * retry a 4xx (it won't succeed by trying again), retry network/5xx errors
 * a couple of times. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
