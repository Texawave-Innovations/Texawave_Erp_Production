import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

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

  /** Decides a request only if it is still PENDING and was not raised by the
   * decider, in ONE conditional UPDATE: two concurrent deciders cannot both
   * win (the loser matches zero rows), and a self-decision cannot slip
   * through a race. The audit row commits or rolls back with the update.
   * Returns null when no row matched; the caller works out why. The HR note
   * is free text and is deliberately not copied into the audit trail. */
  @OrgScoped()
  decide(
    scope: OrgScope,
    id: number,
    data: { status: string; hrNote?: string; decidedBy: number },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workPermission.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: "PENDING",
          requestedBy: { not: data.decidedBy },
        },
        data: {
          status: data.status,
          hrNote: data.hrNote ?? null,
          decidedBy: data.decidedBy,
          decidedAt: new Date(),
        },
      });
      if (count !== 1) return null;
      await this.audit.write(tx, {
        entityType: "work_permission",
        entityId: id,
        action: data.status === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING" },
        after: { status: data.status, decidedBy: data.decidedBy },
      });
      return tx.workPermission.findFirst({
        where: { id, organizationId: scope.organizationId },
        include: INCLUDE,
      });
    });
  }
}
