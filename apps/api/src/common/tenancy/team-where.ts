import type { TeamScope } from "./team-scope.js";

/** Builds the Prisma filter for the resolved access level
 * (Docs/CODING_STANDARDS.md §10a). */
export function teamWhere<F extends object>(scope: TeamScope, filter?: F) {
  if (scope.level === "all") return { ...filter };
  if (scope.level === "team") {
    return { ...filter, teamId: { in: scope.teamIds } };
  }
  return { ...filter, userId: scope.userId }; // "own"
}
