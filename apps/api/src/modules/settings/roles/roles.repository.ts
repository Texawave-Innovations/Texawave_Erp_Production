import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  VersionConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  AccessLockoutException,
  RoleInUseException,
  SystemRoleProtectedException,
} from "./roles.exceptions.js";

export interface RoleFilter {
  search?: string | undefined;
}

const ENTITY_TYPE = "role";
/** The permission that manages roles; the lock-out guard keeps it alive. */
export const ROLE_ADMIN_PERMISSION = "settings.role.write";

/** A user counts as a member when both the assignment and the user are live. */
const LIVE_MEMBER = {
  isActive: true,
  user: { isActive: true, deletedAt: null },
} satisfies Prisma.UserRoleWhereInput;

export interface RoleChange {
  name?: string | undefined;
  description?: string | null | undefined;
  isActive?: boolean | undefined;
}

/** The only place `PrismaService` is called for this module
 * (Docs/CODING_STANDARDS.md §3). `Role`/`RolePermission` are org-scoped via
 * `Role.organizationId`; `Permission` itself is a global catalog with no
 * scope to apply.
 *
 * Every write runs in one transaction that (1) bumps `version` with a
 * conditional update — which also row-locks the role, so two editors are
 * serialised and a stale `expectedVersion` is refused — (2) applies the
 * change, (3) re-checks that someone (and the caller) can still manage roles,
 * and (4) writes the audit row. Any failure rolls all of it back. */
@Injectable()
export class RolesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- reads -------------------------------------------------------------------

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

    const [rows, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
        include: {
          _count: {
            select: {
              rolePermissions: { where: { isActive: true } },
              userRoles: { where: LIVE_MEMBER },
            },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    const items = rows.map(({ _count, ...role }) => ({
      ...role,
      _count: { rolePermissions: _count.rolePermissions },
      permissionCount: _count.rolePermissions,
      userCount: _count.userRoles,
    }));
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
        _count: { select: { userRoles: { where: LIVE_MEMBER } } },
      },
    });
    if (!role) {
      return null;
    }
    const lastChangedBy = role.updatedBy
      ? await this.prisma.user.findFirst({
          where: tenantWhere(scope, { id: role.updatedBy }),
          select: { id: true, fullName: true },
        })
      : null;
    const { rolePermissions, _count, ...rest } = role;
    return {
      ...rest,
      userCount: _count.userRoles,
      lastChangedBy,
      permissions: rolePermissions.map((rp) => rp.permission),
    };
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.prisma.role.findFirst({ where: tenantWhere(scope, { name }) });
  }

  /** Not org-scoped — maps codes against the global permission catalog
   * (Docs/CODING_STANDARDS.md §2a). */
  async resolvePermissionCodes(codes: string[]): Promise<number[]> {
    if (codes.length === 0) return [];
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes }, isActive: true },
      select: { id: true },
    });
    return permissions.map((p) => p.id);
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

  // ---- writes ------------------------------------------------------------------

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: {
      name: string;
      description?: string | undefined;
      isActive?: boolean | undefined;
    },
    createdBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role
        .create({
          data: {
            name: input.name,
            description: input.description ?? null,
            isActive: input.isActive ?? true,
            organizationId: scope.organizationId,
            createdBy,
            updatedBy: createdBy,
          },
        })
        .catch((error: unknown) => this.rethrowDuplicate(error, input.name));
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: role.id,
        action: "create",
        after: {
          name: role.name,
          description: role.description,
          isActive: role.isActive,
        },
      });
      return role;
    });
  }

  /** Rename / describe / activate or deactivate. System roles cannot be
   * renamed or deactivated; a role users still hold cannot be deactivated.
   * Returns null when the role is not in this organization. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    change: RoleChange,
    expectedVersion: number | undefined,
    userId: number,
  ) {
    return this.mutate(scope, id, expectedVersion, userId, async (tx, role) => {
      const renaming = change.name !== undefined && change.name !== role.name;
      const deactivating = change.isActive === false && role.isActive;
      if (role.isSystem && renaming)
        throw new SystemRoleProtectedException("renamed");
      if (role.isSystem && deactivating)
        throw new SystemRoleProtectedException("deactivated");
      if (deactivating) {
        const members = await tx.userRole.count({
          where: { roleId: id, ...LIVE_MEMBER },
        });
        if (members > 0) throw new RoleInUseException(members);
      }
      await tx.role
        .update({
          where: { id },
          data: {
            ...(change.name !== undefined ? { name: change.name } : {}),
            ...(change.description !== undefined
              ? { description: change.description }
              : {}),
            ...(change.isActive !== undefined
              ? { isActive: change.isActive }
              : {}),
          },
        })
        .catch((error: unknown) =>
          this.rethrowDuplicate(error, change.name ?? role.name),
        );
      await this.assertRoleAdminsRemain(tx, scope, userId);
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: deactivating
          ? "deactivate"
          : change.isActive === true && !role.isActive
            ? "activate"
            : "update",
        before: {
          name: role.name,
          description: role.description,
          isActive: role.isActive,
        },
        after: {
          name: change.name ?? role.name,
          description:
            change.description !== undefined
              ? change.description
              : role.description,
          isActive: change.isActive ?? role.isActive,
        },
      });
    });
  }

  /** Replaces a role's granted-permission set. Never deletes a
   * `RolePermission` row — a permission newly granted gets a fresh row (or
   * an existing revoked one flipped back to `isActive: true`); a permission
   * no longer granted gets `isActive: false` on its existing row. This
   * preserves who-granted/revoked-what-and-when (Docs/ARCHITECTURE.md §11,
   * 2026-09-22 changelog entry). Returns null if the role isn't in this org. */
  @OrgScoped()
  async setPermissions(
    scope: OrgScope,
    roleId: number,
    permissionIds: number[],
    expectedVersion: number | undefined,
    updatedBy: number,
  ) {
    return this.mutate(
      scope,
      roleId,
      expectedVersion,
      updatedBy,
      async (tx) => {
        const catalog = await tx.permission.findMany({ select: { id: true } });
        const known = new Set(catalog.map((p) => p.id));
        const grantedIds = new Set(
          [...new Set(permissionIds)].filter((id) => known.has(id)),
        );
        const { added, removed } = await this.applyGrants(
          tx,
          roleId,
          grantedIds,
          updatedBy,
          true,
        );
        await this.assertRoleAdminsRemain(tx, scope, updatedBy);
        if (added.length + removed.length > 0) {
          await this.audit.write(tx, {
            entityType: ENTITY_TYPE,
            entityId: roleId,
            action: "set_permissions",
            // Ids, not codes: a role granted the whole catalog would exceed
            // the audit snapshot limit as codes. Clients map ids via the catalog.
            after: {
              grantedPermissionIds: [...added].sort((a, b) => a - b),
              revokedPermissionIds: [...removed].sort((a, b) => a - b),
            },
          });
        }
      },
    );
  }

  /** Adds permissions without removing any. Returns null if the role isn't
   * in this org. */
  @OrgScoped()
  async attachPermissions(
    scope: OrgScope,
    roleId: number,
    permissionIds: number[],
    updatedBy: number,
  ) {
    return this.mutate(scope, roleId, undefined, updatedBy, async (tx) => {
      const catalog = await tx.permission.findMany({
        where: { id: { in: permissionIds }, isActive: true },
        select: { id: true },
      });
      const current = await tx.rolePermission.findMany({
        where: { roleId, isActive: true },
        select: { permissionId: true },
      });
      const next = new Set([
        ...current.map((c) => c.permissionId),
        ...catalog.map((p) => p.id),
      ]);
      const { added } = await this.applyGrants(
        tx,
        roleId,
        next,
        updatedBy,
        false,
      );
      if (added.length > 0) {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: roleId,
          action: "attach_permissions",
          after: {
            grantedPermissionIds: [...added].sort((a, b) => a - b),
            revokedPermissionIds: [],
          },
        });
      }
    });
  }

  /** A new, non-system role with the source role's ACTIVE grants. Returns
   * null if the source isn't in this organization. */
  @OrgScoped()
  async clone(
    scope: OrgScope,
    sourceId: number,
    input: { name: string; description?: string | undefined },
    createdBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.role.findFirst({
        where: tenantWhere(scope, { id: sourceId }),
        include: {
          rolePermissions: {
            where: { isActive: true },
            select: { permissionId: true },
          },
        },
      });
      if (!source) return null;
      const role = await tx.role
        .create({
          data: {
            organizationId: scope.organizationId,
            name: input.name,
            description: input.description ?? source.description,
            createdBy,
            updatedBy: createdBy,
          },
        })
        .catch((error: unknown) => this.rethrowDuplicate(error, input.name));
      if (source.rolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: source.rolePermissions.map((rp) => ({
            roleId: role.id,
            permissionId: rp.permissionId,
            createdBy,
            updatedBy: createdBy,
          })),
        });
      }
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: role.id,
        action: "clone",
        after: {
          name: role.name,
          clonedFromRoleId: source.id,
          clonedFrom: source.name,
          permissions: source.rolePermissions.length,
        },
      });
      return role;
    });
  }

  // ---- shared ------------------------------------------------------------------

  /**
   * Runs `change` inside a transaction after bumping the role's version.
   * Returns null when the role is not in this organization; throws
   * VersionConflictException when `expectedVersion` is stale.
   */
  private async mutate(
    scope: OrgScope,
    roleId: number,
    expectedVersion: number | undefined,
    userId: number,
    change: (
      tx: Prisma.TransactionClient,
      role: NonNullable<
        Awaited<ReturnType<PrismaService["role"]["findFirst"]>>
      >,
    ) => Promise<void>,
  ): Promise<true | null> {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: tenantWhere(scope, { id: roleId }),
      });
      if (!role) return null;
      if (expectedVersion !== undefined && role.version !== expectedVersion) {
        throw new VersionConflictException("Role");
      }
      // Conditional on the version we read: a concurrent writer that got
      // there first leaves count 0, and we refuse instead of overwriting.
      const { count } = await tx.role.updateMany({
        where: { id: roleId, version: role.version },
        data: { version: { increment: 1 }, updatedBy: userId },
      });
      if (count !== 1) throw new VersionConflictException("Role");
      await change(tx, role);
      return true as const;
    });
  }

  /** Makes the role's active grants equal `target` (or, with `revoke`
   * false, adds only). Returns the permission ids added and removed. */
  private async applyGrants(
    tx: Prisma.TransactionClient,
    roleId: number,
    target: ReadonlySet<number>,
    updatedBy: number,
    revoke: boolean,
  ): Promise<{ added: number[]; removed: number[] }> {
    const existing = await tx.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true, isActive: true },
    });
    const existingIds = new Set(existing.map((rp) => rp.permissionId));
    const toCreate = [...target].filter((id) => !existingIds.has(id));
    const toReactivate = existing
      .filter((rp) => target.has(rp.permissionId) && !rp.isActive)
      .map((rp) => rp.permissionId);
    const toRevoke = revoke
      ? existing
          .filter((rp) => !target.has(rp.permissionId) && rp.isActive)
          .map((rp) => rp.permissionId)
      : [];

    if (toCreate.length > 0) {
      await tx.rolePermission.createMany({
        data: toCreate.map((permissionId) => ({
          roleId,
          permissionId,
          createdBy: updatedBy,
          updatedBy,
        })),
      });
    }
    if (toReactivate.length > 0) {
      await tx.rolePermission.updateMany({
        where: { roleId, permissionId: { in: toReactivate } },
        data: { isActive: true, updatedBy },
      });
    }
    if (toRevoke.length > 0) {
      await tx.rolePermission.updateMany({
        where: { roleId, permissionId: { in: toRevoke } },
        data: { isActive: false, updatedBy },
      });
    }
    return { added: [...toCreate, ...toReactivate], removed: toRevoke };
  }

  /** After a change (inside its transaction, so it sees the change): at
   * least one active user must still hold “Manage roles” through an active
   * role, and the caller must be one of them. */
  private async assertRoleAdminsRemain(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    callerId: number,
  ): Promise<void> {
    const admins = await tx.user.findMany({
      where: {
        organizationId: scope.organizationId,
        isActive: true,
        deletedAt: null,
        userRoles: {
          some: {
            isActive: true,
            role: {
              organizationId: scope.organizationId,
              isActive: true,
              rolePermissions: {
                some: {
                  isActive: true,
                  permission: { code: ROLE_ADMIN_PERMISSION, isActive: true },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (admins.length === 0) throw new AccessLockoutException("nobody");
    if (!admins.some((a) => a.id === callerId))
      throw new AccessLockoutException("self");
  }

  private rethrowDuplicate(error: unknown, name: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ResourceConflictException(
        `A role named "${name}" already exists`,
      );
    }
    throw error;
  }
}
