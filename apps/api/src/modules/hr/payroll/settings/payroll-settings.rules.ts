/**
 * Organization payroll rules: the salary auto-split, the pay-days /
 * attendance / overtime policy, the statutory limits and rates (PF with its
 * EPS/EDLI split, ESI, PT, TDS, bonus, gratuity), loan limits and the
 * employer details printed on payslips and statutory files. Pure — no I/O.
 *
 * The numeric defaults that existed before are unchanged (legacy split
 * 35/30/20/remainder; PF wage ceiling ₹15,000 at 12% + 12%; ESI for monthly
 * wages ≤ ₹21,000 at 0.75% + 3.25%). The newer statutory defaults are the
 * Indian statutory values (EPS 8.33% to ₹15,000 until 58, EDLI 0.5%, PF
 * admin 0.5%, bonus 8.33% on ≤ ₹7,000 for wages ≤ ₹21,000, gratuity cap
 * ₹20 lakh after 5 years). PT and TDS are OFF until an organization turns
 * them on and enters its slabs. Docs/PAYROLL_AND_COMPLIANCE.md §3.
 */
export const PAY_DAYS_MODES = [
  "CALENDAR",
  "FIXED_30",
  "FIXED_26",
  "WORKING_DAYS",
] as const;
export type PayDaysMode = (typeof PAY_DAYS_MODES)[number];

export const TAX_REGIMES = ["OLD", "NEW"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export interface PayrollRules {
  basicPercent: number;
  hraPercent: number;
  conveyancePercent: number;
  pfWageCeiling: number;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  esiWageThreshold: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  payDaysMode: PayDaysMode;
  useAttendance: boolean;
  unmarkedDaysAsAbsent: boolean;
  overtimeEnabled: boolean;
  overtimeRatePerHour: number | null;
  overtimeMultiplier: number;
  standardHoursPerDay: number;
  pfCapAtCeiling: boolean;
  epsRate: number;
  epsWageCeiling: number;
  epsAgeLimit: number;
  edliRate: number;
  edliWageCeiling: number;
  pfAdminRate: number;
  ptEnabled: boolean;
  ptDefaultStateCode: string | null;
  tdsEnabled: boolean;
  defaultTaxRegime: TaxRegime;
  bonusEligibilityLimit: number;
  bonusCalculationCeiling: number;
  bonusPercent: number;
  gratuityCap: number;
  gratuityMinYears: number;
  loanMaxMultiple: number;
  loanMaxEmiPercent: number;
  companyName: string | null;
  companyAddress: string | null;
  companyGstin: string | null;
  companyPan: string | null;
  companyTan: string | null;
  pfEstablishmentCode: string | null;
  esiEmployerCode: string | null;
}

export const DEFAULT_PAYROLL_RULES: Readonly<PayrollRules> = Object.freeze({
  basicPercent: 35,
  hraPercent: 30,
  conveyancePercent: 20,
  pfWageCeiling: 15000,
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  esiWageThreshold: 21000,
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  payDaysMode: "CALENDAR",
  useAttendance: true,
  unmarkedDaysAsAbsent: true,
  overtimeEnabled: false,
  overtimeRatePerHour: null,
  overtimeMultiplier: 2,
  standardHoursPerDay: 8,
  pfCapAtCeiling: true,
  epsRate: 8.33,
  epsWageCeiling: 15000,
  epsAgeLimit: 58,
  edliRate: 0.5,
  edliWageCeiling: 15000,
  pfAdminRate: 0.5,
  ptEnabled: false,
  ptDefaultStateCode: null,
  tdsEnabled: false,
  defaultTaxRegime: "NEW",
  bonusEligibilityLimit: 21000,
  bonusCalculationCeiling: 7000,
  bonusPercent: 8.33,
  gratuityCap: 2000000,
  gratuityMinYears: 5,
  loanMaxMultiple: 3,
  loanMaxEmiPercent: 100,
  companyName: null,
  companyAddress: null,
  companyGstin: null,
  companyPan: null,
  companyTan: null,
  pfEstablishmentCode: null,
  esiEmployerCode: null,
});

export const RULE_KEYS = Object.keys(DEFAULT_PAYROLL_RULES) as Array<
  keyof PayrollRules
>;

/** Text settings (employer details and the PT default state). */
export const TEXT_RULE_KEYS = [
  "ptDefaultStateCode",
  "companyName",
  "companyAddress",
  "companyGstin",
  "companyPan",
  "companyTan",
  "pfEstablishmentCode",
  "esiEmployerCode",
] as const satisfies ReadonlyArray<keyof PayrollRules>;

type RuleRow = { [K in keyof PayrollRules]?: unknown };

/**
 * Prisma returns DECIMAL columns as Decimal objects; the rules use plain
 * values. A missing row means the defaults. Each value is converted by the
 * type of its default, so a new setting needs only a default here.
 */
export function toRules(row: RuleRow | null): PayrollRules {
  if (!row) return { ...DEFAULT_PAYROLL_RULES };
  const out = { ...DEFAULT_PAYROLL_RULES } as Record<string, unknown>;
  for (const key of RULE_KEYS) {
    const value = row[key];
    const fallback = DEFAULT_PAYROLL_RULES[key];
    if (value === undefined) continue;
    if (typeof fallback === "boolean") out[key] = Boolean(value);
    else if (typeof fallback === "number") out[key] = Number(value);
    else if (key === "overtimeRatePerHour")
      out[key] = value === null ? null : Number(value);
    else out[key] = value === null ? null : String(value);
  }
  return out as unknown as PayrollRules;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a gross monthly salary into components. Basic, HRA and conveyance
 * are rounded to the paisa; `otherAllowance` takes the remainder so the
 * parts always add up to exactly the gross (legacy called it DA).
 */
export function splitGross(
  grossMonthly: number,
  rules: Pick<
    PayrollRules,
    "basicPercent" | "hraPercent" | "conveyancePercent"
  >,
) {
  const basic = round2((grossMonthly * rules.basicPercent) / 100);
  const hra = round2((grossMonthly * rules.hraPercent) / 100);
  const conveyance = round2((grossMonthly * rules.conveyancePercent) / 100);
  const otherAllowance = round2(grossMonthly - basic - hra - conveyance);
  return { basic, hra, conveyance, otherAllowance };
}
