import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Not `@OrgScoped()` — `userId` already pins this to one user, and a
   * user's roles/permissions live entirely within their own organization by
   * construction (Role.organizationId), so there is no cross-tenant surface
   * here to guard against. */
  async findPermissionCodesForUser(userId: number): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      select: { permission: { select: { code: true } } },
    });
    return [...new Set(rolePermissions.map((rp) => rp.permission.code))];
  }

  async findRoleIdsForUser(userId: number): Promise<number[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    return userRoles.map((ur) => ur.roleId);
  }
}
