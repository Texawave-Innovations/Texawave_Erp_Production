import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  CreateSalaryDto,
  QuerySalaryDto,
  UpdateSalaryDto,
} from "./dto/salary.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_EMPLOYEE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      status: true,
    },
  },
} satisfies Prisma.EmployeeSalaryInclude;

export type SalaryRow = Prisma.EmployeeSalaryGetPayload<{
  include: typeof INCLUDE_EMPLOYEE;
}>;

@Injectable()
export class SalariesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QuerySalaryDto,
    pagination: PaginationDto,
  ): Promise<{ items: SalaryRow[]; total: number }> {
    const filter: Prisma.EmployeeSalaryWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.effectiveOn
        ? {
            effectiveFrom: { lte: new Date(query.effectiveOn) },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date(query.effectiveOn) } },
            ],
          }
        : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.employeeSalary.findMany({
        where,
        include: INCLUDE_EMPLOYEE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      }),
      this.prisma.employeeSalary.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<SalaryRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    return this.prisma.employeeSalary.findFirst({
      where,
      include: INCLUDE_EMPLOYEE,
    });
  }

  @TeamScoped()
  async findApplicableOn(
    scope: TeamScope,
    employeeId: number,
    date: Date,
  ): Promise<SalaryRow | null> {
    const filter: Prisma.EmployeeSalaryWhereInput = {
      employeeId,
      deletedAt: null,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    return this.prisma.employeeSalary.findFirst({
      where,
      include: INCLUDE_EMPLOYEE,
      orderBy: { effectiveFrom: "desc" },
    });
  }

  @OrgScoped()
  async findOverlapping(
    scope: OrgScope,
    employeeId: number,
    from: Date,
    to: Date | null,
    excludeId?: number,
  ): Promise<SalaryRow | null> {
    const conditions: Prisma.EmployeeSalaryWhereInput[] = [
      tenantWhere(scope, {
        employeeId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      }),
    ];

    if (to === null) {
      // open-ended range clashes if another range ends after from or is open-ended
      conditions.push({
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      });
    } else {
      // closed range clashes if it overlaps [from, to]
      conditions.push({
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      });
    }

    return this.prisma.employeeSalary.findFirst({
      where: { AND: conditions },
      include: INCLUDE_EMPLOYEE,
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateSalaryDto,
    from: Date,
    to: Date | null,
    grossMonthly: number,
    createdById: number,
  ): Promise<SalaryRow> {
    return this.prisma.employeeSalary.create({
      data: {
        organizationId: scope.organizationId,
        employeeId: dto.employeeId,
        effectiveFrom: from,
        effectiveTo: to,
        grossMonthly,
        basic: dto.basic,
        hra: dto.hra,
        conveyance: dto.conveyance ?? 0,
        otherAllowance: dto.otherAllowance ?? 0,
        specialAllowance: dto.specialAllowance ?? 0,
        arrearsSalary: dto.arrearsSalary ?? 0,
        createdBy: createdById,
        updatedBy: createdById,
      },
      include: INCLUDE_EMPLOYEE,
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateSalaryDto,
    to: Date | null | undefined,
    grossMonthly: number | undefined,
    updatedById: number,
  ): Promise<SalaryRow> {
    return this.prisma.employeeSalary.update({
      where: { id },
      data: {
        ...(to !== undefined ? { effectiveTo: to } : {}),
        ...(grossMonthly !== undefined ? { grossMonthly } : {}),
        ...(dto.basic !== undefined ? { basic: dto.basic } : {}),
        ...(dto.hra !== undefined ? { hra: dto.hra } : {}),
        ...(dto.conveyance !== undefined ? { conveyance: dto.conveyance } : {}),
        ...(dto.otherAllowance !== undefined
          ? { otherAllowance: dto.otherAllowance }
          : {}),
        ...(dto.specialAllowance !== undefined
          ? { specialAllowance: dto.specialAllowance }
          : {}),
        // New arrears are a new one-time payment: clear the "already paid"
        // marker so the next finalized period pays them.
        ...(dto.arrearsSalary !== undefined
          ? { arrearsSalary: dto.arrearsSalary, arrearsPaidPeriodId: null }
          : {}),
        updatedBy: updatedById,
      },
      include: INCLUDE_EMPLOYEE,
    });
  }
}
