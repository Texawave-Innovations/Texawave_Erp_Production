import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import {
  bonusesPaidElsewhere,
  cancelLiveRuns,
  installmentClaimableBy,
} from "../shared/payroll-claims.js";
import { lockPayrollPeriod } from "../shared/payroll-locks.js";
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
      // Names for the salary report's team/department filters.
      team: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
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

function sameIds(a: number[], b: number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((id, i) => id === sb[i]);
}

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

  /**
   * Stores a run under the period row lock, so concurrent runs/approvals of
   * one period serialize:
   * - the period is re-checked (not FINALIZED/CANCELLED) after locking;
   * - the period's live runs must still be exactly `expectedLiveRunIds` (the
   *   ones the caller calculated against), else the inputs changed meanwhile;
   * - every earlier PROCESSED/APPROVED run of the period is superseded
   *   (`cancelLiveRuns`), so a period never has two payable runs;
   * - the loan installments and bonuses the calculation pays are row-locked
   *   and re-checked as still unclaimed by any other open period, so two
   *   periods never deduct one EMI or pay one bonus twice;
   * - the run number is max+1 read under the same lock (no count() race).
   */
  @OrgScoped()
  async createRun(
    scope: OrgScope,
    payrollPeriodId: number,
    notes: string | undefined,
    createdById: number,
    calculations: CalculatedEmployeePayroll[],
    expectedLiveRunIds: number[],
  ) {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const period = await lockPayrollPeriod(
          tx,
          scope.organizationId,
          payrollPeriodId,
        );
        if (!period) {
          throw new ResourceNotFoundException(
            "Payroll period",
            payrollPeriodId,
          );
        }
        if (period.status === "FINALIZED" || period.status === "CANCELLED") {
          throw new BusinessRuleViolationException(
            `Cannot process payroll for a ${period.status.toLowerCase()} period`,
            "PAYROLL_FINALIZED",
          );
        }

        const supersededIds = await cancelLiveRuns(
          tx,
          scope.organizationId,
          payrollPeriodId,
          createdById,
        );
        if (!sameIds(supersededIds, expectedLiveRunIds)) {
          throw new BusinessRuleConflictException(
            "Payroll for this period changed while it was being calculated. Run it again.",
            "PAYROLL_INPUTS_CHANGED",
          );
        }
        await this.assertStillClaimable(
          tx,
          scope.organizationId,
          payrollPeriodId,
          calculations,
        );

        const last = await tx.payrollRun.aggregate({
          where: { payrollPeriodId },
          _max: { runNumber: true },
        });
        const runNumber = (last._max.runNumber ?? 0) + 1;

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
          await this.storeEntry(
            tx,
            scope,
            payrollPeriodId,
            run.id,
            calc,
            createdById,
          );
        }

        await tx.payrollPeriod.update({
          where: { id: payrollPeriodId },
          data: { status: "PROCESSED", updatedBy: createdById },
        });

        return tx.payrollRun.findUniqueOrThrow({
          where: { id: run.id },
          include: INCLUDE_RUN_DETAILS,
        });
      },
      { timeout: 120_000 },
    );
  }

  /**
   * Row-locks the installments and bonuses the calculation pays (in id order,
   * so two periods' runs never deadlock) and re-checks — now that no other
   * run can claim them concurrently — that each is still unpaid and not taken
   * by a live run of another period. A miss means the inputs changed after
   * the calculation: the whole run is rejected rather than paying twice.
   */
  private async assertStillClaimable(
    tx: Prisma.TransactionClient,
    organizationId: number,
    payrollPeriodId: number,
    calculations: CalculatedEmployeePayroll[],
  ) {
    const repaymentIds = calculations
      .flatMap((c) => c.loanRepayments.map((lr) => lr.repaymentId))
      .sort((a, b) => a - b);
    const bonusIds = calculations
      .flatMap((c) => c.bonusIds)
      .sort((a, b) => a - b);
    const changed = () =>
      new BusinessRuleConflictException(
        "A loan installment or bonus in this run was changed or paid by another payroll period meanwhile. Run payroll again.",
        "PAYROLL_INPUTS_CHANGED",
      );

    if (repaymentIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM hr.loan_repayments
         WHERE id IN (${Prisma.join(repaymentIds)})
         ORDER BY id
           FOR UPDATE`;
      const claimable = await tx.loanRepayment.count({
        where: {
          id: { in: repaymentIds },
          organizationId,
          status: "PENDING",
          deletedAt: null,
          ...installmentClaimableBy(payrollPeriodId),
        },
      });
      if (claimable !== new Set(repaymentIds).size) throw changed();
    }

    if (bonusIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM hr.employee_bonuses
         WHERE id IN (${Prisma.join(bonusIds)})
         ORDER BY id
           FOR UPDATE`;
      const approved = await tx.employeeBonus.count({
        where: {
          id: { in: bonusIds },
          organizationId,
          status: "APPROVED",
          deletedAt: null,
        },
      });
      const paidElsewhere = await bonusesPaidElsewhere(
        tx,
        organizationId,
        payrollPeriodId,
        bonusIds,
      );
      if (approved !== new Set(bonusIds).size || paidElsewhere.size > 0) {
        throw changed();
      }
    }
  }

  private async storeEntry(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    payrollPeriodId: number,
    payrollRunId: number,
    calc: CalculatedEmployeePayroll,
    createdById: number,
  ) {
    const entry = await tx.payrollEntry.create({
      data: {
        organizationId: scope.organizationId,
        payrollRunId,
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
          sourceType: e.sourceType ?? null,
          sourceId: e.sourceId ?? null,
          createdBy: createdById,
          updatedBy: createdById,
        })),
      });
    }

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

    // PF / ESI contribution snapshots: one per employee per period, so a
    // re-run overwrites (and revives — `cancelLiveRuns` retired it) the
    // snapshot of the run it superseded.
    const key = {
      payrollPeriodId_employeeId: {
        payrollPeriodId,
        employeeId: calc.employeeId,
      },
    };
    if (calc.pf) {
      const figures = {
        payrollEntryId: entry.id,
        pfIncluded: calc.pf.pfIncluded,
        pfWage: calc.pf.pfWage,
        employeeContribution: calc.pf.employeeContribution,
        employerContribution: calc.pf.employerContribution,
        deletedAt: null,
        updatedBy: createdById,
      };
      await tx.pfContribution.upsert({
        where: key,
        create: {
          ...figures,
          organizationId: scope.organizationId,
          payrollPeriodId,
          employeeId: calc.employeeId,
          paymentStatus: "PENDING",
          salaryCredited: false,
          createdBy: createdById,
        },
        update: figures,
      });
    }
    if (calc.esi) {
      const figures = {
        payrollEntryId: entry.id,
        esiIncluded: calc.esi.esiIncluded,
        esiWage: calc.esi.esiWage,
        employeeContribution: calc.esi.employeeContribution,
        employerContribution: calc.esi.employerContribution,
        deletedAt: null,
        updatedBy: createdById,
      };
      await tx.esiContribution.upsert({
        where: key,
        create: {
          ...figures,
          organizationId: scope.organizationId,
          payrollPeriodId,
          employeeId: calc.employeeId,
          paymentStatus: "PENDING",
          salaryCredited: false,
          createdBy: createdById,
        },
        update: figures,
      });
    }

    // Link exactly the installments the calculator deducted (checked as
    // claimable and row-locked by `assertStillClaimable`). Bonuses need no
    // link here: their BONUS earnings carry the bonus id, and finalize marks
    // exactly those PAID.
    for (const lr of calc.loanRepayments) {
      await tx.loanRepayment.updateMany({
        where: {
          id: lr.repaymentId,
          organizationId: scope.organizationId,
          status: "PENDING",
        },
        data: { payrollEntryId: entry.id, updatedBy: createdById },
      });
    }
  }

  /**
   * PROCESSED -> APPROVED as one conditional update under the period lock: a
   * second concurrent approval (or approval of a run superseded meanwhile)
   * matches no row and fails instead of approving twice.
   */
  @OrgScoped()
  async approveRun(
    scope: OrgScope,
    id: number,
    approvedById: number,
    notes: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.payrollRun.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        select: { payrollPeriodId: true },
      });
      if (!current) throw new ResourceNotFoundException("Payroll run", id);
      await lockPayrollPeriod(
        tx,
        scope.organizationId,
        current.payrollPeriodId,
      );

      const { count } = await tx.payrollRun.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: "PROCESSED",
        },
        data: {
          status: "APPROVED",
          approvedById,
          approvedAt: new Date(),
          ...(notes ? { notes } : {}),
          updatedBy: approvedById,
        },
      });
      if (count === 0) {
        throw new BusinessRuleViolationException(
          "Payroll run is no longer awaiting approval",
          "INVALID_STATE_TRANSITION",
        );
      }

      await tx.payrollEntry.updateMany({
        where: { payrollRunId: id },
        data: { status: "APPROVED", updatedBy: approvedById },
      });

      await tx.payrollPeriod.update({
        where: { id: current.payrollPeriodId },
        data: { status: "APPROVED", updatedBy: approvedById },
      });

      return tx.payrollRun.findUniqueOrThrow({
        where: { id },
        include: INCLUDE_RUN_DETAILS,
      });
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
