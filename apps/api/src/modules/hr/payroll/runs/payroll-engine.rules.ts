/**
 * The payroll engine's arithmetic, as pure functions (no I/O, no clock), so
 * every rule is unit-testable on its own. `PayrollCalculatorService` loads the
 * inputs and calls these. Docs/PAYROLL_AND_COMPLIANCE.md §3.
 */
import type { PayDaysMode } from "../settings/payroll-settings.rules.js";

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundRupee(value: number): number {
  return Math.round(value + Number.EPSILON);
}

const DAY_MS = 86_400_000;

/** ISO weekday 1 (Mon) … 7 (Sun) of a UTC date. */
export function isoWeekday(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Days from `from` to `to`, inclusive (0 when `to` < `from`). */
export function daysBetween(from: Date, to: Date): number {
  if (to < from) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/**
 * Working days in [from, to]: not a weekly-off weekday and not a holiday.
 * Used for unpaid leave, so a weekend inside an unpaid leave is not loss of
 * pay (no "sandwich" rule — Docs/PAYROLL_AND_COMPLIANCE.md §3.2).
 */
export function workingDaysBetween(
  from: Date,
  to: Date,
  weeklyOff: ReadonlySet<number>,
  holidays: ReadonlySet<string>,
): number {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (!weeklyOff.has(isoWeekday(cur)) && !holidays.has(isoDate(cur))) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** The per-day divisor of the pay-days policy (never below 1). */
export function payDaysDivisor(
  mode: PayDaysMode,
  calendarDays: number,
  workingDays: number,
): number {
  switch (mode) {
    case "FIXED_30":
      return 30;
    case "FIXED_26":
      return 26;
    case "WORKING_DAYS":
      return Math.max(1, workingDays);
    case "CALENDAR":
    default:
      return Math.max(1, calendarDays);
  }
}

/**
 * The share of the month's salary earned.
 *
 *   ratio = employedDays / calendarDays − absenceLopDays / divisor
 *
 * Joining or leaving mid-month prorates by calendar days in every mode; each
 * loss-of-pay day (unpaid leave, absence) then costs exactly one per-day
 * rate (gross ÷ divisor) — deducted ONCE. With CALENDAR this is the previous
 * engine's (calendar − lop) / calendar. Never below 0 or above 1.
 */
export function earningRatio(input: {
  calendarDays: number;
  employedDays: number;
  absenceLopDays: number;
  divisor: number;
}): number {
  if (input.calendarDays <= 0) return 0;
  const employed = input.employedDays / input.calendarDays;
  const ratio = employed - input.absenceLopDays / input.divisor;
  return Math.min(1, Math.max(0, Math.round(ratio * 10_000) / 10_000));
}

/** Counts frozen in an APPROVED attendance month lock (`summary`). */
export interface AttendanceCounts {
  PRESENT: number;
  ABSENT: number;
  HALF_DAY: number;
  HOLIDAY: number;
  WEEKLY_OFF: number;
  ON_LEAVE: number;
  NOT_MARKED: number;
}

/**
 * Absence days from an approved attendance month. A HALF_DAY is half
 * worked; its other half is either a half-day leave (settled by the leave
 * itself — paid, or LOP through the unpaid-leave count) or absence. Leave
 * days show as ON_LEAVE, never ABSENT, so nothing is counted twice.
 */
export function attendanceAbsence(
  counts: AttendanceCounts,
  halfDayLeaves: number,
  unmarkedAsAbsent: boolean,
): { absentDays: number; presentDays: number; halfDays: number } {
  const halfAbsent = Math.max(0, counts.HALF_DAY - halfDayLeaves) * 0.5;
  const absentDays =
    counts.ABSENT + (unmarkedAsAbsent ? counts.NOT_MARKED : 0) + halfAbsent;
  return {
    absentDays: round2(absentDays),
    presentDays: counts.PRESENT,
    halfDays: counts.HALF_DAY,
  };
}

/**
 * Overtime pay: approved minutes × hourly rate. The rate is the fixed
 * per-hour amount when set, else the hourly wage (gross ÷ divisor ÷
 * standard hours) × the multiplier.
 */
export function overtimePay(input: {
  minutes: number;
  grossMonthly: number;
  divisor: number;
  standardHoursPerDay: number;
  multiplier: number;
  fixedRatePerHour: number | null;
}): { hours: number; rate: number; amount: number } {
  const hours = Math.max(0, input.minutes) / 60;
  const rate =
    input.fixedRatePerHour ??
    round2(
      (input.grossMonthly / input.divisor / input.standardHoursPerDay) *
        input.multiplier,
    );
  return {
    hours: round2(hours),
    rate,
    amount: round2(hours * rate),
  };
}

export interface PfRules {
  pfWageCeiling: number;
  pfCapAtCeiling: boolean;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  epsRate: number;
  epsWageCeiling: number;
  edliRate: number;
  edliWageCeiling: number;
  pfAdminRate: number;
}

export interface PfBreakup {
  pfWage: number;
  employeeContribution: number;
  employerContribution: number;
  epsWage: number;
  epsContribution: number;
  epfEmployerContribution: number;
  edliWage: number;
  edliContribution: number;
  adminCharges: number;
}

/**
 * PF on the earned PF wage (components flagged PF-applicable: Basic + DA by
 * default). The employer's share is split into EPS (pension, on the wage up
 * to the EPS ceiling, none from the EPS age limit) and the EPF difference;
 * EDLI and admin charges are employer costs. Amounts as the previous engine
 * rounded them (paisa); the ECR file rounds to rupees.
 */
export function pfBreakup(
  fullPfWage: number,
  rules: PfRules,
  epsEligible: boolean,
): PfBreakup {
  const pfWage = rules.pfCapAtCeiling
    ? Math.min(fullPfWage, rules.pfWageCeiling)
    : fullPfWage;
  const employeeContribution = round2((pfWage * rules.pfEmployeeRate) / 100);
  const employerContribution = round2((pfWage * rules.pfEmployerRate) / 100);
  const epsWage = epsEligible ? Math.min(fullPfWage, rules.epsWageCeiling) : 0;
  const epsContribution = Math.min(
    employerContribution,
    round2((epsWage * rules.epsRate) / 100),
  );
  const edliWage = Math.min(fullPfWage, rules.edliWageCeiling);
  return {
    pfWage: round2(pfWage),
    employeeContribution,
    employerContribution,
    epsWage: round2(epsWage),
    epsContribution,
    epfEmployerContribution: round2(employerContribution - epsContribution),
    edliWage: round2(edliWage),
    edliContribution: round2((edliWage * rules.edliRate) / 100),
    adminCharges: round2((pfWage * rules.pfAdminRate) / 100),
  };
}

/** Whole years between two dates (age on `on`). */
export function ageOn(dateOfBirth: Date, on: Date): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

/**
 * First day of the ESI contribution period containing `date`: periods run
 * April–September and October–March. An employee covered at any point in a
 * contribution period stays covered until it ends, even if the wage rises
 * above the threshold meanwhile.
 */
export function esiContributionPeriodStart(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  if (m >= 4 && m <= 9) return new Date(Date.UTC(y, 3, 1));
  if (m >= 10) return new Date(Date.UTC(y, 9, 1));
  return new Date(Date.UTC(y - 1, 9, 1));
}

export interface PtSlab {
  minMonthlyWage: number;
  maxMonthlyWage: number | null;
  monthlyAmount: number;
  specialMonth: number | null;
  specialAmount: number | null;
  applicableMonths: number[];
}

/** Professional Tax for the month's gross earnings under a state's slabs
 * (0 when no slab matches or the slab does not apply this month). */
export function professionalTax(
  slabs: readonly PtSlab[],
  month: number,
  grossEarnings: number,
): number {
  const slab = slabs.find(
    (s) =>
      grossEarnings >= s.minMonthlyWage &&
      (s.maxMonthlyWage === null || grossEarnings <= s.maxMonthlyWage),
  );
  if (!slab) return 0;
  if (
    slab.applicableMonths.length > 0 &&
    !slab.applicableMonths.includes(month)
  ) {
    return 0;
  }
  if (slab.specialMonth === month && slab.specialAmount !== null) {
    return slab.specialAmount;
  }
  return slab.monthlyAmount;
}

/** "2026-27" for any month from April 2026 to March 2027. */
export function financialYearOf(year: number, month: number): string {
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** First calendar year/month of a financial year ("2026-27" → 2026, 4). */
export function financialYearStart(fy: string): {
  year: number;
  month: number;
} {
  return { year: Number(fy.slice(0, 4)), month: 4 };
}

/** Months of the financial year AFTER this one (March → 0, April → 11). */
export function monthsLeftInFinancialYear(month: number): number {
  return month >= 4 ? 15 - month : 3 - month;
}
