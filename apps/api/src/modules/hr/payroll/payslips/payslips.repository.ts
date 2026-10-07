import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { lockPayrollPeriod } from "../shared/payroll-locks.js";
import {
  findApprovedRun,
  generatePayslipsForRun,
} from "../shared/payslip-generation.js";
import type { QueryPayslipDto } from "./dto/payslip.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_PAYSLIP_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      designation: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      bankDetails: {
        select: {
          bankName: true,
          accountNumber: true,
          ifscCode: true,
          panNumber: true,
        },
      },
      pfProfile: { select: { uan: true, pfNumber: true } },
      esiProfile: { select: { insuranceNumber: true } },
    },
  },
  payrollPeriod: {
    select: {
      id: true,
      year: true,
      month: true,
      periodStart: true,
      periodEnd: true,
      status: true,
    },
  },
  payrollEntry: {
    include: {
      earnings: {
        select: {
          code: true,
          name: true,
          baseAmount: true,
          earningRatio: true,
          calculatedAmount: true,
        },
      },
      deductions: {
        select: {
          code: true,
          name: true,
          amount: true,
          sourceType: true,
        },
      },
    },
  },
} satisfies Prisma.PayslipInclude;

export type PayslipRow = Prisma.PayslipGetPayload<{
  include: typeof INCLUDE_PAYSLIP_DETAILS;
}>;

@Injectable()
export class PayslipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryPayslipDto,
    pagination: PaginationDto,
  ): Promise<{ items: PayslipRow[]; total: number }> {
    const filter: Prisma.PayslipWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.PayslipWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: INCLUDE_PAYSLIP_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<PayslipRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.PayslipWhereInput;

    return this.prisma.payslip.findFirst({
      where,
      include: INCLUDE_PAYSLIP_DETAILS,
    });
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    query: QueryPayslipDto,
    pagination: PaginationDto,
  ): Promise<{ items: PayslipRow[]; total: number }> {
    const where: Prisma.PayslipWhereInput = {
      organizationId: scope.organizationId,
      employeeId,
      deletedAt: null,
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: INCLUDE_PAYSLIP_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findMineById(
    scope: OrgScope,
    employeeId: number,
    id: number,
  ): Promise<PayslipRow | null> {
    return this.prisma.payslip.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
      },
      include: INCLUDE_PAYSLIP_DETAILS,
    });
  }

  /**
   * (Re)generates payslips for the period's approved run. Both lookups are
   * organization-filtered and the period is row-locked, so another org's
   * period id is "not found" and concurrent calls cannot double-number.
   */
  @OrgScoped()
  async generateForPeriod(
    scope: OrgScope,
    payrollPeriodId: number,
    createdById: number,
  ): Promise<PayslipRow[] | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await lockPayrollPeriod(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      if (!period) return null;

      const run = await findApprovedRun(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      const ids = await generatePayslipsForRun(
        tx,
        scope.organizationId,
        period,
        run.id,
        createdById,
      );

      return tx.payslip.findMany({
        where: { id: { in: ids }, organizationId: scope.organizationId },
        include: INCLUDE_PAYSLIP_DETAILS,
        orderBy: { id: "asc" },
      });
    });
  }
}
