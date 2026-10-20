import { ApiClient, ApiError, decodeJwtPayload } from "@texawave-erp/core";
import type { AuthTokens } from "@texawave-erp/api-types";
import { readStoredSession, useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
});

/** Populates the auth store from a token pair, including decoding
 * `organizationId` off the access token for query-key scoping (see
 * decode-jwt.ts — display/cache-key use only, never a security decision). */
export function applyAuthTokens(tokens: AuthTokens): void {
  useAuthStore.getState().setTokens(tokens);
  const payload = decodeJwtPayload<{ organizationId: number }>(
    tokens.accessToken,
  );
  if (payload) {
    useAuthStore.getState().setOrganization({
      organizationId: payload.organizationId,
      organizationSlug: useAuthStore.getState().organizationSlug ?? "",
    });
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshTokens(): Promise<void> {
  const { refreshToken, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    throw ApiError.networkError(new Error("No refresh token available"));
  }
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      throw new Error(`Refresh failed with status ${response.status}`);
    }
    const json = (await response.json()) as { data: AuthTokens };
    applyAuthTokens(json.data);
  } catch (error) {
    clear();
    throw error;
  }
}

/**
 * Wraps a request with a single silent-refresh-and-retry on 401
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard" —
 * authentication-expiry handling). Concurrent 401s share one in-flight
 * refresh via `refreshPromise` instead of each firing their own — the
 * "pending-request handling during context changes" requirement. If the
 * refresh itself fails, the original `ApiError` propagates and the auth
 * store is cleared, which the `(dashboard)` layout's guard reacts to by
 * redirecting to login.
 */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.isAuthError) {
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return await fn();
    }
    throw error;
  }
}

let restorePromise: Promise<void> | null = null;

/**
 * Brings the session back after a full page reload: if a refresh token was
 * saved for this tab, trade it for a fresh access token so the user stays on
 * the page they were on. Safe to call repeatedly (React strict mode runs
 * effects twice, and refresh tokens rotate, so exactly one exchange may run).
 * Never throws: a failed restore leaves the user signed out.
 */
export function restoreSession(): Promise<void> {
  restorePromise ??= (async () => {
    if (useAuthStore.getState().accessToken) return;
    const stored = readStoredSession();
    if (!stored) return;
    useAuthStore.setState({
      refreshToken: stored.refreshToken,
      organizationSlug: stored.organizationSlug,
    });
    try {
      await refreshTokens();
    } catch {
      // refreshTokens() already cleared the store; the guards send the user to /login.
    }
  })();
  return restorePromise;
}
