/**
 * Tax Deductions & Exemptions: FY 2025-26 (AY 2026-27)
 *
 * Statutory Authority:
 * - Chapter VI-A, Income-tax Act, 1961
 * - Rule 2A, Income-tax Rules, 1962 (HRA Exemption)
 */

import { CityClassification } from "../../types";

export const DEDUCTION_RULES_2025_26 = {
  section80C: {
    maxLimit: 150_000,
    sectionsIncluded: ["80C", "80CCC", "80CCD(1)"],
    description:
      "EPF, PPF, ELSS, Life Insurance, Home Loan Principal, Tuition fees",
  },

  section80D: {
    selfNonSeniorMax: 25_000,
    selfSeniorMax: 50_000,
    parentsNonSeniorMax: 25_000,
    parentsSeniorMax: 50_000,
    preventiveCheckupMax: 5_000, // within the overall limit
    maxPossibleAggregate: 100_000, // if both self and parents are senior citizens
  },

  section80CCD1B: {
    maxLimit: 50_000,
    description:
      "Additional self-contribution to National Pension System (NPS)",
  },

  section80CCD2: {
    maxPercentageOfSalary: 14, // 14% of Basic + DA allowed in both Old & New regimes
    description: "Employer contribution to NPS",
  },

  section24b: {
    selfOccupiedMaxLoss: 200_000, // Max set-off loss against salary income u/s 71(3A)
    description: "Interest on housing loan for self-occupied property",
  },

  section80TTA: {
    maxLimit: 10_000,
    eligibleCategory: "regular", // Individuals under 60 years
    description: "Interest on savings bank accounts",
  },

  section80TTB: {
    maxLimit: 50_000,
    eligibleCategory: "senior_and_above", // Resident individuals aged 60+
    description: "Interest on all deposits (savings + FD) for senior citizens",
  },
};

/**
 * Pure calculation of House Rent Allowance (HRA) Exemption u/s 10(13A) read with Rule 2A
 */
export function calculateHRAExemption(
  basicSalary: number,
  hraReceived: number,
  rentPaidAnnual: number,
  cityType: CityClassification,
): {
  exemptAmount: number;
  taxableHRA: number;
  details: {
    actualReceived: number;
    excessRentOverTenPercent: number;
    salaryPercentageLimit: number;
    percentageUsed: number;
  };
} {
  if (basicSalary <= 0 || hraReceived <= 0 || rentPaidAnnual <= 0) {
    return {
      exemptAmount: 0,
      taxableHRA: Math.max(0, hraReceived),
      details: {
        actualReceived: hraReceived,
        excessRentOverTenPercent: 0,
        salaryPercentageLimit: 0,
        percentageUsed: cityType === "metro" ? 50 : 40,
      },
    };
  }

  // 1. Actual HRA received
  const actualReceived = hraReceived;

  // 2. Rent paid minus 10% of basic salary
  const excessRent = Math.max(0, rentPaidAnnual - 0.1 * basicSalary);

  // 3. 50% of basic for metro, 40% for non-metro
  const percentage = cityType === "metro" ? 50 : 40;
  const salaryPercentLimit = (percentage / 100) * basicSalary;

  // Least of the three
  const exemptAmount = Math.min(actualReceived, excessRent, salaryPercentLimit);
  const taxableHRA = Math.max(0, hraReceived - exemptAmount);

  return {
    exemptAmount,
    taxableHRA,
    details: {
      actualReceived,
      excessRentOverTenPercent: excessRent,
      salaryPercentageLimit: salaryPercentLimit,
      percentageUsed: percentage,
    },
  };
}
