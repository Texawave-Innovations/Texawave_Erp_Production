/**
 * TexaOne Income Tax Calculator - Pure Calculation Engine
 *
 * Strict Architectural Guarantees:
 * - Pure and deterministic: Accepts structured input, returns structured output.
 * - Completely independent of React, DOM, Tailwind, and animation libraries.
 * - Zero external dependencies.
 * - Accurate implementation of Section 115BAC, 87A (with marginal relief),
 *   Chapter VI-A, Surcharge marginal relief, and 4% Health & Education Cess.
 */

import {
  TaxpayerProfile,
  IncomeInputs,
  DeductionsInputs,
  RegimeTaxResult,
  ComparisonResult,
  SlabCalculation,
} from "./types";
import { getRulesForFinancialYear } from "./rules";
import { SlabRule } from "./rules/fy-2025-26/new-regime";
import { calculateHRAExemption } from "./rules/fy-2025-26/deductions";

type SurchargeTier = { threshold: number; ratePercent: number };

/**
 * Computes progressive slab tax and returns slab-by-slab breakdown.
 */
export function calculateSlabTax(
  taxableIncome: number,
  slabs: SlabRule[],
): {
  totalTax: number;
  breakdown: SlabCalculation[];
} {
  let totalTax = 0;
  const breakdown: SlabCalculation[] = [];
  const income = Math.max(0, Math.round(taxableIncome));

  for (const slab of slabs) {
    const { fromAmount, toAmount, ratePercent, label } = slab;

    if (income <= fromAmount) {
      // Income hasn't reached this slab
      breakdown.push({
        slabRange: label,
        fromAmount,
        toAmount,
        ratePercent,
        taxableAmountInSlab: 0,
        taxGenerated: 0,
      });
      continue;
    }

    let taxableInThisSlab = 0;
    if (toAmount === null) {
      // Top slab with no upper limit
      taxableInThisSlab = income - fromAmount;
    } else {
      const slabCeiling = Math.min(income, toAmount);
      taxableInThisSlab = Math.max(0, slabCeiling - fromAmount);
    }

    const taxForSlab = Math.round((taxableInThisSlab * ratePercent) / 100);
    totalTax += taxForSlab;

    breakdown.push({
      slabRange: label,
      fromAmount,
      toAmount,
      ratePercent,
      taxableAmountInSlab: taxableInThisSlab,
      taxGenerated: taxForSlab,
    });
  }

  return { totalTax, breakdown };
}

/**
 * Calculates Section 87A Rebate and Marginal Relief
 */
export function calculateRebate87A(
  taxableIncome: number,
  slabTax: number,
  isResident: boolean,
  isNewRegime: boolean,
  fyRules: ReturnType<typeof getRulesForFinancialYear>,
): {
  rebateAmount: number;
  marginalRelief: number;
  netTaxAfterRebate: number;
} {
  // Section 87A applies exclusively to Resident Individuals
  if (!isResident || taxableIncome <= 0 || slabTax <= 0) {
    return { rebateAmount: 0, marginalRelief: 0, netTaxAfterRebate: slabTax };
  }

  if (isNewRegime) {
    const { maxTaxableIncome, maxRebateAmount, marginalReliefThreshold } =
      fyRules.newRegime.rebate87A;

    // Case 1: Taxable income up to ₹12,00,000 -> 100% Tax Rebate (up to ₹60,000)
    if (taxableIncome <= maxTaxableIncome) {
      const rebate = Math.min(slabTax, maxRebateAmount);
      return {
        rebateAmount: rebate,
        marginalRelief: 0,
        netTaxAfterRebate: Math.max(0, slabTax - rebate),
      };
    }

    // Case 2: Marginal Relief when income slightly exceeds ₹12,00,000
    // Tax liability cannot exceed (Taxable Income - ₹12,00,000)
    if (
      taxableIncome > maxTaxableIncome &&
      taxableIncome <= marginalReliefThreshold
    ) {
      const excessIncome = taxableIncome - maxTaxableIncome;
      if (slabTax > excessIncome) {
        const relief = slabTax - excessIncome;
        return {
          rebateAmount: 0,
          marginalRelief: relief,
          netTaxAfterRebate: excessIncome,
        };
      }
    }

    // Case 3: Above marginal relief threshold -> Full slab tax applies
    return { rebateAmount: 0, marginalRelief: 0, netTaxAfterRebate: slabTax };
  } else {
    // Old Regime Rebate
    const { maxTaxableIncome, maxRebateAmount } = fyRules.oldRegime.rebate87A;
    if (taxableIncome <= maxTaxableIncome) {
      const rebate = Math.min(slabTax, maxRebateAmount);
      return {
        rebateAmount: rebate,
        marginalRelief: 0,
        netTaxAfterRebate: Math.max(0, slabTax - rebate),
      };
    }

    return { rebateAmount: 0, marginalRelief: 0, netTaxAfterRebate: slabTax };
  }
}

/**
 * Calculates Surcharge and Surcharge Marginal Relief
 */
export function calculateSurcharge(
  taxableIncome: number,
  taxAfterRebate: number,
  surchargeTiers: SurchargeTier[],
  calculateBaseTaxAtThreshold: (threshold: number) => number,
): {
  surchargePercent: number;
  surchargeAmount: number;
  marginalRelief: number;
  finalSurcharge: number;
} {
  if (taxAfterRebate <= 0 || taxableIncome <= 5_000_000) {
    return {
      surchargePercent: 0,
      surchargeAmount: 0,
      marginalRelief: 0,
      finalSurcharge: 0,
    };
  }

  // Find applicable tier (reverse iterate from highest threshold)
  let applicableTier: SurchargeTier = { threshold: 0, ratePercent: 0 };
  for (let i = surchargeTiers.length - 1; i >= 0; i--) {
    const tier = surchargeTiers[i];
    if (tier && taxableIncome > tier.threshold) {
      applicableTier = tier;
      break;
    }
  }

  if (applicableTier.ratePercent === 0) {
    return {
      surchargePercent: 0,
      surchargeAmount: 0,
      marginalRelief: 0,
      finalSurcharge: 0,
    };
  }

  const rawSurcharge = Math.round(
    (taxAfterRebate * applicableTier.ratePercent) / 100,
  );
  const totalWithSurcharge = taxAfterRebate + rawSurcharge;

  // Surcharge Marginal Relief:
  // Tax + Surcharge cannot exceed: [Tax on threshold] + [Taxable Income - Threshold]
  const threshold = applicableTier.threshold;
  const taxAtThreshold = calculateBaseTaxAtThreshold(threshold);
  const excessIncome = taxableIncome - threshold;
  const maxAllowableTotal = taxAtThreshold + excessIncome;

  if (totalWithSurcharge > maxAllowableTotal) {
    const relief = totalWithSurcharge - maxAllowableTotal;
    const finalSurcharge = Math.max(0, rawSurcharge - relief);
    return {
      surchargePercent: applicableTier.ratePercent,
      surchargeAmount: rawSurcharge,
      marginalRelief: relief,
      finalSurcharge,
    };
  }

  return {
    surchargePercent: applicableTier.ratePercent,
    surchargeAmount: rawSurcharge,
    marginalRelief: 0,
    finalSurcharge: rawSurcharge,
  };
}

/**
 * Shared tail of both regime calculations: slab tax -> 87A rebate -> surcharge
 * -> cess -> TDS position. Returns the fields common to every RegimeTaxResult.
 */
function computeTaxLiability(
  profile: TaxpayerProfile,
  taxableIncome: number,
  grossTotalIncome: number,
  slabs: SlabRule[],
  isNewRegime: boolean,
  surchargeTiers: SurchargeTier[],
  cessPercent: number,
  rules: ReturnType<typeof getRulesForFinancialYear>,
) {
  const { totalTax: slabTaxBeforeRebate, breakdown: slabBreakdown } =
    calculateSlabTax(taxableIncome, slabs);

  const isResident = profile.residentialStatus === "resident";
  const { rebateAmount, marginalRelief, netTaxAfterRebate } =
    calculateRebate87A(
      taxableIncome,
      slabTaxBeforeRebate,
      isResident,
      isNewRegime,
      rules,
    );

  const {
    surchargePercent,
    surchargeAmount,
    marginalRelief: surchargeRelief,
    finalSurcharge,
  } = calculateSurcharge(
    taxableIncome,
    netTaxAfterRebate,
    surchargeTiers,
    (threshold) => calculateSlabTax(threshold, slabs).totalTax,
  );

  const taxBeforeCess = netTaxAfterRebate + finalSurcharge;
  const healthAndEducationCess = Math.round(
    (taxBeforeCess * cessPercent) / 100,
  );
  const totalTaxLiability = taxBeforeCess + healthAndEducationCess;

  const effectiveTaxRate =
    grossTotalIncome > 0 ? (totalTaxLiability / grossTotalIncome) * 100 : 0;
  const tdsPaid = profile.tdsPaid || 0;

  return {
    taxableIncome,
    slabTaxBeforeRebate,
    slabBreakdown,
    section87ARebate: rebateAmount,
    marginalRelief87A: marginalRelief,
    taxAfterRebate: netTaxAfterRebate,
    surchargePercent,
    surchargeAmount,
    surchargeMarginalRelief: surchargeRelief,
    taxBeforeCess,
    healthAndEducationCess,
    totalTaxLiability,
    effectiveTaxRate,
    tdsPaid,
    balanceTaxPayable: Math.max(0, totalTaxLiability - tdsPaid),
    refundDue: Math.max(0, tdsPaid - totalTaxLiability),
  };
}

/**
 * Pure calculation under NEW TAX REGIME (Section 115BAC)
 */
export function calculateNewRegimeTax(
  profile: TaxpayerProfile,
  income: IncomeInputs,
  deductions: DeductionsInputs,
): RegimeTaxResult {
  const rules = getRulesForFinancialYear(profile.financialYear);
  const newRules = rules.newRegime;

  // 1. Gross Salary and Standard Deduction
  const isSalaried =
    profile.employmentType === "salaried" ||
    profile.employmentType === "pensioner";
  const standardDeduction = isSalaried ? newRules.standardDeductionSalaried : 0;
  const netSalaryIncome = Math.max(0, income.grossSalary - standardDeduction);

  // 2. House Property & Other Sources
  // Under New Regime, loss from self-occupied house property (Section 24b) cannot be set off against salary
  const incomeFromHouseProperty = Math.max(0, income.rentalIncome);
  const incomeFromOtherSources =
    (income.savingsInterest || 0) +
    (income.fixedDepositInterest || 0) +
    (income.otherIncome || 0);

  const grossTotalIncome =
    netSalaryIncome + incomeFromHouseProperty + incomeFromOtherSources;

  // 3. Deductions allowed under New Regime:
  // Section 80CCD(2) - Employer NPS contribution (up to 14% of Basic)
  const maxEmployerNPS =
    (rules.deductions.section80CCD2.maxPercentageOfSalary / 100) *
    (income.basicSalary || 0);
  const eligibleDeductions80CCD2 = Math.min(
    deductions.section80CCD2 || 0,
    maxEmployerNPS,
  );

  const totalEligibleDeductions = eligibleDeductions80CCD2;
  const taxableIncome = Math.max(
    0,
    Math.round(grossTotalIncome - totalEligibleDeductions),
  );

  // 4-8. Slab tax, 87A rebate, surcharge, cess, TDS
  const liability = computeTaxLiability(
    profile,
    taxableIncome,
    grossTotalIncome,
    newRules.slabs,
    true,
    newRules.surchargeTiers,
    newRules.cessPercent,
    rules,
  );

  return {
    regime: "new",
    grossIncome: income.grossSalary,
    hraExemption: 0,
    standardDeduction,
    professionalTax: 0,
    totalExemptions: standardDeduction,
    netSalaryIncome,
    incomeFromHouseProperty,
    incomeFromOtherSources,
    grossTotalIncome,
    eligibleDeductions80C: 0,
    eligibleDeductions80D: 0,
    eligibleDeductions80CCD1B: 0,
    eligibleDeductions80CCD2,
    eligibleDeductions80TTA_TTB: 0,
    otherEligibleDeductions: 0,
    totalEligibleDeductions,
    ...liability,
  };
}

/**
 * Pure calculation under OLD TAX REGIME (With all Chapter VI-A deductions & exemptions)
 */
export function calculateOldRegimeTax(
  profile: TaxpayerProfile,
  income: IncomeInputs,
  deductions: DeductionsInputs,
): RegimeTaxResult {
  const rules = getRulesForFinancialYear(profile.financialYear);
  const oldRules = rules.oldRegime;
  const deductionRules = rules.deductions;

  // 1. HRA Exemption u/s 10(13A)
  const isSalaried =
    profile.employmentType === "salaried" ||
    profile.employmentType === "pensioner";
  const { exemptAmount: hraExemption } = isSalaried
    ? calculateHRAExemption(
        income.basicSalary || 0,
        income.hraReceived || 0,
        income.rentPaidAnnual || 0,
        income.cityType,
      )
    : { exemptAmount: 0 };

  // 2. Standard Deduction
  const standardDeduction = isSalaried ? oldRules.standardDeductionSalaried : 0;
  const totalSalaryExemptions = hraExemption + standardDeduction;
  const netSalaryIncome = Math.max(
    0,
    income.grossSalary - totalSalaryExemptions,
  );

  // 3. House Property Income:
  // Loss on self-occupied property interest u/s 24(b) capped at ₹2,00,000 loss
  const homeLoanInterestLoss = Math.min(
    deductions.section24b || 0,
    deductionRules.section24b.selfOccupiedMaxLoss,
  );
  const netHousePropertyIncome =
    (income.rentalIncome || 0) - homeLoanInterestLoss;
  // Loss set-off against other heads capped u/s 71(3A)
  const incomeFromHouseProperty = Math.max(
    -deductionRules.section24b.selfOccupiedMaxLoss,
    netHousePropertyIncome,
  );

  // 4. Other Sources
  const incomeFromOtherSources =
    (income.savingsInterest || 0) +
    (income.fixedDepositInterest || 0) +
    (income.otherIncome || 0);

  const grossTotalIncome = Math.max(
    0,
    netSalaryIncome + incomeFromHouseProperty + incomeFromOtherSources,
  );

  // 5. Chapter VI-A Deductions
  // Section 80C
  const eligibleDeductions80C = Math.min(
    deductions.section80C || 0,
    deductionRules.section80C.maxLimit,
  );

  // Section 80D
  const maxSelf80D = deductions.isSelfSenior
    ? deductionRules.section80D.selfSeniorMax
    : deductionRules.section80D.selfNonSeniorMax;
  const eligibleSelf80D = Math.min(deductions.section80D_Self || 0, maxSelf80D);

  const maxParents80D = deductions.isParentsSenior
    ? deductionRules.section80D.parentsSeniorMax
    : deductionRules.section80D.parentsNonSeniorMax;
  const eligibleParents80D = Math.min(
    deductions.section80D_Parents || 0,
    maxParents80D,
  );

  const eligibleDeductions80D = eligibleSelf80D + eligibleParents80D;

  // Section 80CCD(1B) - NPS self contribution up to ₹50,000
  const eligibleDeductions80CCD1B = Math.min(
    deductions.section80CCD1B || 0,
    deductionRules.section80CCD1B.maxLimit,
  );

  // Section 80CCD(2) - Employer NPS contribution up to 14% of Basic
  const maxEmployerNPS =
    (deductionRules.section80CCD2.maxPercentageOfSalary / 100) *
    (income.basicSalary || 0);
  const eligibleDeductions80CCD2 = Math.min(
    deductions.section80CCD2 || 0,
    maxEmployerNPS,
  );

  // Section 80TTA / 80TTB
  let eligibleDeductions80TTA_TTB = 0;
  if (
    profile.ageCategory === "senior" ||
    profile.ageCategory === "super_senior"
  ) {
    // 80TTB for seniors: savings + FD interest up to ₹50,000
    const totalDepositInterest =
      (income.savingsInterest || 0) + (income.fixedDepositInterest || 0);
    eligibleDeductions80TTA_TTB = Math.min(
      totalDepositInterest,
      deductionRules.section80TTB.maxLimit,
    );
  } else {
    // 80TTA for non-seniors: savings interest up to ₹10,000
    eligibleDeductions80TTA_TTB = Math.min(
      income.savingsInterest || 0,
      deductionRules.section80TTA.maxLimit,
    );
  }

  // Other eligible deductions (80G, 80E)
  const otherEligibleDeductions =
    (deductions.section80G || 0) + (deductions.section80E || 0);

  const totalEligibleDeductions = Math.min(
    grossTotalIncome,
    eligibleDeductions80C +
      eligibleDeductions80D +
      eligibleDeductions80CCD1B +
      eligibleDeductions80CCD2 +
      eligibleDeductions80TTA_TTB +
      otherEligibleDeductions,
  );

  const taxableIncome = Math.max(
    0,
    Math.round(grossTotalIncome - totalEligibleDeductions),
  );

  // 6-10. Slab tax (age-based), 87A rebate, surcharge, cess, TDS
  const liability = computeTaxLiability(
    profile,
    taxableIncome,
    grossTotalIncome,
    oldRules.getSlabs(profile.ageCategory),
    false,
    oldRules.surchargeTiers,
    oldRules.cessPercent,
    rules,
  );

  return {
    regime: "old",
    grossIncome: income.grossSalary,
    hraExemption,
    standardDeduction,
    professionalTax: 0,
    totalExemptions: totalSalaryExemptions,
    netSalaryIncome,
    incomeFromHouseProperty,
    incomeFromOtherSources,
    grossTotalIncome,
    eligibleDeductions80C,
    eligibleDeductions80D,
    eligibleDeductions80CCD1B,
    eligibleDeductions80CCD2,
    eligibleDeductions80TTA_TTB,
    otherEligibleDeductions,
    totalEligibleDeductions,
    ...liability,
  };
}

/**
 * Compares both Old and New Tax Regimes simultaneously.
 */
export function compareRegimes(
  profile: TaxpayerProfile,
  income: IncomeInputs,
  deductions: DeductionsInputs,
): ComparisonResult {
  const oldResult = calculateOldRegimeTax(profile, income, deductions);
  const newResult = calculateNewRegimeTax(profile, income, deductions);

  const taxDifference = Math.abs(
    oldResult.totalTaxLiability - newResult.totalTaxLiability,
  );

  let lowerTaxRegime: "new" | "old" | "equal" = "equal";
  if (newResult.totalTaxLiability < oldResult.totalTaxLiability) {
    lowerTaxRegime = "new";
  } else if (oldResult.totalTaxLiability < newResult.totalTaxLiability) {
    lowerTaxRegime = "old";
  }

  return {
    financialYear: profile.financialYear,
    oldRegime: oldResult,
    newRegime: newResult,
    taxDifference,
    lowerTaxRegime,
  };
}
