import { PERMISSION_CATALOG } from "../permissions/catalog.js";
import type { MenuItemDef } from "./catalog.js";

const MAX_LABEL = 100;
const SCOPES = ["own", "team", "all"] as const;
const KNOWN_PERMISSION_CODES = new Set(PERMISSION_CATALOG.map((p) => p.code));

/** A menu item's `permission` is either an exact, unscoped permission code,
 * or the prefix of a `scopedPermission()` family — never the bare prefix
 * itself as a catalog entry (menu.service.ts `getMyMenu` matches either
 * form). Mirrors that same either/or so a typo'd permission string is
 * caught here instead of silently never matching any user. */
function isKnownPermission(code: string): boolean {
  if (KNOWN_PERMISSION_CODES.has(code)) return true;
  return SCOPES.some((scope) => KNOWN_PERMISSION_CODES.has(`${code}.${scope}`));
}

export class MenuCatalogValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Menu catalogue is invalid (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "MenuCatalogValidationError";
  }
}

/** Pure — no database. Returns every problem found (not just the first) so a
 * reviewer fixes them in one pass. */
export function findMenuCatalogProblems(
  catalog: readonly MenuItemDef[],
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const { code, label, path, order } of catalog) {
    if (seen.has(code)) problems.push(`"${code}" is listed more than once`);
    seen.add(code);

    if (label.trim().length === 0) {
      problems.push(`"${code}" has an empty label`);
    } else if (label.length > MAX_LABEL) {
      problems.push(`"${code}" label is longer than ${MAX_LABEL} characters`);
    }

    if (path != null && !path.startsWith("/")) {
      problems.push(`"${code}" path "${path}" must start with "/"`);
    }

    if (!Number.isInteger(order) || order < 0) {
      problems.push(`"${code}" order must be a non-negative integer`);
    }
  }

  for (const { code, permission } of catalog) {
    if (permission !== null && !isKnownPermission(permission)) {
      problems.push(
        `"${code}" references unknown permission "${permission}" (not in PERMISSION_CATALOG, exactly or as a scoped family)`,
      );
    }
  }

  for (const { code, parentCode } of catalog) {
    if (parentCode === null) continue;
    if (parentCode === code) {
      problems.push(`"${code}" cannot be its own parent`);
      continue;
    }
    if (!seen.has(parentCode)) {
      problems.push(
        `"${code}" has parentCode "${parentCode}", which is not in the catalogue`,
      );
    }
  }

  // A root must not depend on a descendant as an ancestor (only two levels
  // exist today — root groups and their direct children — but this check
  // doesn't assume that, so a future deeper tree still gets caught).
  const parentOf = new Map(catalog.map((d) => [d.code, d.parentCode]));
  for (const { code } of catalog) {
    const visited = new Set<string>();
    let current: string | null = code;
    while (current !== null) {
      if (visited.has(current)) {
        problems.push(`"${code}" is part of a parentCode cycle`);
        break;
      }
      visited.add(current);
      current = parentOf.get(current) ?? null;
    }
  }

  return problems;
}

export function assertValidMenuCatalog(catalog: readonly MenuItemDef[]): void {
  const problems = findMenuCatalogProblems(catalog);
  if (problems.length > 0) throw new MenuCatalogValidationError(problems);
}
