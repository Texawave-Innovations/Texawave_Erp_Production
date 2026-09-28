import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

export interface UserFilter {
  search?: string | undefined;
}

const USER_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  fullName: true,
  isActive: true,
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

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    data: { email: string; fullName: string; passwordHash: string },
    createdBy?: number,
  ) {
    const user = await this.prisma.user.create({
      data: {
        organizationId: scope.organizationId,
        email: data.email,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
      },
      select: USER_SELECT,
    });

    return {
      ...user,
      roles: [],
      teams: [],
      userRoles: undefined,
      teamAccess: undefined,
    };
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    data: { email?: string; fullName?: string; isActive?: boolean },
    updatedBy?: number,
  ) {
    const result = await this.prisma.user.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...data,
        updatedBy: updatedBy ?? null,
      },
    });
    if (result.count === 0) return null;
    return this.findOneDetail(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy?: number) {
    const result = await this.prisma.user.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy ?? null },
    });
    return result.count > 0;
  }

  /** Validates that all supplied roleIds belong to the caller's organization. */
  @OrgScoped()
  findRolesInOrg(scope: OrgScope, roleIds: number[]) {
    return this.prisma.role.findMany({
      where: tenantWhere(scope, { id: { in: roleIds } }),
      select: { id: true },
    });
  }

  /** Assigns roles to user, flipping isActive to false for removed roles. */
  @OrgScoped()
  async assignRoles(
    scope: OrgScope,
    userId: number,
    roleIds: number[],
    updatedBy: number,
  ) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(scope, { id: userId, deletedAt: null }),
    });
    if (!user) return false;

    const existing = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true, isActive: true },
    });
    const existingMap = new Map(existing.map((ur) => [ur.roleId, ur.isActive]));
    const targetSet = new Set(roleIds);

    const toCreate = roleIds.filter((id) => !existingMap.has(id));
    const toReactivate = roleIds.filter((id) => existingMap.get(id) === false);
    const toDeactivate = existing
      .filter((ur) => ur.isActive && !targetSet.has(ur.roleId))
      .map((ur) => ur.roleId);

    await this.prisma.$transaction([
      ...toCreate.map((roleId) =>
        this.prisma.userRole.create({
          data: { userId, roleId, createdBy: updatedBy, updatedBy },
        }),
      ),
      ...(toReactivate.length > 0
        ? [
            this.prisma.userRole.updateMany({
              where: { userId, roleId: { in: toReactivate } },
              data: { isActive: true, updatedBy },
            }),
          ]
        : []),
      ...(toDeactivate.length > 0
        ? [
            this.prisma.userRole.updateMany({
              where: { userId, roleId: { in: toDeactivate } },
              data: { isActive: false, updatedBy },
            }),
          ]
        : []),
    ]);

    return true;
  }

  /** Validates that all supplied teamIds belong to the caller's organization. */
  @OrgScoped()
  findTeamsInOrg(scope: OrgScope, teamIds: number[]) {
    return this.prisma.team.findMany({
      where: tenantWhere(scope, { id: { in: teamIds } }),
      select: { id: true },
    });
  }

  /** Assigns teams to user in user_team_access. */
  @OrgScoped()
  async assignTeams(
    scope: OrgScope,
    userId: number,
    assignments: Array<{ teamId: number; isLead: boolean }>,
    updatedBy: number,
  ) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(scope, { id: userId, deletedAt: null }),
    });
    if (!user) return false;

    const existing = await this.prisma.userTeamAccess.findMany({
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

    await this.prisma.$transaction([
      ...toCreate.map((a) =>
        this.prisma.userTeamAccess.create({
          data: {
            organizationId: scope.organizationId,
            userId,
            teamId: a.teamId,
            isLead: a.isLead,
            createdBy: updatedBy,
            updatedBy,
          },
        }),
      ),
      ...toUpdate.map((a) =>
        this.prisma.userTeamAccess.updateMany({
          where: { userId, teamId: a.teamId },
          data: { isActive: true, isLead: a.isLead, updatedBy },
        }),
      ),
      ...(toDeactivate.length > 0
        ? [
            this.prisma.userTeamAccess.updateMany({
              where: { userId, teamId: { in: toDeactivate } },
              data: { isActive: false, updatedBy },
            }),
          ]
        : []),
    ]);

    return true;
  }
}
