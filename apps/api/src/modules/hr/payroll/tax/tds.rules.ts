/**
 * Income tax deducted at source on salary (section 192), as pure functions.
 * The law itself (slabs, standard deduction, rebate, cess, old-regime caps)
 * is data the organization enters per financial year — nothing here encodes
 * a Finance Act. Docs/PAYROLL_AND_COMPLIANCE.md §3.9.
 *
 * Method (projection, the usual payroll practice): project the year's
 * taxable salary from what was already paid plus the current recurring
 * salary for the months left, compute the year's tax, subtract the TDS
 * already deducted, and spread the rest evenly over the months left
 * including this one. Not modelled: surcharge, marginal relief on the
 * rebate, perquisites, and section-10 exemptions other than the HRA
 * exemption the employee declares.
 */
import { round2, roundRupee } from "../runs/payroll-engine.rules.js";

export interface TaxSlab {
  fromIncome: number;
  toIncome: number | null;
  ratePercent: number;
}

export interface TaxRegimeRules {
  regime: "OLD" | "NEW";
  standardDeduction: number;
  rebateIncomeLimit: number;
  rebateMaxAmount: number;
  cessPercent: number;
  section80cLimit: number;
  homeLoanInterestLimit: number;
  slabs: TaxSlab[];
}

/** The accepted amounts of a declaration (zeros when there is none). */
export interface DeclaredAmounts {
  section80c: number;
  section80d: number;
  hraExemption: number;
  homeLoanInterest: number;
  otherDeductions: number;
  otherIncome: number;
  previousEmployerIncome: number;
  previousEmployerTds: number;
}

export const NO_DECLARATION: Readonly<DeclaredAmounts> = Object.freeze({
  section80c: 0,
  section80d: 0,
  hraExemption: 0,
  homeLoanInterest: 0,
  otherDeductions: 0,
  otherIncome: 0,
  previousEmployerIncome: 0,
  previousEmployerTds: 0,
});

/** Tax on `income` under progressive slabs (before rebate and cess). */
export function slabTax(income: number, slabs: readonly TaxSlab[]): number {
  let tax = 0;
  for (const s of [...slabs].sort((a, b) => a.fromIncome - b.fromIncome)) {
    if (income <= s.fromIncome) continue;
    const top = s.toIncome === null ? income : Math.min(income, s.toIncome);
    tax += ((top - s.fromIncome) * s.ratePercent) / 100;
  }
  return round2(tax);
}

/**
 * Deductions from gross total income. The new regime allows only the
 * standard deduction; the old one adds 80C (with the employee's PF, capped),
 * 80D, the HRA exemption, home-loan interest (capped) and other deductions.
 */
export function allowedDeductions(
  rules: TaxRegimeRules,
  declared: DeclaredAmounts,
  employeePfForYear: number,
): number {
  if (rules.regime === "NEW") return rules.standardDeduction;
  return (
    rules.standardDeduction +
    Math.min(declared.section80c + employeePfForYear, rules.section80cLimit) +
    declared.section80d +
    declared.hraExemption +
    Math.min(declared.homeLoanInterest, rules.homeLoanInterestLimit) +
    declared.otherDeductions
  );
}

/** Tax for the year on `taxableIncome`: slabs, then the 87A rebate, then
 * cess; rounded to the rupee (section 288B). */
export function annualTax(
  taxableIncome: number,
  rules: TaxRegimeRules,
): number {
  let tax = slabTax(taxableIncome, rules.slabs);
  if (taxableIncome <= rules.rebateIncomeLimit) {
    tax -= Math.min(tax, rules.rebateMaxAmount);
  }
  const cess = (tax * rules.cessPercent) / 100;
  return roundRupee(tax + cess);
}

export interface TdsInput {
  rules: TaxRegimeRules;
  declared: DeclaredAmounts;
  /** Taxable salary already paid this financial year (finalized periods). */
  ytdTaxable: number;
  /** TDS already deducted this financial year (finalized periods). */
  ytdTds: number;
  /** Employee PF already deducted this financial year. */
  ytdEmployeePf: number;
  /** This month's taxable earnings and employee PF. */
  currentTaxable: number;
  currentEmployeePf: number;
  /** The recurring monthly taxable salary and PF, for the months left. */
  recurringTaxable: number;
  recurringEmployeePf: number;
  /** Months of the year after this one. */
  monthsLeft: number;
}

export interface TdsResult {
  projectedGross: number;
  deductions: number;
  taxableIncome: number;
  annualTax: number;
  monthlyTds: number;
}

export function monthlyTds(input: TdsInput): TdsResult {
  const projectedGross = round2(
    input.ytdTaxable +
      input.currentTaxable +
      input.recurringTaxable * input.monthsLeft +
      input.declared.otherIncome +
      input.declared.previousEmployerIncome,
  );
  const pfForYear =
    input.ytdEmployeePf +
    input.currentEmployeePf +
    input.recurringEmployeePf * input.monthsLeft;
  const deductions = round2(
    allowedDeductions(input.rules, input.declared, pfForYear),
  );
  const taxableIncome = Math.max(0, round2(projectedGross - deductions));
  const tax = annualTax(taxableIncome, input.rules);
  const remaining = tax - input.ytdTds - input.declared.previousEmployerTds;
  const monthly =
    remaining > 0 ? roundRupee(remaining / (input.monthsLeft + 1)) : 0;
  return {
    projectedGross,
    deductions,
    taxableIncome,
    annualTax: tax,
    monthlyTds: monthly,
  };
}
