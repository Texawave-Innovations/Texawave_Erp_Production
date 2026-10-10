import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { cancelLiveRuns } from "../shared/payroll-claims.js";
import { lockPayrollPeriod } from "../shared/payroll-locks.js";
import {
  findApprovedRun,
  generatePayslipsForRun,
} from "../shared/payslip-generation.js";
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

  /**
   * Resets (DRAFT) or cancels (CANCELLED) a period under its row lock. Either
   * way its live runs stop being payable (`cancelLiveRuns`: installments
   * released, payslips voided), so a cancelled or reset period can never be
   * finalized or paid from a run approved before. Returns `null` for an
   * unknown id.
   */
  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    status: "DRAFT" | "CANCELLED",
    updatedById: number,
  ): Promise<PayrollPeriodRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await lockPayrollPeriod(tx, scope.organizationId, id);
      if (!period) return null;
      if (period.status === "FINALIZED") {
        throw new BusinessRuleViolationException(
          "Cannot update a finalized payroll period",
          "PAYROLL_FINALIZED",
        );
      }

      await cancelLiveRuns(tx, scope.organizationId, id, updatedById);

      return tx.payrollPeriod.update({
        where: { id },
        data: { status, updatedBy: updatedById },
        include: INCLUDE_RUNS,
      });
    });
  }

  /**
   * Finalizes the period in ONE transaction, under the period row lock:
   * re-checks status (must be APPROVED), takes the single approved run,
   * generates its payslips and settles what that run deducted or paid — loan
   * installments linked to its entries become PAID (a loan with no
   * installment left PENDING is CLOSED), the bonuses its BONUS earnings link
   * to become PAID, and salary arrears it paid are
   * marked so they are never paid again. Returns `null` for an unknown id.
   */
  @OrgScoped()
  async finalize(
    scope: OrgScope,
    id: number,
    finalizedById: number,
  ): Promise<PayrollPeriodRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await lockPayrollPeriod(tx, scope.organizationId, id);
      if (!period) return null;
      if (period.status === "FINALIZED") {
        throw new BusinessRuleViolationException(
          "Payroll period is already finalized",
          "PAYROLL_ALREADY_FINALIZED",
        );
      }
      // Only an APPROVED period (its run approved, not since reset or
      // cancelled) may be finalized.
      if (period.status !== "APPROVED") {
        throw new BusinessRuleViolationException(
          `Cannot finalize a ${period.status.toLowerCase()} payroll period; its payroll run must be approved first`,
          "INVALID_STATE_TRANSITION",
        );
      }

      const run = await findApprovedRun(tx, scope.organizationId, id);
      const bonusEarnings = await tx.payrollEarning.findMany({
        where: {
          organizationId: scope.organizationId,
          code: "BONUS",
          deletedAt: null,
          payrollEntry: { payrollRunId: run.id, deletedAt: null },
        },
        select: { sourceId: true },
      });
      // Runs calculated before bonus earnings were linked to their bonus
      // can't tell which bonuses they paid: they must be re-run.
      if (bonusEarnings.some((e) => e.sourceId === null)) {
        throw new BusinessRuleViolationException(
          "This period's approved run predates bonus tracking. Run payroll again and approve it before finalizing.",
          "PAYROLL_RUN_STALE",
        );
      }

      await generatePayslipsForRun(
        tx,
        scope.organizationId,
        period,
        run.id,
        finalizedById,
      );

      const entries = await tx.payrollEntry.findMany({
        where: {
          organizationId: scope.organizationId,
          payrollRunId: run.id,
          deletedAt: null,
        },
        select: { id: true, employeeId: true },
      });
      const entryIds = entries.map((e) => e.id);
      const now = new Date();

      // Loans: settle the installments this run deducted, then close loans
      // that have nothing left to recover.
      const settled = await tx.loanRepayment.findMany({
        where: {
          organizationId: scope.organizationId,
          payrollEntryId: { in: entryIds },
          status: "PENDING",
        },
        select: { loanId: true },
      });
      await tx.loanRepayment.updateMany({
        where: {
          organizationId: scope.organizationId,
          payrollEntryId: { in: entryIds },
          status: "PENDING",
        },
        data: { status: "PAID", paidAt: now, updatedBy: finalizedById },
      });
      const loanIds = [...new Set(settled.map((r) => r.loanId))];
      if (loanIds.length > 0) {
        await tx.employeeLoan.updateMany({
          where: {
            organizationId: scope.organizationId,
            id: { in: loanIds },
            status: "ACTIVE",
            repayments: { none: { status: "PENDING", deletedAt: null } },
          },
          data: { status: "CLOSED", updatedBy: finalizedById },
        });
      }

      // Exactly the bonuses the approved run paid (linked from its BONUS
      // earnings) — never one approved after the run was calculated. The
      // period that paid it is recorded on the bonus.
      const paidBonusIds = bonusEarnings
        .map((e) => e.sourceId)
        .filter((bonusId): bonusId is number => bonusId !== null);
      if (paidBonusIds.length > 0) {
        await tx.employeeBonus.updateMany({
          where: {
            organizationId: scope.organizationId,
            id: { in: paidBonusIds },
            status: "APPROVED",
          },
          data: {
            status: "PAID",
            payrollPeriodId: id,
            updatedBy: finalizedById,
          },
        });
      }

      // Arrears are one-time: mark the salary structures whose arrears this
      // run paid (the same structure the calculator picked: the one in force
      // during the period — structures never overlap).
      const arrearsEntries = await tx.payrollEarning.findMany({
        where: {
          organizationId: scope.organizationId,
          payrollEntryId: { in: entryIds },
          code: "ARREARS",
          deletedAt: null,
        },
        select: { payrollEntry: { select: { employeeId: true } } },
      });
      const arrearsEmployeeIds = arrearsEntries.map(
        (e) => e.payrollEntry.employeeId,
      );
      if (arrearsEmployeeIds.length > 0) {
        await tx.employeeSalary.updateMany({
          where: {
            organizationId: scope.organizationId,
            employeeId: { in: arrearsEmployeeIds },
            deletedAt: null,
            arrearsPaidPeriodId: null,
            effectiveFrom: { lte: period.periodEnd },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: period.periodStart } },
            ],
          },
          data: { arrearsPaidPeriodId: id, updatedBy: finalizedById },
        });
      }

      return tx.payrollPeriod.update({
        where: { id },
        data: {
          status: "FINALIZED",
          finalizedAt: now,
          finalizedById,
          updatedBy: finalizedById,
        },
        include: INCLUDE_RUNS,
      });
    });
  }
}
