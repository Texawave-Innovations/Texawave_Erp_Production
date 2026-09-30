import { type TeamScope } from "./team-scope.js";

/** Which columns carry the team / owning-user for the table being queried.
 * A dotted path reaches through a to-one relation — e.g. attendance or leave
 * rows keyed by `employee_id` use `{ teamField: "employee.teamId",
 * ownerField: "employee.userId" }`. */
export interface TeamWhereFields {
  /** Defaults to `teamId`. */
  teamField?: string;
  /** Defaults to `userId`. */
  ownerField?: string;
  /** Defaults to `organizationId`. */
  orgField?: string;
}

const FIELD_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function nest(path: string, value: unknown): Record<string, unknown> {
  if (!FIELD_PATH.test(path)) {
    throw new Error(`teamWhere: "${path}" is not a valid field path`);
  }
  return path
    .split(".")
    .reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<
    string,
    unknown
  >;
}

/**
 * Builds the Prisma filter for the resolved access level
 * (Docs/CODING_STANDARDS.md §10a).
 *
 * The caller's organization is ALWAYS AND-ed in (a team-scoped query is
 * tenant-safe by construction), then the scope clause. Both are AND-ed with the caller's `filter` rather than spread
 * over it: a `teamId` (or `userId`) the caller supplied as an ordinary search
 * filter narrows the result within their scope instead of being silently
 * replaced by it, and can never widen it. Fails closed — an unknown level, a
 * `team` scope with no teams, or an `own` scope without a valid user id
 * matches nothing (or throws) rather than falling through to `all`.
 */
export function teamWhere(
  scope: TeamScope,
  filter?: object,
  fields: TeamWhereFields = {},
): { AND: object[] } {
  const base = filter ?? {};
  if (!Number.isInteger(scope.organizationId) || scope.organizationId <= 0) {
    throw new Error("teamWhere: scope requires a valid organizationId");
  }
  const org = nest(fields.orgField ?? "organizationId", scope.organizationId);

  switch (scope.level) {
    case "all":
      return { AND: [base, org] };
    case "team": {
      const clause = nest(fields.teamField ?? "teamId", {
        in: [...scope.teamIds],
      });
      return { AND: [base, org, clause] };
    }
    case "own": {
      if (!Number.isInteger(scope.userId) || scope.userId <= 0) {
        throw new Error("teamWhere: an 'own' scope requires a valid userId");
      }
      return {
        AND: [base, org, nest(fields.ownerField ?? "userId", scope.userId)],
      };
    }
    default:
      throw new Error(
        `teamWhere: unknown scope level "${String((scope as { level: unknown }).level)}"`,
      );
  }
}
