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
  QueryPayrollEntryDto,
  QueryPayrollRunDto,
} from "./dto/payroll-run.dto.js";
import type { CalculatedEmployeePayroll } from "./payroll-calculator.service.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_RUN_DETAILS = {
  payrollPeriod: {
    select: { id: true, year: true, month: true, status: true },
  },
  runCreator: { select: { id: true, fullName: true } },
  runApprover: { select: { id: true, fullName: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.PayrollRunInclude;

const INCLUDE_ENTRY_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
    },
  },
  payrollRun: {
    select: { id: true, runNumber: true, status: true, payrollPeriodId: true },
  },
  earnings: {
    select: {
      id: true,
      code: true,
      name: true,
      baseAmount: true,
      earningRatio: true,
      calculatedAmount: true,
    },
  },
  deductions: {
    select: {
      id: true,
      code: true,
      name: true,
      amount: true,
      sourceType: true,
      sourceId: true,
    },
  },
  payslip: {
    select: { id: true, payslipNumber: true, status: true },
  },
} satisfies Prisma.PayrollEntryInclude;

@Injectable()
export class PayrollRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findManyRuns(
    scope: OrgScope,
    query: QueryPayrollRunDto,
    pagination: PaginationDto,
  ) {
    const where: Prisma.PayrollRunWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        include: INCLUDE_RUN_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findRunById(scope: OrgScope, id: number) {
    return this.prisma.payrollRun.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE_RUN_DETAILS,
    });
  }

  @OrgScoped()
  async createRun(
    scope: OrgScope,
    payrollPeriodId: number,
    runNumber: number,
    notes: string | undefined,
    createdById: number,
    calculations: CalculatedEmployeePayroll[],
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const run = await tx.payrollRun.create({
        data: {
          organizationId: scope.organizationId,
          payrollPeriodId,
          runNumber,
          status: "PROCESSED",
          startedAt: new Date(),
          completedAt: new Date(),
          createdById,
          notes: notes ?? null,
          createdBy: createdById,
          updatedBy: createdById,
        },
      });

      for (const calc of calculations) {
        const entry = await tx.payrollEntry.create({
          data: {
            organizationId: scope.organizationId,
            payrollRunId: run.id,
            employeeId: calc.employeeId,
            totalCalendarDays: calc.totalCalendarDays,
            requiredWorkingDays: calc.requiredWorkingDays,
            presentDays: calc.presentDays,
            halfDays: calc.halfDays,
            holidayDays: calc.holidayDays,
            leaveDays: calc.leaveDays,
            lopDays: calc.lopDays,
            payableDays: calc.payableDays,
            monthlyGross: calc.monthlyGross,
            perDayRate: calc.perDayRate,
            earningRatio: calc.earningRatio,
            baseEarnings: calc.baseEarnings,
            totalGrossEarnings: calc.totalGrossEarnings,
            totalDeductions: calc.totalDeductions,
            netPayable: calc.netPayable,
            status: "CALCULATED",
            createdBy: createdById,
            updatedBy: createdById,
          },
        });

        // Insert Earnings
        if (calc.earnings.length > 0) {
          await tx.payrollEarning.createMany({
            data: calc.earnings.map((e) => ({
              organizationId: scope.organizationId,
              payrollEntryId: entry.id,
              code: e.code,
              name: e.name,
              baseAmount: e.baseAmount,
              earningRatio: e.earningRatio,
              calculatedAmount: e.calculatedAmount,
              createdBy: createdById,
              updatedBy: createdById,
            })),
          });
        }

        // Insert Deductions
        if (calc.deductions.length > 0) {
          await tx.payrollDeduction.createMany({
            data: calc.deductions.map((d) => ({
              organizationId: scope.organizationId,
              payrollEntryId: entry.id,
              code: d.code,
              name: d.name,
              amount: d.amount,
              sourceType: d.sourceType ?? null,
              sourceId: d.sourceId ?? null,
              createdBy: createdById,
              updatedBy: createdById,
            })),
          });
        }

        // PF Contribution Snapshot
        if (calc.pf) {
          await tx.pfContribution.upsert({
            where: {
              payrollPeriodId_employeeId: {
                payrollPeriodId,
                employeeId: calc.employeeId,
              },
            },
            create: {
              organizationId: scope.organizationId,
              payrollPeriodId,
              payrollEntryId: entry.id,
              employeeId: calc.employeeId,
              pfIncluded: calc.pf.pfIncluded,
              pfWage: calc.pf.pfWage,
              employeeContribution: calc.pf.employeeContribution,
              employerContribution: calc.pf.employerContribution,
              paymentStatus: "PENDING",
              salaryCredited: false,
              createdBy: createdById,
              updatedBy: createdById,
            },
            update: {
              payrollEntryId: entry.id,
              pfIncluded: calc.pf.pfIncluded,
              pfWage: calc.pf.pfWage,
              employeeContribution: calc.pf.employeeContribution,
              employerContribution: calc.pf.employerContribution,
              updatedBy: createdById,
            },
          });
        }

        // ESI Contribution Snapshot
        if (calc.esi) {
          await tx.esiContribution.upsert({
            where: {
              payrollPeriodId_employeeId: {
                payrollPeriodId,
                employeeId: calc.employeeId,
              },
            },
            create: {
              organizationId: scope.organizationId,
              payrollPeriodId,
              payrollEntryId: entry.id,
              employeeId: calc.employeeId,
              esiIncluded: calc.esi.esiIncluded,
              esiWage: calc.esi.esiWage,
              employeeContribution: calc.esi.employeeContribution,
              employerContribution: calc.esi.employerContribution,
              paymentStatus: "PENDING",
              salaryCredited: false,
              createdBy: createdById,
              updatedBy: createdById,
            },
            update: {
              payrollEntryId: entry.id,
              esiIncluded: calc.esi.esiIncluded,
              esiWage: calc.esi.esiWage,
              employeeContribution: calc.esi.employeeContribution,
              employerContribution: calc.esi.employerContribution,
              updatedBy: createdById,
            },
          });
        }

        // Link pending loan repayments to this entry
        for (const lr of calc.loanRepayments) {
          const repayment = await tx.loanRepayment.findFirst({
            where: {
              loanId: lr.loanId,
              status: "PENDING",
            },
            orderBy: { installmentNo: "asc" },
          });
          if (repayment) {
            await tx.loanRepayment.update({
              where: { id: repayment.id },
              data: { payrollEntryId: entry.id },
            });
          }
        }

        // Link included bonuses to this period
        if (calc.bonusIds.length > 0) {
          await tx.employeeBonus.updateMany({
            where: { id: { in: calc.bonusIds } },
            data: { payrollPeriodId },
          });
        }
      }

      // Update Period status to PROCESSED
      await tx.payrollPeriod.update({
        where: { id: payrollPeriodId },
        data: { status: "PROCESSED" },
      });

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: run.id },
        include: INCLUDE_RUN_DETAILS,
      });
    });
  }

  @OrgScoped()
  async approveRun(
    scope: OrgScope,
    id: number,
    approvedById: number,
    notes: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById,
          approvedAt: new Date(),
          ...(notes ? { notes } : {}),
          updatedBy: approvedById,
        },
        include: INCLUDE_RUN_DETAILS,
      });

      await tx.payrollEntry.updateMany({
        where: { payrollRunId: id },
        data: { status: "APPROVED" },
      });

      await tx.payrollPeriod.update({
        where: { id: run.payrollPeriodId },
        data: { status: "APPROVED" },
      });

      return run;
    });
  }

  // ---- Entries -------------------------------------------------------------

  @TeamScoped()
  async findManyEntries(
    scope: TeamScope,
    query: QueryPayrollEntryDto,
    pagination: PaginationDto,
  ) {
    const filter: Prisma.PayrollEntryWhereInput = {
      deletedAt: null,
      ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
      ...(query.payrollPeriodId
        ? { payrollRun: { payrollPeriodId: query.payrollPeriodId } }
        : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.PayrollEntryWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.payrollEntry.findMany({
        where,
        include: INCLUDE_ENTRY_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payrollEntry.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findEntryById(scope: TeamScope, id: number) {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.PayrollEntryWhereInput;

    return this.prisma.payrollEntry.findFirst({
      where,
      include: INCLUDE_ENTRY_DETAILS,
    });
  }
}
