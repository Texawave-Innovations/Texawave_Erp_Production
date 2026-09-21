import type { TeamScope } from "../tenancy/team-scope.js";

/**
 * Same runtime-guard shape as `@OrgScoped()` (org-scoped.decorator.ts), one
 * level down — the actual thing enforcing "team leads see their team,
 * HR/Admin see everyone" (Docs/CODING_STANDARDS.md §10a). Apply to any
 * repository method whose first parameter is a `TeamScope`.
 */
export function TeamScoped() {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function teamScopedWrapper(
      this: unknown,
      scope: TeamScope,
      ...rest: unknown[]
    ) {
      if (!scope || !["own", "team", "all"].includes(scope.level)) {
        throw new Error(
          `${propertyKey} was called without a valid TeamScope — this is a coding-standards violation, not a business error`,
        );
      }
      return original.call(this, scope, ...rest);
    };
    return descriptor;
  };
}
