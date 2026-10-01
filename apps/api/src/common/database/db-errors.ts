import { BusinessException } from "../exceptions/business.exception.js";

export type DbConstraintKind =
  "unique" | "exclusion" | "check" | "foreign_key" | "not_null";

export interface DbConstraintViolation {
  kind: DbConstraintKind;
  /** Postgres constraint/index name when the driver reports one. */
  constraint?: string;
  /** Column names for a Prisma P2002, when reported. */
  columns?: string[];
}

const SQLSTATE: Record<string, DbConstraintKind> = {
  "23505": "unique",
  "23P01": "exclusion",
  "23514": "check",
  "23503": "foreign_key",
  "23502": "not_null",
};

// Prisma embeds Postgres's message inside a debug-formatted string, so the
// constraint name arrives as `violates exclusion constraint \"name\"` (quotes
// backslash-escaped) for ORM calls and plain `"name"` elsewhere. Both are read
// — an earlier version matched only the plain form and silently missed every
// real ORM error.
const QUOTED = String.raw`\\?"([^"\\]+)\\?"`;
const MESSAGE_PATTERNS: Array<[RegExp, DbConstraintKind]> = [
  [new RegExp(`violates exclusion constraint ${QUOTED}`), "exclusion"],
  [new RegExp(`violates check constraint ${QUOTED}`), "check"],
  [new RegExp(`violates unique constraint ${QUOTED}`), "unique"],
  [new RegExp(`violates foreign key constraint ${QUOTED}`), "foreign_key"],
];

/**
 * Classifies a Prisma/Postgres error as a constraint violation, or returns
 * `null` for anything else. Prisma reports the same Postgres failure
 * differently depending on the call: the ORM's `create`/`update` raise
 * `P2002` (unique) / `P2003` (FK) and a plain "unknown request" error for
 * exclusion and CHECK violations, while `$queryRaw`/`$executeRaw` raise
 * `P2010` with the SQLSTATE in `meta.code` — so this reads all three shapes
 * (duck-typed, no `instanceof`, so it also works across module copies).
 */
export function classifyDbError(error: unknown): DbConstraintViolation | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; target?: unknown; constraint?: unknown };
  };
  const message = typeof e.message === "string" ? e.message : "";
  const nameFromMessage = (): string | undefined => {
    for (const [pattern] of MESSAGE_PATTERNS) {
      const m = pattern.exec(message);
      if (m) return m[1];
    }
    return undefined;
  };

  if (e.code === "P2002") {
    const target = e.meta?.target;
    return {
      kind: "unique",
      ...(Array.isArray(target)
        ? { columns: target.map(String) }
        : typeof target === "string"
          ? { constraint: target }
          : {}),
    };
  }
  if (e.code === "P2003") {
    const c = e.meta?.constraint;
    return {
      kind: "foreign_key",
      ...(typeof c === "string" ? { constraint: c } : {}),
    };
  }
  if (e.code === "P2010" && typeof e.meta?.code === "string") {
    const kind = SQLSTATE[e.meta.code];
    if (kind) {
      const constraint = nameFromMessage();
      return { kind, ...(constraint ? { constraint } : {}) };
    }
  }
  for (const [pattern, kind] of MESSAGE_PATTERNS) {
    const m = pattern.exec(message);
    if (m) return { kind, ...(m[1] ? { constraint: m[1] } : {}) };
  }
  return null;
}

/**
 * Turns a known constraint violation into the business exception a caller
 * registered for it, so a database invariant surfaces as a clean 409/422 and
 * not a 500. `rules` maps a Postgres constraint/index name — or, for a Prisma
 * `P2002`, a comma-joined column list — to the exception to throw. Anything
 * unmatched is returned unchanged for the caller to rethrow:
 *
 * ```ts
 * try { ... } catch (e) {
 *   throw translateDbError(e, { employees_user_id_key: new ResourceConflictException("...") });
 * }
 * ```
 */
export function translateDbError(
  error: unknown,
  rules: Record<string, BusinessException>,
): unknown {
  const violation = classifyDbError(error);
  if (!violation) return error;
  const keys = [violation.constraint, violation.columns?.join(",")].filter(
    (k): k is string => typeof k === "string",
  );
  for (const key of keys) {
    const mapped = rules[key];
    if (mapped) return mapped;
  }
  return error;
}
