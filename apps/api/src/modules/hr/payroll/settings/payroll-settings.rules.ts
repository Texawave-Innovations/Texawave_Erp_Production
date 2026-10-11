/**
 * Organization payroll rules: the salary auto-split and the PF/ESI limits.
 * Pure — no I/O. The defaults are exactly the values that were hard-coded
 * before settings existed (legacy EmployeeForm split 35/30/20/remainder;
 * PF wage ceiling ₹15,000 at 12% + 12%; ESI for monthly wages ≤ ₹21,000 at
 * 0.75% + 3.25%), so an organization without a settings row is paid exactly
 * as before. Docs/PAYROLL_AND_COMPLIANCE.md.
 */
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
});

/** Prisma returns DECIMAL columns as Decimal objects; the rules use numbers. */
export function toRules(
  row: { [K in keyof PayrollRules]: { toString(): string } | number } | null,
): PayrollRules {
  if (!row) return { ...DEFAULT_PAYROLL_RULES };
  const out = {} as PayrollRules;
  for (const key of Object.keys(DEFAULT_PAYROLL_RULES) as Array<
    keyof PayrollRules
  >) {
    out[key] = Number(row[key]);
  }
  return out;
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
