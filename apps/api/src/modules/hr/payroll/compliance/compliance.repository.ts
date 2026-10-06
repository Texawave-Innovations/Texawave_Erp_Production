import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  QueryContributionDto,
  UpdateEmployeeEsiProfileDto,
  UpdateEmployeePfProfileDto,
} from "./dto/compliance.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

@Injectable()
export class ComplianceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- PF Profiles ---------------------------------------------------------

  @TeamScoped()
  async getPfProfile(scope: TeamScope, employeeId: number) {
    const where = teamWhere(
      scope,
      { employeeId, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeePfProfileWhereInput;

    return this.prisma.employeePfProfile.findFirst({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
      },
    });
  }

  @TeamScoped()
  async upsertPfProfile(
    scope: TeamScope,
    employeeId: number,
    dto: UpdateEmployeePfProfileDto,
    from: Date | undefined,
    to: Date | null | undefined,
  ) {
    const orgId = scope.organizationId;
    return this.prisma.employeePfProfile.upsert({
      where: { employeeId },
      create: {
        organizationId: orgId,
        employeeId,
        pfApplicable: dto.pfApplicable,
        uan: dto.uan ?? null,
        pfNumber: dto.pfNumber ?? null,
        effectiveFrom: from ?? new Date(),
        effectiveTo: to ?? null,
        createdBy: scope.userId,
        updatedBy: scope.userId,
      },
      update: {
        pfApplicable: dto.pfApplicable,
        uan: dto.uan ?? null,
        pfNumber: dto.pfNumber ?? null,
        ...(from !== undefined ? { effectiveFrom: from } : {}),
        ...(to !== undefined ? { effectiveTo: to } : {}),
        updatedBy: scope.userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
      },
    });
  }

  // ---- ESI Profiles --------------------------------------------------------

  @TeamScoped()
  async getEsiProfile(scope: TeamScope, employeeId: number) {
    const where = teamWhere(
      scope,
      { employeeId, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeEsiProfileWhereInput;

    return this.prisma.employeeEsiProfile.findFirst({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
      },
    });
  }

  @TeamScoped()
  async upsertEsiProfile(
    scope: TeamScope,
    employeeId: number,
    dto: UpdateEmployeeEsiProfileDto,
    from: Date | undefined,
    to: Date | null | undefined,
  ) {
    const orgId = scope.organizationId;
    return this.prisma.employeeEsiProfile.upsert({
      where: { employeeId },
      create: {
        organizationId: orgId,
        employeeId,
        esiApplicable: dto.esiApplicable,
        insuranceNumber: dto.insuranceNumber ?? null,
        effectiveFrom: from ?? new Date(),
        effectiveTo: to ?? null,
        createdBy: scope.userId,
        updatedBy: scope.userId,
      },
      update: {
        esiApplicable: dto.esiApplicable,
        insuranceNumber: dto.insuranceNumber ?? null,
        ...(from !== undefined ? { effectiveFrom: from } : {}),
        ...(to !== undefined ? { effectiveTo: to } : {}),
        updatedBy: scope.userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
      },
    });
  }

  // ---- PF Contributions ----------------------------------------------------

  @TeamScoped()
  async findPfContributions(
    scope: TeamScope,
    query: QueryContributionDto,
    pagination: PaginationDto,
  ) {
    const filter: Prisma.PfContributionWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.PfContributionWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.pfContribution.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              teamId: true,
            },
          },
          payrollPeriod: {
            select: { id: true, year: true, month: true, status: true },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.pfContribution.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findPfContributionById(scope: TeamScope, id: number) {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.PfContributionWhereInput;

    return this.prisma.pfContribution.findFirst({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
        payrollPeriod: {
          select: { id: true, year: true, month: true, status: true },
        },
      },
    });
  }

  // ---- ESI Contributions ---------------------------------------------------

  @TeamScoped()
  async findEsiContributions(
    scope: TeamScope,
    query: QueryContributionDto,
    pagination: PaginationDto,
  ) {
    const filter: Prisma.EsiContributionWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EsiContributionWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.esiContribution.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              teamId: true,
            },
          },
          payrollPeriod: {
            select: { id: true, year: true, month: true, status: true },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.esiContribution.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findEsiContributionById(scope: TeamScope, id: number) {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EsiContributionWhereInput;

    return this.prisma.esiContribution.findFirst({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
          },
        },
        payrollPeriod: {
          select: { id: true, year: true, month: true, status: true },
        },
      },
    });
  }
}
