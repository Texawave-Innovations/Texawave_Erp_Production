/**
 * Every TanStack Query key in the app MUST start with the current
 * organization id (Docs/CODING_STANDARDS.md "Frontend API/state/error
 * standard" — organization-aware cache separation). Switching organizations
 * or logging out then just means: stop refetching the old org's queries
 * (they're a disjoint key prefix) and, on logout, clear the cache entirely.
 * A plain array here (not a class) because TanStack Query keys must be
 * serializable and structurally comparable.
 */
export function orgScopedKey(
  organizationId: string,
  // `object` rather than `Record<string, unknown>` deliberately — the
  // latter requires an explicit index signature to structurally match,
  // which rejects perfectly normal named interfaces (e.g. a query-filter
  // type) passed in from a feature's hooks.ts.
  ...parts: ReadonlyArray<string | number | object>
): readonly unknown[] {
  return [organizationId, ...parts];
}
