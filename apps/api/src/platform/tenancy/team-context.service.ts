import { ForbiddenException, Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type {
  TeamAccessLevel,
  TeamScope,
} from "../../common/tenancy/team-scope.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { PermissionsService } from "../roles-permissions/permissions.service.js";

/**
 * Real, injectable platform capability, wired the same way
 * `TenantContextService` is (Docs/CODING_STANDARDS.md §10a) — reads the
 * authenticated user off the same `nestjs-cls` context `TenancyInterceptor`
 * already populates, rather than inventing a parallel mechanism.
 *
 * `resolveScope(permissionPrefix)` checks the caller's resolved permission
 * set (the same Redis-cached set `PermissionsGuard` uses) for
 * `<prefix>.all`, then `<prefix>.team`, then `<prefix>.own`, in that order,
 * and returns the most permissive one they hold — never guesses or
 * defaults to `.all`. For `.team`, it queries `user_team_access` for the
 * caller's `teamId`s at request time.
 */
@Injectable()
export class TeamContextService {
  constructor(
    private readonly cls: ClsService,
    private readonly permissions: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveScope(permissionPrefix: string): Promise<TeamScope> {
    const userId = this.cls.get<number>("userId");
    const organizationId = this.cls.get<number>("organizationId");
    if (!userId || !organizationId) {
      throw new Error(
        "TeamContextService.resolveScope() called with no user in context — " +
          "this route is either public or missing an auth guard.",
      );
    }

    const granted = await this.permissions.getPermissionsForUser(userId);
    const level = this.resolveLevel(permissionPrefix, granted);

    if (level === "all") {
      return { level, userId, organizationId, teamIds: [] };
    }

    if (level === "team") {
      // Same revocation semantics as role grants: `isActive: false` disables
      // a membership without deleting it, so it must not count here. The
      // organization and the team's own state are pinned too — a membership
      // row alone never grants access to another organization's or a
      // deactivated/deleted team's data.
      const access = await this.prisma.userTeamAccess.findMany({
        where: {
          userId,
          organizationId,
          isActive: true,
          deletedAt: null,
          team: { organizationId, isActive: true, deletedAt: null },
        },
        select: { teamId: true },
      });
      return {
        level,
        userId,
        organizationId,
        teamIds: access.map((row) => row.teamId),
      };
    }

    return { level: "own", userId, organizationId, teamIds: [] };
  }

  private resolveLevel(
    permissionPrefix: string,
    granted: string[],
  ): TeamAccessLevel {
    if (granted.includes(`${permissionPrefix}.all`)) return "all";
    if (granted.includes(`${permissionPrefix}.team`)) return "team";
    if (granted.includes(`${permissionPrefix}.own`)) return "own";
    // Normally unreachable behind @RequireScopedPermission(), but a route that
    // forgot it (or a prefix that doesn't match the decorator's) must fail as
    // an authorization error — 403, never a 500 and never a default scope.
    throw new ForbiddenException(
      `Missing permission: ${permissionPrefix}.own, ${permissionPrefix}.team or ${permissionPrefix}.all`,
    );
  }
}
