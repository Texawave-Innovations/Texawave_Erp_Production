import type { Prisma } from "@texawave-erp/database";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";

/**
 * Row visibility for assignments, which — unlike employees — point at either
 * an employee OR a team, so the single-path `teamWhere()` cannot express it:
 *
 *  - all  → every assignment of the organization;
 *  - team → assignments of employees in the caller's teams, plus assignments
 *           made to those teams themselves;
 *  - own  → the caller's own employee assignments only (a team default is not
 *           "theirs").
 *
 * The organization is ALWAYS part of the clause, and a scope with no teams
 * matches nothing. An unknown level throws instead of widening.
 */
export function shiftAssignmentScopeWhere(
  scope: TeamScope,
): Prisma.ShiftAssignmentWhereInput {
  if (!Number.isInteger(scope.organizationId) || scope.organizationId <= 0) {
    throw new Error(
      "shiftAssignmentScopeWhere: scope requires a valid organizationId",
    );
  }
  const organizationId = scope.organizationId;
  switch (scope.level) {
    case "all":
      return { organizationId };
    case "team":
      return {
        organizationId,
        OR: [
          { employee: { teamId: { in: [...scope.teamIds] } } },
          { teamId: { in: [...scope.teamIds] } },
        ],
      };
    case "own":
      if (!Number.isInteger(scope.userId) || scope.userId <= 0) {
        throw new Error(
          "shiftAssignmentScopeWhere: an 'own' scope requires a valid userId",
        );
      }
      return { organizationId, employee: { userId: scope.userId } };
    default:
      throw new Error(
        `shiftAssignmentScopeWhere: unknown scope level "${String((scope as { level: unknown }).level)}"`,
      );
  }
}
