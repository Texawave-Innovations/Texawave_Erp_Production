// Salary helpers shared by the offer and revision forms. Legacy splits one
// monthly amount into four components; the percentages below are legacy's.

export type SalaryBasis = "monthly" | "annual";

export const SALARY_SPLIT = {
  basic: 0.35,
  da: 0.15,
  hra: 0.3,
  ca: 0.2,
} as const;

export interface SalaryComponentValues {
  basic: string;
  da: string;
  hra: string;
  ca: string;
}

export function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Splits an amount in the given basis into the four monthly components. */
export function splitAmount(
  amount: string,
  basis: SalaryBasis,
): SalaryComponentValues {
  const n = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(n) || n < 0) {
    return { basic: "", da: "", hra: "", ca: "" };
  }
  const monthly = basis === "annual" ? n / 12 : n;
  return {
    basic: round2(monthly * SALARY_SPLIT.basic),
    da: round2(monthly * SALARY_SPLIT.da),
    hra: round2(monthly * SALARY_SPLIT.hra),
    ca: round2(monthly * SALARY_SPLIT.ca),
  };
}

/** Converts a typed amount between monthly and annual, for the basis toggle. */
export function convertAmount(amount: string, to: SalaryBasis): string {
  const n = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(n)) return "";
  return round2(to === "annual" ? n * 12 : n / 12);
}

/** Sum of the four monthly components, empty fields counting as zero. */
export function monthlyTotal(c: SalaryComponentValues): number {
  return (
    (Number(c.basic) || 0) +
    (Number(c.da) || 0) +
    (Number(c.hra) || 0) +
    (Number(c.ca) || 0)
  );
}

/** Includes `key` only when the value is set, so the backend default applies otherwise. */
export function withDefined<K extends string>(
  key: K,
  value: number | undefined,
): Partial<Record<K, number>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, number>);
}
