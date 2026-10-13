import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import {
  bonusesPaidElsewhere,
  installmentClaimableBy,
} from "../shared/payroll-claims.js";
import {
  type PayrollRules,
  toRules,
} from "../settings/payroll-settings.rules.js";
import {
  NO_DECLARATION,
  type DeclaredAmounts,
  monthlyTds,
  type TaxRegimeRules,
} from "../tax/tds.rules.js";
import {
  ageOn,
  type AttendanceCounts,
  attendanceAbsence,
  daysBetween,
  earningRatio,
  esiContributionPeriodStart,
  financialYearOf,
  monthsLeftInFinancialYear,
  overtimePay,
  payDaysDivisor,
  pfBreakup,
  professionalTax,
  round2,
  workingDaysBetween,
} from "./payroll-engine.rules.js";

export interface CalculatedEmployeePayroll {
  employeeId: number;
  totalCalendarDays: number;
  requiredWorkingDays: number;
  presentDays: number;
  halfDays: number;
  holidayDays: number;
  leaveDays: number;
  lopDays: number;
  absentDays: number;
  payableDays: number;
  monthlyGross: number;
  perDayRate: number;
  earningRatio: number;
  baseEarnings: number;
  totalGrossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  overtimeMinutes: number;
  payDaysMode: string;
  payDaysDivisor: number;
  attendanceLockId: number | null;
  taxRegime: string | null;
  taxableEarnings: number;
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
        epsWage: number;
        epsContribution: number;
        epfEmployerContribution: number;
        edliWage: number;
        edliContribution: number;
        adminCharges: number;
        grossWage: number;
        ncpDays: number;
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

/** One line of the salary structure with its component's flags. */
interface SalaryLine {
  code: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  monthlyAmount: number;
  isProrated: boolean;
  isTaxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  displayOrder: number;
}

/**
 * A structure saved before the component master existed has no lines; its
 * legacy columns are read with the system components' default flags (PF on
 * Basic only, as the previous engine did). The migration gives every
 * existing structure lines, so this only covers rows written by old code.
 */
function legacyLines(salary: {
  basic: unknown;
  hra: unknown;
  conveyance: unknown;
  otherAllowance: unknown;
  specialAllowance: unknown;
}): SalaryLine[] {
  const line = (
    code: string,
    name: string,
    amount: unknown,
    order: number,
    pf = false,
  ): SalaryLine => ({
    code,
    name,
    kind: "EARNING",
    monthlyAmount: Number(amount),
    isProrated: true,
    isTaxable: true,
    pfApplicable: pf,
    esiApplicable: true,
    displayOrder: order,
  });
  return [
    line("BASIC", "Basic Salary", salary.basic, 10, true),
    line("HRA", "House Rent Allowance", salary.hra, 30),
    line("CONVEYANCE", "Conveyance Allowance", salary.conveyance, 40),
    line("OTHER_ALLOWANCE", "Other Allowance", salary.otherAllowance, 50),
    line("SPECIAL_ALLOWANCE", "Special Allowance", salary.specialAllowance, 60),
  ].filter(
    (l) => l.monthlyAmount > 0 || l.code === "BASIC" || l.code === "HRA",
  );
}

/** Bonus types that are not taxable salary (gratuity is exempt up to the
 * statutory limit, which is above the engine's gratuity cap). */
const NON_TAXABLE_BONUS_TYPES = new Set(["GRATUITY"]);

/**
 * Calculates one employee's pay for one period — the single payroll engine
 * (Docs/PAYROLL_AND_COMPLIANCE.md §3). It loads the inputs, then every
 * figure comes from the pure rules in `payroll-engine.rules.ts` and
 * `tax/tds.rules.ts`:
 *
 *  1. Salary structure lines (component master — nothing is fixed in code).
 *  2. Days: calendar, working (minus holidays and weekly offs), employed.
 *  3. Loss of pay, deducted ONCE: unpaid leave (`leave_types.is_paid` =
 *     false; half-day leave = 0.5; working days only) + absences from the
 *     APPROVED attendance month (when `use_attendance`).
 *  4. Earnings: prorated lines × earning ratio, fixed lines in full,
 *     arrears once, overtime, approved bonuses.
 *  5. Deductions: PF (with EPS/EDLI split), ESI (contribution-period rule),
 *     Professional Tax, TDS, deduction-type components, then loan EMIs only
 *     while net pay stays non-negative.
 */
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
        personalDetail: { select: { dateOfBirth: true } },
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

    const rules = toRules(
      await this.prisma.payrollSetting.findUnique({
        where: { organizationId },
      }),
    );

    // 1. Applicable salary structure and its lines
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
      include: {
        components: {
          include: { component: true },
        },
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!salary) {
      throw new BusinessRuleViolationException(
        `Employee ${employee.employeeCode} has no salary structure configured for period ${period.year}-${period.month}`,
        "SALARY_NOT_CONFIGURED",
      );
    }

    const lines: SalaryLine[] =
      salary.components && salary.components.length > 0
        ? salary.components
            .map(
              (c) =>
                ({
                  code: c.component.code,
                  name: c.component.name,
                  kind:
                    c.component.kind === "DEDUCTION" ? "DEDUCTION" : "EARNING",
                  monthlyAmount: Number(c.monthlyAmount),
                  isProrated: c.component.isProrated,
                  isTaxable: c.component.isTaxable,
                  pfApplicable: c.component.pfApplicable,
                  esiApplicable: c.component.esiApplicable,
                  displayOrder: c.component.displayOrder,
                }) satisfies SalaryLine,
            )
            .sort((a, b) => a.displayOrder - b.displayOrder)
        : legacyLines(salary);
    const earningLines = lines.filter((l) => l.kind === "EARNING");
    const deductionLines = lines.filter((l) => l.kind === "DEDUCTION");

    const totalCalendarDays = daysBetween(period.periodStart, period.periodEnd);

    // 2. Calendar: holidays and weekly offs in this period
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
    const holidayDates = new Set(
      holidays.map((h) => h.holidayDate.toISOString().slice(0, 10)),
    );
    const holidayDays = holidayDates.size;

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
    const weeklyOff = new Set<number>();
    for (const rule of weeklyOffRules) {
      for (const d of rule.daysOfWeek) weeklyOff.add(d);
    }
    // A holiday on a weekly off is not counted twice.
    const requiredWorkingDays = workingDaysBetween(
      period.periodStart,
      period.periodEnd,
      weeklyOff,
      holidayDates,
    );

    // Employment window inside the period.
    const employedFrom =
      employee.dateOfJoining > period.periodStart
        ? employee.dateOfJoining
        : period.periodStart;
    const employedTo =
      employee.dateOfExit && employee.dateOfExit < period.periodEnd
        ? employee.dateOfExit
        : period.periodEnd;
    const employedDays = daysBetween(employedFrom, employedTo);

    // 3a. Approved leave: paid days vs unpaid (LOP) days, per leave type.
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
    let unpaidLeaveDays = 0;
    let halfDayLeaves = 0;
    for (const l of leaves) {
      const start = l.startDate < employedFrom ? employedFrom : l.startDate;
      const end = l.endDate > employedTo ? employedTo : l.endDate;
      if (end < start) continue;
      const isHalf = l.dayPortion !== "FULL";
      const days = isHalf
        ? 0.5
        : workingDaysBetween(start, end, weeklyOff, holidayDates);
      if (isHalf) halfDayLeaves++;
      if (l.leaveType.isPaid) paidLeaveDays += days;
      else unpaidLeaveDays += days;
    }

    // 3b. Attendance: the employee's APPROVED month (frozen summary).
    let attendanceLockId: number | null = null;
    let absentDays = 0;
    let presentDays = Math.max(
      0,
      requiredWorkingDays - (paidLeaveDays + unpaidLeaveDays),
    );
    let halfDays = 0;
    let overtimeMinutes = 0;
    if (rules.useAttendance) {
      const month = new Date(
        Date.UTC(
          period.periodStart.getUTCFullYear(),
          period.periodStart.getUTCMonth(),
          1,
        ),
      );
      const lock = await this.prisma.attendanceMonthLock.findFirst({
        where: {
          organizationId,
          employeeId,
          month,
          status: "APPROVED",
          deletedAt: null,
        },
        select: { id: true, summary: true },
      });
      if (!lock) {
        throw new BusinessRuleViolationException(
          `Attendance for ${employee.employeeCode} (${employee.fullName}) is not approved for ${period.year}-${String(period.month).padStart(2, "0")}`,
          "ATTENDANCE_NOT_APPROVED",
        );
      }
      const summary = lock.summary as {
        countsByStatus?: Partial<AttendanceCounts>;
        overtimeMinutes?: number;
      };
      const counts: AttendanceCounts = {
        PRESENT: 0,
        ABSENT: 0,
        HALF_DAY: 0,
        HOLIDAY: 0,
        WEEKLY_OFF: 0,
        ON_LEAVE: 0,
        NOT_MARKED: 0,
        ...(summary.countsByStatus ?? {}),
      };
      const absence = attendanceAbsence(
        counts,
        halfDayLeaves,
        rules.unmarkedDaysAsAbsent,
      );
      attendanceLockId = lock.id;
      absentDays = absence.absentDays;
      presentDays = absence.presentDays;
      halfDays = absence.halfDays;
      overtimeMinutes = Math.max(0, Number(summary.overtimeMinutes ?? 0));
    }

    // 3c. Pay days and the earning ratio (loss of pay deducted once).
    const divisor = payDaysDivisor(
      rules.payDaysMode,
      totalCalendarDays,
      requiredWorkingDays,
    );
    const absenceLopDays = round2(unpaidLeaveDays + absentDays);
    const ratio = earningRatio({
      calendarDays: totalCalendarDays,
      employedDays,
      absenceLopDays,
      divisor,
    });
    const payableDays = round2(ratio * divisor);
    const lopDays = round2(Math.max(0, divisor - payableDays));
    const monthlyGross = round2(
      earningLines.reduce((sum, l) => sum + l.monthlyAmount, 0),
    );
    const perDayRate = round2(monthlyGross / divisor);

    // 4. Earnings
    const earnings: CalculatedEmployeePayroll["earnings"] = [];
    let pfWageFull = 0;
    let esiWage = 0;
    let taxable = 0;
    let recurringTaxable = 0;
    for (const l of earningLines) {
      // Zero lines are left off the payslip (Basic and HRA always shown).
      if (l.monthlyAmount <= 0 && l.code !== "BASIC" && l.code !== "HRA") {
        continue;
      }
      const lineRatio = l.isProrated ? ratio : 1;
      const amount = round2(l.monthlyAmount * lineRatio);
      earnings.push({
        code: l.code,
        name: l.name,
        baseAmount: l.monthlyAmount,
        earningRatio: lineRatio,
        calculatedAmount: amount,
      });
      if (l.pfApplicable) pfWageFull += amount;
      if (l.esiApplicable) esiWage += amount;
      if (l.isTaxable) {
        taxable += amount;
        recurringTaxable += l.monthlyAmount;
      }
    }
    const baseEarnings = round2(
      earnings.reduce((sum, e) => sum + e.calculatedAmount, 0),
    );

    // Arrears are a one-time payment: paid by the first finalized period
    // after they are set (finalize stamps `arrearsPaidPeriodId`), never as a
    // recurring monthly component.
    if (
      Number(salary.arrearsSalary) > 0 &&
      salary.arrearsPaidPeriodId == null
    ) {
      const arrears = Number(salary.arrearsSalary);
      earnings.push({
        code: "ARREARS",
        name: "Arrears",
        baseAmount: arrears,
        earningRatio: 1.0,
        calculatedAmount: arrears,
      });
      esiWage += arrears;
      taxable += arrears;
    }

    // Overtime from the approved attendance month.
    if (rules.overtimeEnabled && overtimeMinutes > 0) {
      const ot = overtimePay({
        minutes: overtimeMinutes,
        grossMonthly: monthlyGross,
        divisor,
        standardHoursPerDay: rules.standardHoursPerDay,
        multiplier: rules.overtimeMultiplier,
        fixedRatePerHour: rules.overtimeRatePerHour,
      });
      if (ot.amount > 0) {
        earnings.push({
          code: "OVERTIME",
          name: `Overtime (${ot.hours} h × ${ot.rate})`,
          baseAmount: ot.rate,
          earningRatio: 1.0,
          calculatedAmount: ot.amount,
        });
        esiWage += ot.amount;
        taxable += ot.amount;
      }
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
    for (const b of bonuses) {
      bonusIds.push(b.id);
      earnings.push({
        code: "BONUS",
        name: `Bonus (${b.bonusType})`,
        baseAmount: Number(b.amount),
        earningRatio: 1.0,
        calculatedAmount: Number(b.amount),
        sourceType: "BONUS",
        sourceId: b.id,
      });
      if (!NON_TAXABLE_BONUS_TYPES.has(b.bonusType))
        taxable += Number(b.amount);
    }

    const totalGrossEarnings = round2(
      earnings.reduce((sum, e) => sum + e.calculatedAmount, 0),
    );

    // 5. Deductions
    const deductions: CalculatedEmployeePayroll["deductions"] = [];
    let pfInfo: CalculatedEmployeePayroll["pf"] | undefined;
    let esiInfo: CalculatedEmployeePayroll["esi"] | undefined;

    // PF on the earned PF wage (Basic + DA by default), split for the ECR.
    const pfProfile = employee.pfProfile;
    let currentEmployeePf = 0;
    let recurringEmployeePf = 0;
    if (pfProfile?.pfApplicable) {
      const dob = employee.personalDetail?.dateOfBirth ?? null;
      const epsEligible =
        dob === null || ageOn(dob, period.periodStart) < rules.epsAgeLimit;
      const pf = pfBreakup(round2(pfWageFull), rules, epsEligible);
      deductions.push({
        code: "PF",
        name: "Provident Fund",
        amount: pf.employeeContribution,
        sourceType: "PF",
      });
      currentEmployeePf = pf.employeeContribution;
      const recurringPfWage = earningLines
        .filter((l) => l.pfApplicable)
        .reduce((sum, l) => sum + l.monthlyAmount, 0);
      recurringEmployeePf = pfBreakup(
        recurringPfWage,
        rules,
        epsEligible,
      ).employeeContribution;
      pfInfo = {
        pfIncluded: true,
        ...pf,
        grossWage: totalGrossEarnings,
        ncpDays: lopDays,
      };
    }

    // ESI: eligibility on the recurring monthly wage of ESI-applicable lines,
    // or continued coverage within the contribution period; contributions on
    // the earned ESI wage (bonuses excluded — ESI does not treat them as wages).
    const recurringEsiWage = earningLines
      .filter((l) => l.esiApplicable)
      .reduce((sum, l) => sum + l.monthlyAmount, 0);
    const esiProfile = employee.esiProfile;
    if (esiProfile?.esiApplicable) {
      let covered = recurringEsiWage <= rules.esiWageThreshold;
      if (!covered) {
        const periodStart = esiContributionPeriodStart(period.periodStart);
        covered =
          (await this.prisma.esiContribution.count({
            where: {
              organizationId,
              employeeId,
              esiIncluded: true,
              deletedAt: null,
              payrollPeriod: {
                periodStart: { gte: periodStart, lt: period.periodStart },
                status: "FINALIZED",
              },
            },
          })) > 0;
      }
      if (covered) {
        const wage = round2(esiWage);
        const empContribution = round2((wage * rules.esiEmployeeRate) / 100);
        const emrContribution = round2((wage * rules.esiEmployerRate) / 100);
        deductions.push({
          code: "ESI",
          name: "Employee State Insurance",
          amount: empContribution,
          sourceType: "ESI",
        });
        esiInfo = {
          esiIncluded: true,
          esiWage: wage,
          employeeContribution: empContribution,
          employerContribution: emrContribution,
        };
      }
    }

    // Professional Tax under the state of the employee's work location.
    if (rules.ptEnabled) {
      const pt = await this.professionalTaxFor(
        organizationId,
        employee.workLocationId,
        rules,
        period,
        totalGrossEarnings,
      );
      if (pt > 0) {
        deductions.push({
          code: "PT",
          name: "Professional Tax",
          amount: pt,
          sourceType: "PT",
        });
      }
    }

    // TDS by projection over the financial year.
    let taxRegime: string | null = null;
    if (rules.tdsEnabled) {
      const tds = await this.tdsFor(
        organizationId,
        employeeId,
        employee.employeeCode,
        rules,
        period,
        {
          currentTaxable: round2(taxable),
          recurringTaxable: round2(recurringTaxable),
          currentEmployeePf,
          recurringEmployeePf,
        },
      );
      taxRegime = tds.regime;
      if (tds.amount > 0) {
        deductions.push({
          code: "TDS",
          name: "Income Tax (TDS)",
          amount: tds.amount,
          sourceType: "TDS",
        });
      }
    }

    // Deduction-type components of the structure.
    for (const l of deductionLines) {
      const amount = round2(l.monthlyAmount * (l.isProrated ? ratio : 1));
      if (amount <= 0) continue;
      deductions.push({ code: l.code, name: l.name, amount });
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

    const totalDeductions = round2(
      deductions.reduce((sum, d) => sum + d.amount, 0),
    );
    const netPayable = round2(
      Math.max(0, totalGrossEarnings - totalDeductions),
    );

    return {
      employeeId,
      totalCalendarDays,
      requiredWorkingDays,
      presentDays,
      halfDays,
      holidayDays,
      leaveDays: paidLeaveDays,
      lopDays,
      absentDays,
      payableDays,
      monthlyGross,
      perDayRate,
      earningRatio: ratio,
      baseEarnings,
      totalGrossEarnings,
      totalDeductions,
      netPayable,
      overtimeMinutes,
      payDaysMode: rules.payDaysMode,
      payDaysDivisor: divisor,
      attendanceLockId,
      taxRegime,
      taxableEarnings: round2(taxable),
      earnings,
      deductions,
      pf: pfInfo,
      esi: esiInfo,
      loanRepayments,
      bonusIds,
    };
  }

  private async professionalTaxFor(
    organizationId: number,
    workLocationId: number | null,
    rules: PayrollRules,
    period: { month: number; periodStart: Date; periodEnd: Date },
    grossEarnings: number,
  ): Promise<number> {
    const mapped = workLocationId
      ? await this.prisma.ptLocationState.findFirst({
          where: { organizationId, workLocationId },
          select: { stateCode: true },
        })
      : null;
    const stateCode = mapped?.stateCode ?? rules.ptDefaultStateCode;
    if (!stateCode) return 0;
    const slabs = await this.prisma.professionalTaxSlab.findMany({
      where: {
        organizationId,
        stateCode,
        isActive: true,
        deletedAt: null,
        effectiveFrom: { lte: period.periodEnd },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: period.periodStart } },
        ],
      },
      orderBy: { minMonthlyWage: "asc" },
    });
    return professionalTax(
      slabs.map((s) => ({
        minMonthlyWage: Number(s.minMonthlyWage),
        maxMonthlyWage:
          s.maxMonthlyWage === null ? null : Number(s.maxMonthlyWage),
        monthlyAmount: Number(s.monthlyAmount),
        specialMonth: s.specialMonth,
        specialAmount:
          s.specialAmount === null ? null : Number(s.specialAmount),
        applicableMonths: s.applicableMonths ?? [],
      })),
      period.month,
      grossEarnings,
    );
  }

  private async tdsFor(
    organizationId: number,
    employeeId: number,
    employeeCode: string,
    rules: PayrollRules,
    period: { id: number; year: number; month: number; periodStart: Date },
    current: {
      currentTaxable: number;
      recurringTaxable: number;
      currentEmployeePf: number;
      recurringEmployeePf: number;
    },
  ): Promise<{ regime: "OLD" | "NEW"; amount: number }> {
    const financialYear = financialYearOf(period.year, period.month);
    const declaration = await this.prisma.employeeTaxDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } },
    });
    const regime = (declaration?.regime ?? rules.defaultTaxRegime) as
      "OLD" | "NEW";

    const regimeRow = await this.prisma.incomeTaxRegime.findUnique({
      where: {
        organizationId_financialYear_regime: {
          organizationId,
          financialYear,
          regime,
        },
      },
      include: { slabs: true },
    });
    if (!regimeRow || regimeRow.slabs.length === 0) {
      throw new BusinessRuleViolationException(
        `TDS is on but no ${regime} regime tax slabs exist for financial year ${financialYear} (needed for ${employeeCode})`,
        "TAX_REGIME_NOT_CONFIGURED",
      );
    }
    const regimeRules: TaxRegimeRules = {
      regime,
      standardDeduction: Number(regimeRow.standardDeduction),
      rebateIncomeLimit: Number(regimeRow.rebateIncomeLimit),
      rebateMaxAmount: Number(regimeRow.rebateMaxAmount),
      cessPercent: Number(regimeRow.cessPercent),
      section80cLimit: Number(regimeRow.section80cLimit),
      homeLoanInterestLimit: Number(regimeRow.homeLoanInterestLimit),
      slabs: regimeRow.slabs.map((s) => ({
        fromIncome: Number(s.fromIncome),
        toIncome: s.toIncome === null ? null : Number(s.toIncome),
        ratePercent: Number(s.ratePercent),
      })),
    };

    // What finalized periods of this financial year already paid / deducted.
    const fyStartYear = Number(financialYear.slice(0, 4));
    const ytdEntries = await this.prisma.payrollEntry.findMany({
      where: {
        organizationId,
        employeeId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        payrollRun: {
          status: "APPROVED",
          payrollPeriod: {
            status: "FINALIZED",
            id: { not: period.id },
            periodStart: {
              gte: new Date(Date.UTC(fyStartYear, 3, 1)),
              lt: period.periodStart,
            },
          },
        },
      },
      select: {
        taxableEarnings: true,
        deductions: {
          where: { code: { in: ["TDS", "PF"] }, deletedAt: null },
          select: { code: true, amount: true },
        },
      },
    });
    let ytdTaxable = 0;
    let ytdTds = 0;
    let ytdEmployeePf = 0;
    for (const e of ytdEntries) {
      ytdTaxable += Number(e.taxableEarnings);
      for (const d of e.deductions) {
        if (d.code === "TDS") ytdTds += Number(d.amount);
        else ytdEmployeePf += Number(d.amount);
      }
    }

    const result = monthlyTds({
      rules: regimeRules,
      declared: acceptedAmounts(declaration),
      ytdTaxable,
      ytdTds,
      ytdEmployeePf,
      ...current,
      monthsLeft: monthsLeftInFinancialYear(period.month),
    });
    return { regime, amount: result.monthlyTds };
  }
}

/**
 * The amounts TDS may use from a declaration: the verified ones once HR has
 * verified it, the declared ones while it awaits verification, none from a
 * draft or a rejected one (Docs/PAYROLL_AND_COMPLIANCE.md §3.9).
 */
export function acceptedAmounts(
  d: {
    status: string;
    section80c: unknown;
    section80d: unknown;
    hraExemption: unknown;
    homeLoanInterest: unknown;
    otherDeductions: unknown;
    otherIncome: unknown;
    previousEmployerIncome: unknown;
    previousEmployerTds: unknown;
    verifiedSection80c: unknown;
    verifiedSection80d: unknown;
    verifiedHraExemption: unknown;
    verifiedHomeLoanInterest: unknown;
    verifiedOtherDeductions: unknown;
  } | null,
): DeclaredAmounts {
  if (!d || (d.status !== "SUBMITTED" && d.status !== "VERIFIED")) {
    return { ...NO_DECLARATION };
  }
  const verified = d.status === "VERIFIED";
  const pick = (declared: unknown, accepted: unknown) =>
    Number(
      verified && accepted !== null && accepted !== undefined
        ? accepted
        : declared,
    );
  return {
    section80c: pick(d.section80c, d.verifiedSection80c),
    section80d: pick(d.section80d, d.verifiedSection80d),
    hraExemption: pick(d.hraExemption, d.verifiedHraExemption),
    homeLoanInterest: pick(d.homeLoanInterest, d.verifiedHomeLoanInterest),
    otherDeductions: pick(d.otherDeductions, d.verifiedOtherDeductions),
    otherIncome: Number(d.otherIncome),
    previousEmployerIncome: Number(d.previousEmployerIncome),
    previousEmployerTds: Number(d.previousEmployerTds),
  };
}
