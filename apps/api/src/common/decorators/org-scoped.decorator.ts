import type { OrgScope } from "../tenancy/org-scope.js";

/**
 * Runtime guard for repository methods — NOT a source of the scope, and not
 * a param decorator. See CODING_STANDARDS.md §10 for the full rationale.
 *
 * Apply to any repository method whose first parameter is an `OrgScope`.
 * Throws if that argument is missing or malformed, so a call site that
 * forgot to pass scope fails immediately and loudly at the call, not with a
 * silent cross-tenant query. It does not read anything from request context
 * itself — that would make repositories untestable outside a request.
 */
export function OrgScoped() {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function orgScopedWrapper(
      this: unknown,
      scope: OrgScope,
      ...rest: unknown[]
    ) {
      if (
        !scope ||
        typeof scope.organizationId !== "number" ||
        !Number.isInteger(scope.organizationId)
      ) {
        throw new Error(
          `${propertyKey} was called without a valid OrgScope as its first argument — ` +
            "this is a coding-standards violation (missing tenant scope), not a business error.",
        );
      }
      return original.call(this, scope, ...rest);
    };
    return descriptor;
  };
}
