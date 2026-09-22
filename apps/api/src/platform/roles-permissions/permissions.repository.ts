import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Not `@OrgScoped()` — `userId` already pins this to one user, and a
   * user's roles/permissions live entirely within their own organization by
   * construction (Role.organizationId), so there is no cross-tenant surface
   * here to guard against.
   *
   * `isActive` is checked at all three levels (`RolePermission`, `Role`,
   * `UserRole`) — each one independently disables the grant without
   * deleting it (apps/api/src/modules/settings/roles/), so a stale `true`
   * at any single level would silently keep access alive. */
  async findPermissionCodesForUser(userId: number): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        isActive: true,
        permission: { isActive: true },
        role: {
          isActive: true,
          userRoles: { some: { userId, isActive: true } },
        },
      },
      select: { permission: { select: { code: true } } },
    });
    return [...new Set(rolePermissions.map((rp) => rp.permission.code))];
  }

  async findRoleIdsForUser(userId: number): Promise<number[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, isActive: true, role: { isActive: true } },
      select: { roleId: true },
    });
    return userRoles.map((ur) => ur.roleId);
  }
}
