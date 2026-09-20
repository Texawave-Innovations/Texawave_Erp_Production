import type { OrgScope } from "./org-scope.js";

/**
 * Merge a caller-supplied filter with the tenant scope, guaranteeing the
 * scope always wins. `scope` is spread LAST — a `filter.organizationId`
 * supplied by a caller (directly, or via a query param bound into a filter
 * DTO) can never override it. See CODING_STANDARDS.md §10 for the bug this
 * closes in the original (unimplemented) draft of `@OrgScoped()`.
 */
export function tenantWhere<F extends object>(
  scope: OrgScope,
  filter?: F,
): F & OrgScope {
  return { ...(filter ?? ({} as F)), ...scope };
}
