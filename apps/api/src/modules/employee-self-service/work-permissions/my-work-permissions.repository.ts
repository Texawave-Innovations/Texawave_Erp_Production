import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

const INCLUDE = {
  employee: {
    select: { id: true, employeeCode: true, fullName: true },
  },
  requester: {
    select: { id: true, fullName: true },
  },
  decider: {
    select: { id: true, fullName: true },
  },
} as const;

export interface NewWorkPermission {
  employeeId: number;
  date: string;
  fromTime: string;
  toTime: string;
  durationMins: number;
  reason: string;
  requestedBy: number;
}

@Injectable()
export class MyWorkPermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async create(scope: OrgScope, data: NewWorkPermission) {
    return this.prisma.workPermission.create({
      data: {
        organizationId: scope.organizationId,
        employeeId: data.employeeId,
        date: new Date(data.date),
        fromTime: data.fromTime,
        toTime: data.toTime,
        durationMins: data.durationMins,
        reason: data.reason,
        requestedBy: data.requestedBy,
        status: "PENDING",
      },
      include: INCLUDE,
    });
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    query: PaginationDto & { year?: number },
  ) {
    const where = {
      organizationId: scope.organizationId,
      employeeId,
      ...(query.year
        ? {
            date: {
              gte: new Date(`${query.year}-01-01`),
              lte: new Date(`${query.year}-12-31`),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workPermission.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.workPermission.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findMineOne(scope: OrgScope, employeeId: number, id: number) {
    return this.prisma.workPermission.findFirst({
      where: { id, organizationId: scope.organizationId, employeeId },
      include: INCLUDE,
    });
  }

  @OrgScoped()
  async findAll(
    scope: OrgScope,
    query: { status?: string; year?: number; skip: number; limit: number },
  ) {
    const where = {
      organizationId: scope.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.year
        ? {
            date: {
              gte: new Date(`${query.year}-01-01`),
              lte: new Date(`${query.year}-12-31`),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workPermission.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.workPermission.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.workPermission.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: INCLUDE,
    });
  }

  @OrgScoped()
  decide(
    scope: OrgScope,
    id: number,
    data: { status: string; hrNote?: string; decidedBy: number },
  ) {
    return this.prisma.workPermission.update({
      where: { id, organizationId: scope.organizationId },
      data: {
        status: data.status,
        hrNote: data.hrNote ?? null,
        decidedBy: data.decidedBy,
        decidedAt: new Date(),
      },
      include: INCLUDE,
    });
  }
}
