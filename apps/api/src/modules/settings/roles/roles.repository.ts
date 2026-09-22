import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateRoleDto } from "./dto/create-role.dto.js";
import type { UpdateRoleDto } from "./dto/update-role.dto.js";

export interface RoleFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). `Role`/`RolePermission` are org-scoped via
 * `Role.organizationId`; `Permission` itself is a global catalog with no
 * scope to apply. */
@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: RoleFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.RoleWhereInput>(scope, {
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
        include: {
          _count: {
            select: { rolePermissions: { where: { isActive: true } } },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.role.findFirst({ where: tenantWhere(scope, { id }) });
  }

  @OrgScoped()
  async findOneWithPermissions(scope: OrgScope, id: number) {
    const role = await this.prisma.role.findFirst({
      where: tenantWhere(scope, { id }),
      include: {
        rolePermissions: {
          where: { isActive: true },
          include: { permission: true },
        },
      },
    });
    if (!role) {
      return null;
    }
    const { rolePermissions, ...rest } = role;
    return {
      ...rest,
      permissions: rolePermissions.map((rp) => rp.permission),
    };
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.role.findFirst({ where: tenantWhere(scope, { name }) });
  }

  @OrgScoped()
  create(scope: OrgScope, dto: CreateRoleDto, createdBy: number) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        organizationId: scope.organizationId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateRoleDto,
    updatedBy: number,
  ) {
    const result = await this.prisma.role.updateMany({
      where: tenantWhere(scope, { id }),
      data: { ...dto, updatedBy },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findOne(scope, id);
  }

  /** Replaces a role's granted-permission set. Never deletes a
   * `RolePermission` row — a permission newly granted gets a fresh row (or
   * an existing revoked one flipped back to `isActive: true`); a permission
   * no longer granted gets `isActive: false` on its existing row. This
   * preserves who-granted/revoked-what-and-when (Docs/ARCHITECTURE.md §11,
   * 2026-09-22 changelog entry). Returns `false` if the role isn't in this
   * org. */
  @OrgScoped()
  async setPermissions(
    scope: OrgScope,
    roleId: number,
    permissionIds: number[],
    updatedBy: number,
  ): Promise<boolean> {
    const role = await this.prisma.role.findFirst({
      where: tenantWhere(scope, { id: roleId }),
    });
    if (!role) {
      return false;
    }

    const catalog = await this.prisma.permission.findMany({
      select: { id: true },
    });
    const catalogIds = new Set(catalog.map((p) => p.id));
    const grantedIds = new Set(
      [...new Set(permissionIds)].filter((id) => catalogIds.has(id)),
    );

    const existing = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true, isActive: true },
    });
    const existingIds = new Set(existing.map((rp) => rp.permissionId));

    const toCreate = [...grantedIds].filter((id) => !existingIds.has(id));
    const toReactivate = existing
      .filter((rp) => grantedIds.has(rp.permissionId) && !rp.isActive)
      .map((rp) => rp.permissionId);
    const toRevoke = existing
      .filter((rp) => !grantedIds.has(rp.permissionId) && rp.isActive)
      .map((rp) => rp.permissionId);

    await this.prisma.$transaction([
      ...toCreate.map((permissionId) =>
        this.prisma.rolePermission.create({
          data: { roleId, permissionId, createdBy: updatedBy, updatedBy },
        }),
      ),
      ...(toReactivate.length > 0
        ? [
            this.prisma.rolePermission.updateMany({
              where: { roleId, permissionId: { in: toReactivate } },
              data: { isActive: true, updatedBy },
            }),
          ]
        : []),
      ...(toRevoke.length > 0
        ? [
            this.prisma.rolePermission.updateMany({
              where: { roleId, permissionId: { in: toRevoke } },
              data: { isActive: false, updatedBy },
            }),
          ]
        : []),
    ]);

    return true;
  }

  /** Not org-scoped — the catalog is global, seeded once
   * (Docs/CODING_STANDARDS.md §2a). */
  findPermissionCatalog() {
    return this.prisma.permission.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
  }

  /** Users currently holding this role, for cache invalidation after a
   * grant change (PermissionsService.invalidate — the 15-minute Redis TTL
   * would otherwise let a revoked permission keep working). */
  @OrgScoped()
  async findUserIdsForRole(scope: OrgScope, roleId: number): Promise<number[]> {
    const role = await this.prisma.role.findFirst({
      where: tenantWhere(scope, { id: roleId }),
    });
    if (!role) {
      return [];
    }
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId, isActive: true },
      select: { userId: true },
    });
    return userRoles.map((ur) => ur.userId);
  }
}
