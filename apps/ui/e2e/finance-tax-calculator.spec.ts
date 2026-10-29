import { test, expect } from "@playwright/test";
import {
  calculateNewRegimeTax,
  calculateOldRegimeTax,
  compareRegimes,
} from "../src/features/finance/tax-calculator/engine/taxEngine";
import { calculateHRAExemption } from "../src/features/finance/tax-calculator/engine/rules/fy-2025-26/deductions";
import {
  TaxpayerProfile,
  IncomeInputs as IncomeInputsType,
  DeductionsInputs,
} from "../src/features/finance/tax-calculator/engine/types";

const defaultProfile: TaxpayerProfile = {
  financialYear: "2025-26",
  ageCategory: "regular",
  residentialStatus: "resident",
  employmentType: "salaried",
  tdsPaid: 0,
};

const defaultIncome: IncomeInputsType = {
  grossSalary: 0,
  basicSalary: 0,
  hraReceived: 0,
  rentPaidAnnual: 0,
  cityType: "metro",
  rentalIncome: 0,
  savingsInterest: 0,
  fixedDepositInterest: 0,
  otherIncome: 0,
};

const defaultDeductions: DeductionsInputs = {
  section80C: 0,
  section80D_Self: 0,
  isSelfSenior: false,
  section80D_Parents: 0,
  isParentsSenior: false,
  section80CCD1B: 0,
  section80CCD2: 0,
  section24b: 0,
  section80G: 0,
  section80E: 0,
};

test.describe("Income Tax Calculator - Section 115BAC New Regime", () => {
  test("computes 0 tax for 0 income", () => {
    const result = calculateNewRegimeTax(
      defaultProfile,
      defaultIncome,
      defaultDeductions,
    );
    expect(result.taxableIncome).toBe(0);
    expect(result.totalTaxLiability).toBe(0);
    expect(result.effectiveTaxRate).toBe(0);
  });

  test("applies standard deduction of ₹75,000 for salaried employees", () => {
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_000_000,
    };
    const result = calculateNewRegimeTax(
      defaultProfile,
      income,
      defaultDeductions,
    );
    expect(result.standardDeduction).toBe(75_000);
    expect(result.taxableIncome).toBe(925_000);
  });

  test("does not apply standard deduction for self-employed individuals", () => {
    const profile: TaxpayerProfile = {
      ...defaultProfile,
      employmentType: "self_employed",
    };
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_000_000,
    };
    const result = calculateNewRegimeTax(profile, income, defaultDeductions);
    expect(result.standardDeduction).toBe(0);
    expect(result.taxableIncome).toBe(1_000_000);
  });

  test("provides 100% Section 87A rebate when taxable income is <= ₹12,00,000", () => {
    // Gross salary 12,75,000 - 75,000 SD = 12,00,000 taxable income
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_275_000,
    };
    const result = calculateNewRegimeTax(
      defaultProfile,
      income,
      defaultDeductions,
    );
    expect(result.taxableIncome).toBe(1_200_000);
    expect(result.slabTaxBeforeRebate).toBe(60_000); // 0-4L: 0, 4-8L: 20k, 8-12L: 40k = 60k
    expect(result.section87ARebate).toBe(60_000);
    expect(result.totalTaxLiability).toBe(0);
  });

  test("provides Section 87A marginal relief for income just above ₹12,00,000", () => {
    // Taxable income = ₹12,20,000 (Gross = 12,95,000 - 75k)
    // Slab tax on 12.20L = 60,000 + 15% on 20,000 = 60,000 + 3,000 = 63,000
    // Excess income over ₹12,00,000 = ₹20,000
    // Marginal relief ensures tax cannot exceed ₹20,000
    // Relief = 63,000 - 20,000 = 43,000. Net tax = 20,000 + 4% cess (800) = 20,800.
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_295_000,
    };
    const result = calculateNewRegimeTax(
      defaultProfile,
      income,
      defaultDeductions,
    );
    expect(result.taxableIncome).toBe(1_220_000);
    expect(result.slabTaxBeforeRebate).toBe(63_000);
    expect(result.marginalRelief87A).toBe(43_000);
    expect(result.taxAfterRebate).toBe(20_000);
    expect(result.healthAndEducationCess).toBe(800);
    expect(result.totalTaxLiability).toBe(20_800);
  });

  test("correctly computes tax for high income bracket (> ₹24,00,000)", () => {
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 3_075_000,
    };
    const result = calculateNewRegimeTax(
      defaultProfile,
      income,
      defaultDeductions,
    );
    expect(result.taxableIncome).toBe(3_000_000);
    expect(result.slabTaxBeforeRebate).toBe(480_000);
    expect(result.healthAndEducationCess).toBe(19_200);
    expect(result.totalTaxLiability).toBe(499_200);
  });
});

test.describe("Income Tax Calculator - Old Regime & Deductions", () => {
  test("applies standard deduction of ₹50,000 under Old Regime", () => {
    const income: IncomeInputsType = { ...defaultIncome, grossSalary: 800_000 };
    const result = calculateOldRegimeTax(
      defaultProfile,
      income,
      defaultDeductions,
    );
    expect(result.standardDeduction).toBe(50_000);
    expect(result.taxableIncome).toBe(750_000);
  });

  test("correctly caps Section 80C deduction at ₹1,50,000", () => {
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_000_000,
    };
    const deductions: DeductionsInputs = {
      ...defaultDeductions,
      section80C: 250_000,
    };
    const result = calculateOldRegimeTax(defaultProfile, income, deductions);
    expect(result.eligibleDeductions80C).toBe(150_000);
  });

  test("calculates Section 80D health insurance limits correctly for non-senior vs senior", () => {
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_000_000,
    };
    const deductions: DeductionsInputs = {
      ...defaultDeductions,
      section80D_Self: 35_000,
      isSelfSenior: false,
      section80D_Parents: 60_000,
      isParentsSenior: true,
    };
    const result = calculateOldRegimeTax(defaultProfile, income, deductions);
    expect(result.eligibleDeductions80D).toBe(75_000);
  });

  test("calculates HRA exemption correctly u/s 10(13A)", () => {
    const hraExemption = calculateHRAExemption(
      600_000,
      240_000,
      300_000,
      "metro",
    );
    expect(hraExemption.exemptAmount).toBe(240_000);
    expect(hraExemption.taxableHRA).toBe(0);
  });

  test("applies higher exemption slabs for senior citizens under Old Regime", () => {
    const profileSenior: TaxpayerProfile = {
      ...defaultProfile,
      ageCategory: "senior",
    };
    const income: IncomeInputsType = { ...defaultIncome, grossSalary: 350_000 };
    const result = calculateOldRegimeTax(
      profileSenior,
      income,
      defaultDeductions,
    );
    expect(result.totalTaxLiability).toBe(0);
  });
});

test.describe("Income Tax Calculator - Regime Comparison", () => {
  test("compares regimes and identifies the lower tax regime", () => {
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_200_000,
      basicSalary: 600_000,
      hraReceived: 200_000,
      rentPaidAnnual: 240_000,
    };
    const deductions: DeductionsInputs = {
      ...defaultDeductions,
      section80C: 150_000,
      section80D_Self: 25_000,
    };
    const comparison = compareRegimes(defaultProfile, income, deductions);
    expect(comparison.newRegime).toBeDefined();
    expect(comparison.oldRegime).toBeDefined();
    expect(comparison.taxDifference).toBeGreaterThanOrEqual(0);
    expect(["new", "old", "equal"]).toContain(comparison.lowerTaxRegime);
  });

  test("handles FY 2026-27 without error", () => {
    const profile2026: TaxpayerProfile = {
      ...defaultProfile,
      financialYear: "2026-27",
    };
    const income: IncomeInputsType = {
      ...defaultIncome,
      grossSalary: 1_500_000,
    };
    const comparison = compareRegimes(profile2026, income, defaultDeductions);
    expect(comparison.financialYear).toBe("2026-27");
    expect(comparison.newRegime.totalTaxLiability).toBeGreaterThan(0);
  });
});
