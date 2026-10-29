/**
 * Tax Rules: FY 2025-26 (AY 2026-27) - Old Tax Regime
 *
 * Statutory Authority:
 * - First Schedule, Finance Act
 * - Income-tax Act, 1961
 */

import { SlabRule } from "./new-regime";
import { AgeCategory } from "../../types";

export const OLD_REGIME_RULES_2025_26 = {
  financialYear: "2025-26" as const,
  assessmentYear: "2026-27" as const,
  standardDeductionSalaried: 50_000, // Section 16(ia)
  standardDeductionPensioner: 50_000,

  // Slabs depend on age category under Old Regime
  getSlabs: (ageCategory: AgeCategory): SlabRule[] => {
    if (ageCategory === "super_senior") {
      // Age 80+ years: First 5 Lakh tax-free
      return [
        {
          fromAmount: 0,
          toAmount: 500_000,
          ratePercent: 0,
          label: "Up to ₹5,00,000",
        },
        {
          fromAmount: 500_000,
          toAmount: 1_000_000,
          ratePercent: 20,
          label: "₹5,00,001 to ₹10,00,000",
        },
        {
          fromAmount: 1_000_000,
          toAmount: null,
          ratePercent: 30,
          label: "Above ₹10,00,000",
        },
      ];
    }

    if (ageCategory === "senior") {
      // Age 60-79 years: First 3 Lakh tax-free
      return [
        {
          fromAmount: 0,
          toAmount: 300_000,
          ratePercent: 0,
          label: "Up to ₹3,00,000",
        },
        {
          fromAmount: 300_000,
          toAmount: 500_000,
          ratePercent: 5,
          label: "₹3,00,001 to ₹5,00,000",
        },
        {
          fromAmount: 500_000,
          toAmount: 1_000_000,
          ratePercent: 20,
          label: "₹5,00,001 to ₹10,00,000",
        },
        {
          fromAmount: 1_000_000,
          toAmount: null,
          ratePercent: 30,
          label: "Above ₹10,00,000",
        },
      ];
    }

    // Regular individuals (< 60 years): First 2.5 Lakh tax-free
    return [
      {
        fromAmount: 0,
        toAmount: 250_000,
        ratePercent: 0,
        label: "Up to ₹2,50,000",
      },
      {
        fromAmount: 250_000,
        toAmount: 500_000,
        ratePercent: 5,
        label: "₹2,50,001 to ₹5,00,000",
      },
      {
        fromAmount: 500_000,
        toAmount: 1_000_000,
        ratePercent: 20,
        label: "₹5,00,001 to ₹10,00,000",
      },
      {
        fromAmount: 1_000_000,
        toAmount: null,
        ratePercent: 30,
        label: "Above ₹10,00,000",
      },
    ];
  },

  // Section 87A Rebate under Old Regime
  rebate87A: {
    maxTaxableIncome: 500_000, // Up to ₹5,00,000
    maxRebateAmount: 12_500, // Full rebate of ₹12,500
  },

  // Surcharge under Old Regime
  surchargeTiers: [
    { threshold: 5_000_000, ratePercent: 10, label: "> ₹50 Lakh to ₹1 Crore" },
    { threshold: 10_000_000, ratePercent: 15, label: "> ₹1 Crore to ₹2 Crore" },
    { threshold: 20_000_000, ratePercent: 25, label: "> ₹2 Crore to ₹5 Crore" },
    { threshold: 50_000_000, ratePercent: 37, label: "> ₹5 Crore" },
  ],

  cessPercent: 4,
};
