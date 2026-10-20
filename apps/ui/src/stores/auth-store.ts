import { create } from "zustand";

export interface AuthUser {
  userId: number;
  organizationId: number;
  email: string;
  fullName: string;
  roleIds: number[];
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  organizationId: number | null;
  organizationSlug: string | null;
  user: AuthUser | null;
  permissions: string[];
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setOrganization: (organization: {
    organizationId: number;
    organizationSlug: string;
  }) => void;
  setUser: (user: AuthUser | null) => void;
  setPermissions: (permissions: string[]) => void;
  clear: () => void;
}

/**
 * The access token lives in memory only. To survive a page reload (so a
 * refresh keeps the user on the same page instead of bouncing to /login) the
 * refresh token and organization slug are mirrored into `sessionStorage` —
 * scoped to the browser tab and cleared when the tab closes or the user logs
 * out. On load, `restoreSession()` (lib/api-client.ts) exchanges the stored
 * refresh token for a fresh access token before any page renders.
 *
 * Trade-off, stated plainly: page JavaScript can read `sessionStorage`, so an
 * XSS bug could read the refresh token. Moving it into an httpOnly cookie via
 * a server-side BFF would remove that, and remains the stronger long-term
 * design (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 *
 * Switching organizations or logging out both call `clear()` — paired with
 * `orgScopedKey()` (packages/core), that's enough to stop stale queries from
 * a previous org/session ever rendering (Docs/CODING_STANDARDS.md
 * "Organization/plant-aware cache separation").
 */
const SESSION_KEY = "texa_session";

export interface StoredSession {
  refreshToken: string;
  organizationSlug: string | null;
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.refreshToken === "string" && parsed.refreshToken
      ? {
          refreshToken: parsed.refreshToken,
          organizationSlug:
            typeof parsed.organizationSlug === "string"
              ? parsed.organizationSlug
              : null,
        }
      : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  organizationId: null,
  organizationSlug: null,
  user: null,
  permissions: [],
  setTokens: ({ accessToken, refreshToken }) =>
    set({ accessToken, refreshToken }),
  setOrganization: ({ organizationId, organizationSlug }) =>
    set({ organizationId, organizationSlug }),
  setUser: (user) => set({ user }),
  setPermissions: (permissions) => set({ permissions }),
  clear: () =>
    set({
      accessToken: null,
      refreshToken: null,
      organizationId: null,
      organizationSlug: null,
      user: null,
      permissions: [],
    }),
}));

// Mirror the refresh token into sessionStorage; drop it only on a real
// sign-out (token present -> absent), never while a restore is in flight.
if (typeof window !== "undefined") {
  useAuthStore.subscribe((state, prev) => {
    try {
      if (state.refreshToken) {
        window.sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            refreshToken: state.refreshToken,
            organizationSlug: state.organizationSlug,
          }),
        );
      } else if (prev.refreshToken) {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Storage blocked — the session simply will not survive a reload.
    }
  });
}
