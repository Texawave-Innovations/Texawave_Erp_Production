import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
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

  @OrgScoped()
  async generateForPeriod(
    scope: OrgScope,
    payrollPeriodId: number,
    createdById: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUniqueOrThrow({
        where: { id: payrollPeriodId },
      });

      // Find the latest approved run for this period
      const run = await tx.payrollRun.findFirst({
        where: {
          payrollPeriodId,
          status: "APPROVED",
        },
        orderBy: { runNumber: "desc" },
        include: {
          entries: true,
        },
      });

      if (!run) {
        throw new Error(
          "Cannot generate payslips: no approved payroll run found for this period",
        );
      }

      const payslipsCreated = [];
      let seq = await tx.payslip.count({
        where: { organizationId: scope.organizationId },
      });

      for (const entry of run.entries) {
        seq++;
        const payslipNumber = `PS-${period.year}${String(period.month).padStart(2, "0")}-${String(seq).padStart(5, "0")}`;

        const ps = await tx.payslip.upsert({
          where: { payrollEntryId: entry.id },
          create: {
            organizationId: scope.organizationId,
            payrollPeriodId,
            payrollEntryId: entry.id,
            employeeId: entry.employeeId,
            payslipNumber,
            netPayable: entry.netPayable,
            status: "GENERATED",
            createdBy: createdById,
            updatedBy: createdById,
          },
          update: {
            netPayable: entry.netPayable,
            updatedBy: createdById,
          },
          include: INCLUDE_PAYSLIP_DETAILS,
        });

        payslipsCreated.push(ps);
      }

      return payslipsCreated;
    });
  }
}
