import type { Prisma } from "@texawave-erp/database";

/**
 * Who leads a team, as approval routing needs it — shared by the timesheet and
 * leave workflows so both route the same way: an employee's request goes to the
 * lead of their team, then (where the workflow has a second level) to HR. A
 * team lead's own request, and a request from a team with no lead, goes to HR
 * alone.
 *
 * A team lead is a user who holds the workflow's TEAM-level approve permission
 * (the Team Lead role grants it) and is assigned to the team (an active
 * `user_team_access` row, set in Settings → Users → teams). So a request is
 * only ever routed to someone who can actually decide it, and assigning the
 * Team Lead role plus the team is all an administrator has to do.
 *
 * Pure Prisma filters, no I/O: each module runs them in its own repository
 * (and transaction), so no repository is shared across modules.
 */

/** Users who hold any of `codes` through an active role (the same flags
 * `PermissionsService` resolves a user's permissions with). */
export function holdsAnyPermission(
  codes: readonly string[],
): Prisma.UserWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    userRoles: {
      some: {
        isActive: true,
        role: {
          isActive: true,
          rolePermissions: {
            some: {
              isActive: true,
              permission: { isActive: true, code: { in: [...codes] } },
            },
          },
        },
      },
    },
  };
}

/** Active assignments to `teamId` of users holding `teamApproveCode`: the
 * team's leads. Excludes one user (the employee whose request it is). */
export function leadsOfTeam(input: {
  organizationId: number;
  teamId: number;
  teamApproveCode: string;
  excludeUserId: number | null;
}): Prisma.UserTeamAccessWhereInput {
  return {
    organizationId: input.organizationId,
    teamId: input.teamId,
    isActive: true,
    deletedAt: null,
    ...(input.excludeUserId !== null
      ? { userId: { not: input.excludeUserId } }
      : {}),
    user: holdsAnyPermission([input.teamApproveCode]),
  };
}

/** The user is a team lead (holds the team-level approve permission): their
 * own requests go to HR. */
export function isTeamLead(
  organizationId: number,
  userId: number,
  teamApproveCode: string,
): Prisma.UserWhereInput {
  return {
    id: userId,
    organizationId,
    ...holdsAnyPermission([teamApproveCode]),
  };
}
