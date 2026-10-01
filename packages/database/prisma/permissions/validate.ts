import type { PermissionDef, RetiredPermission } from "./catalog.js";

/** Docs/CODING_STANDARDS.md §2a: three lower-case dot-separated segments
 * (`_` allowed inside a segment), plus an optional `.own|.team|.all`. */
const CODE_PATTERN =
  /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*(\.(own|team|all))?$/;
const SCOPES = ["own", "team", "all"] as const;
const MAX_DESCRIPTION = 200;

export class CatalogValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Permission catalogue is invalid (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "CatalogValidationError";
  }
}

/** Splits `hr.employee.read.team` into `{ family: "hr.employee.read",
 * scope: "team" }`; a code without a scope suffix has `scope: undefined`. */
function split(code: string): { family: string; scope?: string } {
  const last = code.slice(code.lastIndexOf(".") + 1);
  return (SCOPES as readonly string[]).includes(last)
    ? { family: code.slice(0, code.lastIndexOf(".")), scope: last }
    : { family: code };
}

/** Pure — no database. Returns every problem found (not just the first) so a
 * reviewer fixes them in one pass. */
export function findCatalogProblems(
  catalog: readonly PermissionDef[],
  retired: readonly RetiredPermission[] = [],
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const families = new Map<string, { scopes: Set<string>; bare: boolean }>();

  for (const { code, description } of catalog) {
    if (!CODE_PATTERN.test(code)) {
      problems.push(
        `"${code}" does not match <module>.<entity>.<action>[.own|.team|.all] (lower-case)`,
      );
      continue;
    }
    if (seen.has(code)) problems.push(`"${code}" is listed more than once`);
    seen.add(code);

    if (description.trim().length === 0) {
      problems.push(`"${code}" has an empty description`);
    } else if (description.length > MAX_DESCRIPTION) {
      problems.push(
        `"${code}" description is longer than ${MAX_DESCRIPTION} characters`,
      );
    }

    const { family, scope } = split(code);
    const entry = families.get(family) ?? { scopes: new Set(), bare: false };
    if (scope) entry.scopes.add(scope);
    else entry.bare = true;
    families.set(family, entry);
  }

  for (const [family, { scopes, bare }] of families) {
    if (bare && scopes.size > 0) {
      problems.push(
        `"${family}" exists both without a scope and with one (${[...scopes].join("/")}) — a permission is either team-scoped or not`,
      );
    }
    if (scopes.size > 0 && scopes.size < SCOPES.length) {
      const missing = SCOPES.filter((s) => !scopes.has(s));
      problems.push(
        `"${family}" is team-scoped but is missing ${missing.map((s) => `.${s}`).join(", ")} — seed all of .own/.team/.all together`,
      );
    }
  }

  const retiredSeen = new Set<string>();
  for (const { code, reason } of retired) {
    if (!CODE_PATTERN.test(code)) {
      problems.push(`retired "${code}" does not match the naming pattern`);
    }
    if (retiredSeen.has(code)) {
      problems.push(`retired "${code}" is listed more than once`);
    }
    retiredSeen.add(code);
    if (seen.has(code)) {
      problems.push(`"${code}" is both in the catalogue and retired`);
    }
    if (reason.trim().length === 0) {
      problems.push(`retired "${code}" needs a reason`);
    }
  }

  return problems;
}

export function assertValidCatalog(
  catalog: readonly PermissionDef[],
  retired: readonly RetiredPermission[] = [],
): void {
  const problems = findCatalogProblems(catalog, retired);
  if (problems.length > 0) throw new CatalogValidationError(problems);
}
