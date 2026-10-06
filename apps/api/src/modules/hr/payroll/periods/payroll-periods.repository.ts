import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  CreatePayrollPeriodDto,
  QueryPayrollPeriodDto,
} from "./dto/payroll-period.dto.js";

const INCLUDE_RUNS = {
  runs: {
    select: {
      id: true,
      runNumber: true,
      status: true,
      startedAt: true,
      completedAt: true,
      approvedAt: true,
    },
    orderBy: { runNumber: "desc" },
  },
  finalizedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.PayrollPeriodInclude;

export type PayrollPeriodRow = Prisma.PayrollPeriodGetPayload<{
  include: typeof INCLUDE_RUNS;
}>;

@Injectable()
export class PayrollPeriodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    query: QueryPayrollPeriodDto,
    pagination: PaginationDto,
  ): Promise<{ items: PayrollPeriodRow[]; total: number }> {
    const where: Prisma.PayrollPeriodWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(query.year ? { year: query.year } : {}),
      ...(query.status ? { status: query.status } : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.payrollPeriod.findMany({
        where,
        include: INCLUDE_RUNS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      this.prisma.payrollPeriod.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findById(
    scope: OrgScope,
    id: number,
  ): Promise<PayrollPeriodRow | null> {
    return this.prisma.payrollPeriod.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE_RUNS,
    });
  }

  @OrgScoped()
  async findByYearMonth(
    scope: OrgScope,
    year: number,
    month: number,
  ): Promise<PayrollPeriodRow | null> {
    return this.prisma.payrollPeriod.findFirst({
      where: tenantWhere(scope, { year, month, deletedAt: null }),
      include: INCLUDE_RUNS,
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreatePayrollPeriodDto,
    dates: { periodStart: Date; periodEnd: Date },
    createdById: number,
  ): Promise<PayrollPeriodRow> {
    return this.prisma.payrollPeriod.create({
      data: {
        organizationId: scope.organizationId,
        year: dto.year,
        month: dto.month,
        periodStart: dates.periodStart,
        periodEnd: dates.periodEnd,
        status: "DRAFT",
        createdBy: createdById,
        updatedBy: createdById,
      },
      include: INCLUDE_RUNS,
    });
  }

  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    status: string,
    updatedById: number,
  ): Promise<PayrollPeriodRow> {
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status,
        updatedBy: updatedById,
      },
      include: INCLUDE_RUNS,
    });
  }

  @OrgScoped()
  async finalize(
    scope: OrgScope,
    id: number,
    finalizedById: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PayrollPeriodRow> {
    const client = tx ?? this.prisma;
    return client.payrollPeriod.update({
      where: { id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedById,
        updatedBy: finalizedById,
      },
      include: INCLUDE_RUNS,
    });
  }
}
