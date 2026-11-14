import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { ResourceConflictException } from "../../common/exceptions/business.exception.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { AuditWriter } from "../audit/audit-writer.js";
import { withRoleAdminGuard } from "../roles-permissions/role-admin-guard.js";

const ENTITY_TYPE = "user";

export interface UserFilter {
  search?: string | undefined;
}

const USER_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userRoles: {
    where: { isActive: true },
    select: {
      role: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  },
  teamAccess: {
    where: { isActive: true },
    select: {
      isLead: true,
      team: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
} as const;

/**
 * IAM data — `@OrgScoped()` only, deliberately not `@TeamScoped()`: access is
 * gated by `users.user.*` permissions, not team membership
 * (Docs/CODING_STANDARDS.md §10a).
 */
@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  findByEmail(scope: OrgScope, email: string) {
    return this.prisma.user.findFirst({
      where: tenantWhere(scope, { email, deletedAt: null }),
    });
  }

  @OrgScoped()
  findById(scope: OrgScope, userId: number) {
    return this.prisma.user.findFirst({
      where: tenantWhere(scope, { id: userId, deletedAt: null }),
    });
  }

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: UserFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.UserWhereInput>(scope, {
      deletedAt: null,
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = items.map((user) => ({
      ...user,
      roles: user.userRoles.map((ur) => ur.role),
      teams: user.teamAccess.map((ta) => ({
        ...ta.team,
        isLead: ta.isLead,
      })),
      userRoles: undefined,
      teamAccess: undefined,
    }));

    return { items: formatted, total };
  }

  /** What a user can effectively do: the active permissions of their
   * active roles (the same rule PermissionsRepository applies at request
   * time), each with the roles that grant it. Null when the user is not in
   * this organization. */
  @OrgScoped()
  async findEffectivePermissions(scope: OrgScope, id: number) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: {
        id: true,
        fullName: true,
        isActive: true,
        userRoles: {
          where: { isActive: true },
          select: {
            role: {
              select: {
                id: true,
                name: true,
                isActive: true,
                isSystem: true,
                rolePermissions: {
                  where: { isActive: true, permission: { isActive: true } },
                  select: {
                    permission: {
                      select: { id: true, code: true, description: true },
                    },
                  },
                },
              },
            },
          },
        },
        teamAccess: {
          select: { isLead: true, team: { select: { id: true, name: true } } },
        },
      },
    });
    if (!user) return null;
    const byCode = new Map<
      string,
      {
        id: number;
        code: string;
        description: string;
        grantedBy: { roleId: number; roleName: string }[];
      }
    >();
    for (const { role } of user.userRoles) {
      if (!role.isActive) continue;
      for (const { permission } of role.rolePermissions) {
        const entry = byCode.get(permission.code) ?? {
          ...permission,
          grantedBy: [],
        };
        entry.grantedBy.push({ roleId: role.id, roleName: role.name });
        byCode.set(permission.code, entry);
      }
    }
    return {
      user: { id: user.id, fullName: user.fullName, isActive: user.isActive },
      roles: user.userRoles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        isActive: role.isActive,
        isSystem: role.isSystem,
      })),
      teams: user.teamAccess.map((t) => ({ ...t.team, isLead: t.isLead })),
      permissions: [...byCode.values()].sort((x, y) =>
        x.code.localeCompare(y.code),
      ),
    };
  }

  @OrgScoped()
  async findOneDetail(scope: OrgScope, id: number) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: USER_SELECT,
    });
    if (!user) return null;
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role),
      teams: user.teamAccess.map((ta) => ({
        ...ta.team,
        isLead: ta.isLead,
      })),
      userRoles: undefined,
      teamAccess: undefined,
    };
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: {
      email: string;
      fullName: string;
      passwordHash: string;
      mustChangePassword?: boolean | undefined;
    },
    createdBy?: number,
  ) {
    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            organizationId: scope.organizationId,
            email: data.email,
            fullName: data.fullName,
            passwordHash: data.passwordHash,
            mustChangePassword: data.mustChangePassword ?? false,
            createdBy: createdBy ?? null,
            updatedBy: createdBy ?? null,
          },
          select: USER_SELECT,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: created.id,
          action: "create",
          after: {
            email: created.email,
            fullName: created.fullName,
            isActive: created.isActive,
          },
        });
        return created;
      });
    } catch (error) {
      // The caller's own findByEmail check (deletedAt: null) misses a
      // soft-deleted row at the same (organizationId, email) — there is no
      // partial unique index excluding deleted rows — so that race still
      // needs to be caught here and turned into a clean 409.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ResourceConflictException(
          `A user with email "${data.email}" already exists`,
        );
      }
      throw error;
    }

    return {
      ...user,
      roles: [],
      teams: [],
      userRoles: undefined,
      teamAccess: undefined,
    };
  }

  /** Edits name / e-mail / active state. Disabling a user is refused when it
   * would leave nobody (or the caller) able to manage roles. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: { email?: string; fullName?: string; isActive?: boolean },
    updatedBy: number,
  ) {
    const found = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        select: { email: true, fullName: true, isActive: true },
      });
      if (!before) return false;
      await withRoleAdminGuard(tx, scope.organizationId, updatedBy, () =>
        tx.user.update({ where: { id }, data: { ...data, updatedBy } }),
      );
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action:
          data.isActive === false && before.isActive
            ? "deactivate"
            : data.isActive === true && !before.isActive
              ? "activate"
              : "update",
        before,
        after: { ...before, ...data },
      });
      return true;
    });
    return found ? this.findOneDetail(scope, id) : null;
  }

  /** Soft-deletes the user; refused like a deactivation by the lock-out rule. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        select: { email: true, fullName: true, isActive: true },
      });
      if (!before) return false;
      await withRoleAdminGuard(tx, scope.organizationId, deletedBy, () =>
        tx.user.update({
          where: { id },
          data: { deletedAt: new Date(), updatedBy: deletedBy },
        }),
      );
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before,
      });
      return true;
    });
  }

  /** Validates that all supplied roleIds belong to the caller's organization. */
  @OrgScoped()
  findRolesInOrg(scope: OrgScope, roleIds: number[]) {
    return this.prisma.role.findMany({
      where: tenantWhere(scope, { id: { in: roleIds } }),
      select: { id: true },
    });
  }

  /** Sets the user's roles (removed ones are flipped to isActive=false, never
   * deleted), refused when it would leave nobody (or the caller) able to
   * manage roles. Audited with the role ids added and removed. */
  @OrgScoped()
  async assignRoles(
    scope: OrgScope,
    userId: number,
    roleIds: number[],
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: tenantWhere(scope, { id: userId, deletedAt: null }),
        select: { id: true },
      });
      if (!user) return false;

      const existing = await tx.userRole.findMany({
        where: { userId },
        select: { roleId: true, isActive: true },
      });
      const existingMap = new Map(
        existing.map((ur) => [ur.roleId, ur.isActive]),
      );
      const targetSet = new Set(roleIds);

      const toCreate = roleIds.filter((id) => !existingMap.has(id));
      const toReactivate = roleIds.filter(
        (id) => existingMap.get(id) === false,
      );
      const toDeactivate = existing
        .filter((ur) => ur.isActive && !targetSet.has(ur.roleId))
        .map((ur) => ur.roleId);

      await withRoleAdminGuard(
        tx,
        scope.organizationId,
        updatedBy,
        async () => {
          if (toCreate.length > 0) {
            await tx.userRole.createMany({
              data: toCreate.map((roleId) => ({
                userId,
                roleId,
                createdBy: updatedBy,
                updatedBy,
              })),
            });
          }
          if (toReactivate.length > 0) {
            await tx.userRole.updateMany({
              where: { userId, roleId: { in: toReactivate } },
              data: { isActive: true, updatedBy },
            });
          }
          if (toDeactivate.length > 0) {
            await tx.userRole.updateMany({
              where: { userId, roleId: { in: toDeactivate } },
              data: { isActive: false, updatedBy },
            });
          }
        },
      );

      const added = [...toCreate, ...toReactivate];
      if (added.length + toDeactivate.length > 0) {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: userId,
          action: "assign_roles",
          after: {
            addedRoleIds: [...added].sort((a, b) => a - b),
            removedRoleIds: [...toDeactivate].sort((a, b) => a - b),
          },
        });
      }
      return true;
    });
  }

  /** Validates that all supplied teamIds belong to the caller's organization. */
  @OrgScoped()
  findTeamsInOrg(scope: OrgScope, teamIds: number[]) {
    return this.prisma.team.findMany({
      where: tenantWhere(scope, { id: { in: teamIds } }),
      select: { id: true },
    });
  }

  /** Sets the user's team access (what `.team` scope covers). Removed teams
   * are flipped to isActive=false, never deleted. Audited. */
  @OrgScoped()
  async assignTeams(
    scope: OrgScope,
    userId: number,
    assignments: Array<{ teamId: number; isLead: boolean }>,
    updatedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: tenantWhere(scope, { id: userId, deletedAt: null }),
        select: { id: true },
      });
      if (!user) return false;

      const existing = await tx.userTeamAccess.findMany({
        where: { userId },
        select: { teamId: true, isLead: true, isActive: true },
      });
      const existingMap = new Map(existing.map((ta) => [ta.teamId, ta]));
      const targetMap = new Map(assignments.map((a) => [a.teamId, a.isLead]));

      const toCreate = assignments.filter((a) => !existingMap.has(a.teamId));
      const toUpdate = assignments.filter(
        (a) =>
          existingMap.has(a.teamId) &&
          (!existingMap.get(a.teamId)!.isActive ||
            existingMap.get(a.teamId)!.isLead !== a.isLead),
      );
      const toDeactivate = existing
        .filter((ta) => ta.isActive && !targetMap.has(ta.teamId))
        .map((ta) => ta.teamId);

      if (toCreate.length > 0) {
        await tx.userTeamAccess.createMany({
          data: toCreate.map((a) => ({
            organizationId: scope.organizationId,
            userId,
            teamId: a.teamId,
            isLead: a.isLead,
            createdBy: updatedBy,
            updatedBy,
          })),
        });
      }
      for (const a of toUpdate) {
        await tx.userTeamAccess.updateMany({
          where: { userId, teamId: a.teamId },
          data: { isActive: true, isLead: a.isLead, updatedBy },
        });
      }
      if (toDeactivate.length > 0) {
        await tx.userTeamAccess.updateMany({
          where: { userId, teamId: { in: toDeactivate } },
          data: { isActive: false, updatedBy },
        });
      }

      if (toCreate.length + toUpdate.length + toDeactivate.length > 0) {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: userId,
          action: "assign_teams",
          after: {
            teams: assignments
              .map((a) => ({ teamId: a.teamId, isLead: a.isLead }))
              .sort((x, y) => x.teamId - y.teamId),
            removedTeamIds: [...toDeactivate].sort((a, b) => a - b),
          },
        });
      }
      return true;
    });
  }

  /** Reset-password: `scope` comes from the user row already loaded via the
   * matched PasswordResetToken (platform/auth), not from an authenticated
   * request — same shape as `findByEmail` above. */
  @OrgScoped()
  updatePasswordHash(scope: OrgScope, userId: number, passwordHash: string) {
    return this.prisma.user.updateMany({
      where: { id: userId, organizationId: scope.organizationId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  /** Admin-issued reset (HR giving someone a new temporary password):
   * requires a change on next login, unlike the self-service reset above. */
  @OrgScoped()
  async resetPasswordByAdmin(
    scope: OrgScope,
    userId: number,
    passwordHash: string,
    performedBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, organizationId: scope.organizationId },
        data: {
          passwordHash,
          mustChangePassword: true,
          updatedBy: performedBy,
        },
      });
      if (count > 0) {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: userId,
          action: "reset_password",
        });
      }
      return count > 0;
    });
  }
}
