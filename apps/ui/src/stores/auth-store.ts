import { create } from "zustand";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  organizationId: number | null;
  organizationSlug: string | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setOrganization: (organization: {
    organizationId: number;
    organizationSlug: string;
  }) => void;
  clear: () => void;
}

/**
 * Deliberate simplification for this foundation: tokens live in memory only
 * (this Zustand store), not `localStorage`/cookies — a full page reload logs
 * the user out. That's a real, documented limitation, not an oversight: a
 * production-grade "stay logged in across reloads" needs the refresh token
 * moved server-side (an httpOnly cookie set by a Next.js Route
 * Handler acting as a thin BFF) so it's never readable by page JS at all —
 * that's real security-relevant work, not a config toggle, and is out of
 * scope for this foundation. See Docs/CODING_STANDARDS.md "Frontend
 * API/state/error standard".
 *
 * Switching organizations or logging out both call `clear()` — paired with
 * `orgScopedKey()` (packages/core), that's enough to stop stale queries from
 * a previous org/session ever rendering (Docs/CODING_STANDARDS.md
 * "Organization/plant-aware cache separation").
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  organizationId: null,
  organizationSlug: null,
  setTokens: ({ accessToken, refreshToken }) =>
    set({ accessToken, refreshToken }),
  setOrganization: ({ organizationId, organizationSlug }) =>
    set({ organizationId, organizationSlug }),
  clear: () =>
    set({
      accessToken: null,
      refreshToken: null,
      organizationId: null,
      organizationSlug: null,
    }),
}));
