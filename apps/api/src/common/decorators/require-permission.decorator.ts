import { SetMetadata } from "@nestjs/common";
import { TEAM_ACCESS_LEVELS } from "../tenancy/team-scope.js";

export const PERMISSION_KEY = "requiredPermission";
export const SCOPED_PERMISSION_KEY = "requiredScopedPermission";
export const ANY_PERMISSION_KEY = "requiredAnyPermission";

/** `<module>.<entity>.<action>` — lower-case segments, `_` allowed inside a
 * segment (`employee_self_service`), exactly three of them. */
const SCOPE_PREFIX_PATTERN =
  /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** `<module>.<entity>.<action>[.<scope>]`, e.g. `reference.tags.write`
 * (Docs/CODING_STANDARDS.md §2). Checked by `PermissionsGuard`
 * (platform/roles-permissions) as an EXACT match — a route that must admit
 * more than one scope variant of a team-scoped permission wants
 * `@RequireScopedPermission()` instead. */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

/**
 * Admits a caller holding ANY ONE of the listed exact permissions. For a route
 * that two audiences legitimately reach through different permissions — e.g.
 * My Work, reached by an employee through `employee_self_service.work.write`
 * and by the Projects workspace through `projects.timer.write` — so adding the
 * newer permission never takes access away from holders of the older one.
 *
 * At least two are required (one is just `@RequirePermission()`), and each must
 * be a full permission code. Like the other decorators this only decides "may
 * this caller reach the route at all"; whose data they see is decided inside.
 */
export const RequireAnyPermission = (
  ...permissions: [string, string, ...string[]]
) => {
  if (permissions.length < 2 || permissions.some((p) => p.trim() === "")) {
    throw new Error(
      "@RequireAnyPermission() needs at least two non-empty permission codes; use @RequirePermission() for one",
    );
  }
  return SetMetadata(ANY_PERMISSION_KEY, permissions);
};

/**
 * For team-scoped data (Docs/CODING_STANDARDS.md §10a): admits a caller
 * holding ANY of `<prefix>.own`, `<prefix>.team` or `<prefix>.all`. The
 * guard only decides "may this caller reach the route at all"; which rows
 * they may see is decided afterwards by `TeamContextService.resolveScope()`
 * + `teamWhere()`, which pick the most permissive variant they hold.
 *
 * `prefix` is the permission WITHOUT the scope suffix, e.g.
 * `hr.employee.read`. A prefix that already carries a scope suffix (or that
 * isn't `<module>.<entity>.<action>`) is a programming error and throws when
 * the decorator is evaluated at module load, not on the first request.
 */
export const RequireScopedPermission = (prefix: string) => {
  const last = prefix.slice(prefix.lastIndexOf(".") + 1);
  if ((TEAM_ACCESS_LEVELS as readonly string[]).includes(last)) {
    throw new Error(
      `@RequireScopedPermission("${prefix}"): pass the prefix without the ` +
        `".${last}" scope suffix — the guard adds .own/.team/.all itself`,
    );
  }
  if (!SCOPE_PREFIX_PATTERN.test(prefix)) {
    throw new Error(
      `@RequireScopedPermission("${prefix}"): expected "<module>.<entity>.<action>" ` +
        "(lower-case) without a scope suffix — see Docs/CODING_STANDARDS.md §2a",
    );
  }
  return SetMetadata(SCOPED_PERMISSION_KEY, prefix);
};
