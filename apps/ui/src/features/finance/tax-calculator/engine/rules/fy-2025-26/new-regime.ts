/**
 * Tax Rules: FY 2025-26 (AY 2026-27) - New Tax Regime (Section 115BAC)
 *
 * Statutory Authority:
 * - The Finance Act, 2025 (Union Budget 2025-26 announced Feb 1, 2025)
 * - Section 115BAC, Income-tax Act, 1961
 */

export interface SlabRule {
  fromAmount: number;
  toAmount: number | null;
  ratePercent: number;
  label: string;
}

export const NEW_REGIME_RULES_2025_26 = {
  financialYear: "2025-26" as const,
  assessmentYear: "2026-27" as const,
  standardDeductionSalaried: 75_000, // Section 16(ia)
  standardDeductionPensioner: 75_000,
  familyPensionDeductionMax: 25_000, // Section 57(iia)

  // Revised progressive slabs under Union Budget 2025
  slabs: [
    {
      fromAmount: 0,
      toAmount: 400_000,
      ratePercent: 0,
      label: "Up to ₹4,00,000",
    },
    {
      fromAmount: 400_000,
      toAmount: 800_000,
      ratePercent: 5,
      label: "₹4,00,001 to ₹8,00,000",
    },
    {
      fromAmount: 800_000,
      toAmount: 1_200_000,
      ratePercent: 10,
      label: "₹8,00,001 to ₹12,00,000",
    },
    {
      fromAmount: 1_200_000,
      toAmount: 1_600_000,
      ratePercent: 15,
      label: "₹12,00,001 to ₹16,00,000",
    },
    {
      fromAmount: 1_600_000,
      toAmount: 2_000_000,
      ratePercent: 20,
      label: "₹16,00,001 to ₹20,00,000",
    },
    {
      fromAmount: 2_000_000,
      toAmount: 2_400_000,
      ratePercent: 25,
      label: "₹20,00,001 to ₹24,00,000",
    },
    {
      fromAmount: 2_400_000,
      toAmount: null,
      ratePercent: 30,
      label: "Above ₹24,00,000",
    },
  ] as SlabRule[],

  // Section 87A Rebate for Resident Individuals
  rebate87A: {
    maxTaxableIncome: 1_200_000, // Full rebate up to ₹12 Lakh
    maxRebateAmount: 60_000, // Full tax on ₹12L (20k + 40k = 60k)
    // Marginal relief break-even point: ₹12,00,000 + 60,000/0.85 = ₹12,70,588
    marginalReliefThreshold: 1_270_588,
  },

  // Surcharge Rates under New Regime (Capped at 25%)
  surchargeTiers: [
    { threshold: 5_000_000, ratePercent: 10, label: "> ₹50 Lakh to ₹1 Crore" },
    { threshold: 10_000_000, ratePercent: 15, label: "> ₹1 Crore to ₹2 Crore" },
    { threshold: 20_000_000, ratePercent: 25, label: "> ₹2 Crore" },
  ],

  cessPercent: 4, // Health & Education Cess
};
