import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type { CreateBonusDto, QueryBonusDto } from "./dto/bonus.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
    },
  },
  payrollPeriod: {
    select: { id: true, year: true, month: true, status: true },
  },
  approver: {
    select: { id: true, fullName: true },
  },
} satisfies Prisma.EmployeeBonusInclude;

export type BonusRow = Prisma.EmployeeBonusGetPayload<{
  include: typeof INCLUDE_DETAILS;
}>;

@Injectable()
export class BonusesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryBonusDto,
    pagination: PaginationDto,
  ): Promise<{ items: BonusRow[]; total: number }> {
    const filter: Prisma.EmployeeBonusWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBonusWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.employeeBonus.findMany({
        where,
        include: INCLUDE_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.employeeBonus.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<BonusRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBonusWhereInput;

    return this.prisma.employeeBonus.findFirst({
      where,
      include: INCLUDE_DETAILS,
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateBonusDto,
    createdById: number,
  ): Promise<BonusRow> {
    return this.prisma.employeeBonus.create({
      data: {
        organizationId: scope.organizationId,
        employeeId: dto.employeeId,
        payrollPeriodId: dto.payrollPeriodId ?? null,
        bonusType: dto.bonusType,
        calculationBase: dto.calculationBase ?? null,
        tenureMonths: dto.tenureMonths ?? null,
        attendanceDays: dto.attendanceDays ?? null,
        amount: dto.amount,
        status: "PENDING",
        reason: dto.reason ?? null,
        createdBy: createdById,
        updatedBy: createdById,
      },
      include: INCLUDE_DETAILS,
    });
  }

  @OrgScoped()
  async decide(
    scope: OrgScope,
    id: number,
    status: "APPROVED" | "REJECTED",
    approvedById: number,
  ): Promise<BonusRow> {
    return this.prisma.employeeBonus.update({
      where: { id },
      data: {
        status,
        approvedById,
        approvedAt: new Date(),
        updatedBy: approvedById,
      },
      include: INCLUDE_DETAILS,
    });
  }
}
