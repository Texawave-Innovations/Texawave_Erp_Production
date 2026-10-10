import { Injectable } from "@nestjs/common";
import { inclusiveDays } from "../../../../common/dates/date-only.js";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import {
  bonusesPaidElsewhere,
  installmentClaimableBy,
} from "../shared/payroll-claims.js";

export interface CalculatedEmployeePayroll {
  employeeId: number;
  totalCalendarDays: number;
  requiredWorkingDays: number;
  presentDays: number;
  halfDays: number;
  holidayDays: number;
  leaveDays: number;
  lopDays: number;
  payableDays: number;
  monthlyGross: number;
  perDayRate: number;
  earningRatio: number;
  baseEarnings: number;
  totalGrossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  earnings: Array<{
    code: string;
    name: string;
    baseAmount: number;
    earningRatio: number;
    calculatedAmount: number;
    /** Set when the earning pays out a record ("BONUS" + bonus id). */
    sourceType?: string | undefined;
    sourceId?: number | undefined;
  }>;
  deductions: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType?: string | undefined;
    sourceId?: number | undefined;
  }>;
  pf?:
    | {
        pfIncluded: boolean;
        pfWage: number;
        employeeContribution: number;
        employerContribution: number;
      }
    | undefined;
  esi?:
    | {
        esiIncluded: boolean;
        esiWage: number;
        employeeContribution: number;
        employerContribution: number;
      }
    | undefined;
  loanRepayments: Array<{
    loanId: number;
    repaymentId: number;
    amount: number;
  }>;
  bonusIds: number[];
}

function round(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

@Injectable()
export class PayrollCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateForEmployee(
    organizationId: number,
    payrollPeriodId: number,
    employeeId: number,
  ): Promise<CalculatedEmployeePayroll | null> {
    const period = await this.prisma.payrollPeriod.findFirstOrThrow({
      where: { id: payrollPeriodId, organizationId },
    });

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId,
        deletedAt: null,
      },
      include: {
        pfProfile: true,
        esiProfile: true,
      },
    });

    if (!employee) return null;

    // Check employment window
    if (employee.dateOfJoining > period.periodEnd) {
      return null; // Not joined yet
    }
    if (employee.dateOfExit && employee.dateOfExit < period.periodStart) {
      return null; // Left before period
    }

    // 1. Fetch applicable salary structure
    const salary = await this.prisma.employeeSalary.findFirst({
      where: {
        organizationId,
        employeeId,
        deletedAt: null,
        effectiveFrom: { lte: period.periodEnd },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: period.periodStart } },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!salary) {
      throw new BusinessRuleViolationException(
        `Employee ${employee.employeeCode} has no salary structure configured for period ${period.year}-${period.month}`,
        "SALARY_NOT_CONFIGURED",
      );
    }

    const totalCalendarDays = inclusiveDays(
      period.periodStart,
      period.periodEnd,
    );

    // 2. Fetch holidays in this period
    const holidays = await this.prisma.holiday.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        holidayDate: { gte: period.periodStart, lte: period.periodEnd },
        OR: [
          { workLocationId: null },
          { workLocationId: employee.workLocationId },
        ],
      },
    });
    const holidayDays = holidays.length;

    // 3. Weekly-off rules
    const weeklyOffRules = await this.prisma.weeklyOffRule.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        effectiveFrom: { lte: period.periodEnd },
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: period.periodStart } },
            ],
          },
          {
            OR: [
              { teamId: null, workLocationId: null },
              { teamId: employee.teamId },
              { workLocationId: employee.workLocationId },
            ],
          },
        ],
      },
    });

    // Count weekly off days in period
    let weeklyOffDays = 0;
    const weeklyOffDaysSet = new Set<number>();
    for (const rule of weeklyOffRules) {
      for (const d of rule.daysOfWeek) {
        weeklyOffDaysSet.add(d);
      }
    }

    const cur = new Date(period.periodStart);
    while (cur <= period.periodEnd) {
      const isoWeekday = cur.getUTCDay() === 0 ? 7 : cur.getUTCDay();
      if (weeklyOffDaysSet.has(isoWeekday)) {
        weeklyOffDays++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const requiredWorkingDays = Math.max(
      0,
      totalCalendarDays - (holidayDays + weeklyOffDays),
    );

    // 4. Approved Leaves
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        status: "APPROVED",
        startDate: { lte: period.periodEnd },
        endDate: { gte: period.periodStart },
      },
      include: { leaveType: true },
    });

    let paidLeaveDays = 0;
    let lopDays = 0;

    for (const l of leaves) {
      const start =
        l.startDate < period.periodStart ? period.periodStart : l.startDate;
      const end = l.endDate > period.periodEnd ? period.periodEnd : l.endDate;
      const days = inclusiveDays(start, end);

      const code = l.leaveType.code.toUpperCase();
      if (code === "LOP" || code === "UNPAID" || code.includes("LOSS_OF_PAY")) {
        lopDays += days;
      } else {
        paidLeaveDays += days;
      }
    }

    // Active employment adjustment (if joined mid-month or exited mid-month)
    if (employee.dateOfJoining > period.periodStart) {
      const daysBeforeJoining = inclusiveDays(
        period.periodStart,
        new Date(employee.dateOfJoining.getTime() - 86400000),
      );
      lopDays += Math.max(0, daysBeforeJoining);
    }
    if (employee.dateOfExit && employee.dateOfExit < period.periodEnd) {
      const daysAfterExit = inclusiveDays(
        new Date(employee.dateOfExit.getTime() + 86400000),
        period.periodEnd,
      );
      lopDays += Math.max(0, daysAfterExit);
    }

    // KNOWN GAP (Docs/PAYROLL_AND_COMPLIANCE.md "Not yet modelled"): there is
    // no attendance module, so LOP comes only from approved unpaid leave and
    // the employment window, and `presentDays` is derived, not recorded. An
    // absence without a leave request is NOT deducted until attendance exists.
    const payableDays = Math.max(0, totalCalendarDays - lopDays);
    const presentDays = Math.max(
      0,
      requiredWorkingDays - (paidLeaveDays + lopDays),
    );
    const earningRatio =
      totalCalendarDays > 0 ? round(payableDays / totalCalendarDays, 4) : 0;
    const monthlyGross = Number(salary.grossMonthly);
    const perDayRate =
      totalCalendarDays > 0 ? round(monthlyGross / totalCalendarDays, 2) : 0;

    // 5. Earnings Breakdown
    const earnings: CalculatedEmployeePayroll["earnings"] = [];

    const basicCalc = round(Number(salary.basic) * earningRatio, 2);
    earnings.push({
      code: "BASIC",
      name: "Basic Salary",
      baseAmount: Number(salary.basic),
      earningRatio,
      calculatedAmount: basicCalc,
    });

    const hraCalc = round(Number(salary.hra) * earningRatio, 2);
    earnings.push({
      code: "HRA",
      name: "House Rent Allowance",
      baseAmount: Number(salary.hra),
      earningRatio,
      calculatedAmount: hraCalc,
    });

    if (Number(salary.conveyance) > 0) {
      const convCalc = round(Number(salary.conveyance) * earningRatio, 2);
      earnings.push({
        code: "CONVEYANCE",
        name: "Conveyance Allowance",
        baseAmount: Number(salary.conveyance),
        earningRatio,
        calculatedAmount: convCalc,
      });
    }

    if (Number(salary.otherAllowance) > 0) {
      const otherCalc = round(Number(salary.otherAllowance) * earningRatio, 2);
      earnings.push({
        code: "OTHER_ALLOWANCE",
        name: "Other Allowance",
        baseAmount: Number(salary.otherAllowance),
        earningRatio,
        calculatedAmount: otherCalc,
      });
    }

    if (Number(salary.specialAllowance) > 0) {
      const specCalc = round(Number(salary.specialAllowance) * earningRatio, 2);
      earnings.push({
        code: "SPECIAL_ALLOWANCE",
        name: "Special Allowance",
        baseAmount: Number(salary.specialAllowance),
        earningRatio,
        calculatedAmount: specCalc,
      });
    }

    // Arrears are a one-time payment: paid by the first finalized period
    // after they are set (finalize stamps `arrearsPaidPeriodId`), never as a
    // recurring monthly component.
    if (
      Number(salary.arrearsSalary) > 0 &&
      salary.arrearsPaidPeriodId == null
    ) {
      earnings.push({
        code: "ARREARS",
        name: "Arrears",
        baseAmount: Number(salary.arrearsSalary),
        earningRatio: 1.0,
        calculatedAmount: Number(salary.arrearsSalary),
      });
    }

    // Bonuses approved for this period (or for no particular period) that no
    // live run of another open period is already paying.
    const candidateBonuses = await this.prisma.employeeBonus.findMany({
      where: {
        organizationId,
        employeeId,
        status: "APPROVED",
        deletedAt: null,
        OR: [{ payrollPeriodId }, { payrollPeriodId: null }],
      },
      orderBy: { id: "asc" },
    });
    const paidElsewhere = await bonusesPaidElsewhere(
      this.prisma,
      organizationId,
      payrollPeriodId,
      candidateBonuses.map((b) => b.id),
    );
    const bonuses = candidateBonuses.filter((b) => !paidElsewhere.has(b.id));

    const bonusIds: number[] = [];
    let bonusTotal = 0;
    for (const b of bonuses) {
      bonusIds.push(b.id);
      bonusTotal += Number(b.amount);
      earnings.push({
        code: "BONUS",
        name: `Bonus (${b.bonusType})`,
        baseAmount: Number(b.amount),
        earningRatio: 1.0,
        calculatedAmount: Number(b.amount),
        sourceType: "BONUS",
        sourceId: b.id,
      });
    }

    const totalGrossEarnings = round(
      earnings.reduce((sum, e) => sum + e.calculatedAmount, 0),
      2,
    );
    const baseEarnings = round(basicCalc + hraCalc, 2);

    // 6. Deductions
    const deductions: CalculatedEmployeePayroll["deductions"] = [];
    let pfInfo: CalculatedEmployeePayroll["pf"] | undefined;
    let esiInfo: CalculatedEmployeePayroll["esi"] | undefined;

    // PF Calculation (statutory wage ceiling; see Docs/PAYROLL_AND_COMPLIANCE.md
    // for what is not modelled yet: voluntary PF, EPS/EPF split, DA)
    const pfProfile = employee.pfProfile;
    if (pfProfile?.pfApplicable) {
      const pfWage = Math.min(basicCalc, 15000);
      const empContribution = round(pfWage * 0.12, 2);
      const emrContribution = round(pfWage * 0.12, 2);

      deductions.push({
        code: "PF",
        name: "Provident Fund",
        amount: empContribution,
        sourceType: "PF",
      });

      pfInfo = {
        pfIncluded: true,
        pfWage,
        employeeContribution: empContribution,
        employerContribution: emrContribution,
      };
    }

    // ESI: eligibility on the recurring monthly wage (arrears excluded), and
    // contributions on wages excluding annual/performance bonus, which ESI
    // does not treat as wages.
    const recurringMonthlyWage =
      Number(salary.basic) +
      Number(salary.hra) +
      Number(salary.conveyance) +
      Number(salary.otherAllowance) +
      Number(salary.specialAllowance);
    const esiProfile = employee.esiProfile;
    if (esiProfile?.esiApplicable && recurringMonthlyWage <= 21000) {
      const esiWage = round(totalGrossEarnings - bonusTotal, 2);
      const empContribution = round(esiWage * 0.0075, 2);
      const emrContribution = round(esiWage * 0.0325, 2);

      deductions.push({
        code: "ESI",
        name: "Employee State Insurance",
        amount: empContribution,
        sourceType: "ESI",
      });

      esiInfo = {
        esiIncluded: true,
        esiWage,
        employeeContribution: empContribution,
        employerContribution: emrContribution,
      };
    }

    // Loans: at most ONE scheduled installment per loan per period — the
    // earliest still-PENDING one that has fallen due by the period end. A loan
    // with nothing due yet (before its first due date), or with an approved
    // skip for this period, deducts nothing. Installments are deducted only
    // while net pay stays non-negative; one that does not fit stays PENDING
    // and is recovered in a later period instead of being marked paid. An
    // installment another open period's live run already deducts is skipped,
    // so the next one (if due) is taken instead of the same EMI twice.
    const activeLoans = await this.prisma.employeeLoan.findMany({
      where: {
        organizationId,
        employeeId,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        skipRequests: {
          where: { payrollPeriodId, status: "APPROVED", deletedAt: null },
        },
        repayments: {
          where: {
            status: "PENDING",
            deletedAt: null,
            dueDate: { lte: period.periodEnd },
            ...installmentClaimableBy(payrollPeriodId),
          },
          orderBy: { installmentNo: "asc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    });

    const loanRepayments: CalculatedEmployeePayroll["loanRepayments"] = [];
    let runningNet =
      totalGrossEarnings - deductions.reduce((sum, d) => sum + d.amount, 0);

    for (const loan of activeLoans) {
      if (loan.skipRequests.length > 0) continue;
      const installment = loan.repayments[0];
      if (!installment) continue;

      const emi = Number(installment.amount);
      if (emi > runningNet) continue;
      runningNet -= emi;

      deductions.push({
        code: "LOAN",
        name: `Loan EMI (${loan.loanNumber})`,
        amount: emi,
        sourceType: "LOAN",
        sourceId: loan.id,
      });

      loanRepayments.push({
        loanId: loan.id,
        repaymentId: installment.id,
        amount: emi,
      });
    }

    const totalDeductions = round(
      deductions.reduce((sum, d) => sum + d.amount, 0),
      2,
    );
    const netPayable = round(
      Math.max(0, totalGrossEarnings - totalDeductions),
      2,
    );

    return {
      employeeId,
      totalCalendarDays,
      requiredWorkingDays,
      presentDays,
      halfDays: 0,
      holidayDays,
      leaveDays: paidLeaveDays,
      lopDays,
      payableDays,
      monthlyGross,
      perDayRate,
      earningRatio,
      baseEarnings,
      totalGrossEarnings,
      totalDeductions,
      netPayable,
      earnings,
      deductions,
      pf: pfInfo,
      esi: esiInfo,
      loanRepayments,
      bonusIds,
    };
  }
}
