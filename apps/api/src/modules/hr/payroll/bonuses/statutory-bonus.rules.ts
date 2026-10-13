/**
 * Statutory bonus (Payment of Bonus Act) and gratuity (Payment of Gratuity
 * Act) as pure functions. Limits and rates come from payroll settings.
 * Docs/PAYROLL_AND_COMPLIANCE.md §3.10.
 */

export interface BonusMonth {
  /** Basic + DA actually earned that month (prorated for loss of pay). */
  basicDaEarned: number;
  payableDays: number;
}

export interface StatutoryBonusRules {
  bonusEligibilityLimit: number;
  bonusCalculationCeiling: number;
  bonusPercent: number;
}

export interface StatutoryBonusResult {
  eligible: boolean;
  reason: string | null;
  workedDays: number;
  bonusWages: number;
  amount: number;
}

/** Minimum days worked in the year to qualify. */
export const BONUS_MIN_WORKED_DAYS = 30;

/**
 * Eligible when the monthly Basic + DA is within the eligibility limit and
 * the employee worked at least 30 days in the year. The bonus is
 * `bonusPercent`% of the year's bonus wages; each month's wage is the
 * Basic + DA earned, capped at the calculation ceiling. Rounded to the rupee.
 */
export function statutoryBonus(
  monthlyBasicDa: number,
  months: readonly BonusMonth[],
  rules: StatutoryBonusRules,
): StatutoryBonusResult {
  const workedDays =
    Math.round(months.reduce((s, m) => s + m.payableDays, 0) * 100) / 100;
  if (monthlyBasicDa > rules.bonusEligibilityLimit) {
    return {
      eligible: false,
      reason: `Basic + DA ${monthlyBasicDa} is above the eligibility limit ${rules.bonusEligibilityLimit}`,
      workedDays,
      bonusWages: 0,
      amount: 0,
    };
  }
  if (workedDays < BONUS_MIN_WORKED_DAYS) {
    return {
      eligible: false,
      reason: `Worked ${workedDays} days, fewer than ${BONUS_MIN_WORKED_DAYS}`,
      workedDays,
      bonusWages: 0,
      amount: 0,
    };
  }
  const bonusWages =
    Math.round(
      months.reduce(
        (s, m) => s + Math.min(m.basicDaEarned, rules.bonusCalculationCeiling),
        0,
      ) * 100,
    ) / 100;
  return {
    eligible: true,
    reason: null,
    workedDays,
    bonusWages,
    amount: Math.round((bonusWages * rules.bonusPercent) / 100),
  };
}

export interface GratuityResult {
  eligible: boolean;
  reason: string | null;
  completedYears: number;
  /** Completed years, plus one when the part year exceeds six months. */
  countedYears: number;
  lastDrawnWage: number;
  amount: number;
}

const DAY_MS = 86_400_000;

function anniversary(joined: Date, years: number): Date {
  return new Date(
    Date.UTC(
      joined.getUTCFullYear() + years,
      joined.getUTCMonth(),
      joined.getUTCDate(),
    ),
  );
}

/**
 * 15 days' wages (Basic + DA ÷ 26 × 15) per counted year of service, capped.
 * Eligible after `minYears` completed years; a part year of more than six
 * months (182 days) counts as a full year. Rounded to the rupee.
 */
export function gratuity(input: {
  dateOfJoining: Date;
  asOf: Date;
  monthlyBasicDa: number;
  minYears: number;
  cap: number;
}): GratuityResult {
  let completedYears =
    input.asOf.getUTCFullYear() - input.dateOfJoining.getUTCFullYear();
  if (anniversary(input.dateOfJoining, completedYears) > input.asOf) {
    completedYears--;
  }
  completedYears = Math.max(0, completedYears);
  const partDays = Math.round(
    (input.asOf.getTime() -
      anniversary(input.dateOfJoining, completedYears).getTime()) /
      DAY_MS,
  );
  const countedYears = completedYears + (partDays > 182 ? 1 : 0);
  const base = {
    completedYears,
    countedYears,
    lastDrawnWage: input.monthlyBasicDa,
  };
  if (completedYears < input.minYears) {
    return {
      ...base,
      eligible: false,
      reason: `${completedYears} completed year(s) of service; gratuity needs ${input.minYears}`,
      amount: 0,
    };
  }
  return {
    ...base,
    eligible: true,
    reason: null,
    amount: Math.min(
      Math.round((input.monthlyBasicDa * 15 * countedYears) / 26),
      input.cap,
    ),
  };
}
