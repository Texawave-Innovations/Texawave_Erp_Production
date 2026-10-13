import { describe, expect, it } from "vitest";
import {
  allowedDeductions,
  annualTax,
  monthlyTds,
  NO_DECLARATION,
  slabTax,
  type TaxRegimeRules,
} from "./tds.rules.js";

/** Illustrative slabs (entered by HR in real use; not encoded in the app). */
const NEW: TaxRegimeRules = {
  regime: "NEW",
  standardDeduction: 75000,
  rebateIncomeLimit: 1200000,
  rebateMaxAmount: 60000,
  cessPercent: 4,
  section80cLimit: 150000,
  homeLoanInterestLimit: 200000,
  slabs: [
    { fromIncome: 0, toIncome: 400000, ratePercent: 0 },
    { fromIncome: 400000, toIncome: 800000, ratePercent: 5 },
    { fromIncome: 800000, toIncome: 1200000, ratePercent: 10 },
    { fromIncome: 1200000, toIncome: null, ratePercent: 30 },
  ],
};
const OLD: TaxRegimeRules = {
  ...NEW,
  regime: "OLD",
  standardDeduction: 50000,
  rebateIncomeLimit: 500000,
  rebateMaxAmount: 12500,
  slabs: [
    { fromIncome: 0, toIncome: 250000, ratePercent: 0 },
    { fromIncome: 250000, toIncome: 500000, ratePercent: 5 },
    { fromIncome: 500000, toIncome: 1000000, ratePercent: 20 },
    { fromIncome: 1000000, toIncome: null, ratePercent: 30 },
  ],
};

describe("TDS rules", () => {
  it("taxes each slab only on the income inside it", () => {
    expect(slabTax(1000000, NEW.slabs)).toBe(40000); // 20000 + 20000
    expect(slabTax(300000, NEW.slabs)).toBe(0);
  });

  it("gives the rebate up to the limit, then adds cess, rounded to the rupee", () => {
    expect(annualTax(1100000, NEW)).toBe(0);
    expect(annualTax(1300000, NEW)).toBe(Math.round((60000 + 30000) * 1.04));
  });

  it("allows only the standard deduction in the new regime", () => {
    const declared = {
      ...NO_DECLARATION,
      section80c: 150000,
      hraExemption: 90000,
    };
    expect(allowedDeductions(NEW, declared, 21600)).toBe(75000);
  });

  it("caps 80C (including employee PF) and home-loan interest in the old regime", () => {
    const declared = {
      ...NO_DECLARATION,
      section80c: 140000,
      section80d: 25000,
      homeLoanInterest: 250000,
    };
    // 50000 + min(140000 + 21600, 150000) + 25000 + min(250000, 200000)
    expect(allowedDeductions(OLD, declared, 21600)).toBe(425000);
  });

  it("spreads the year's remaining tax over the months left including this one", () => {
    const r = monthlyTds({
      rules: OLD,
      declared: NO_DECLARATION,
      ytdTaxable: 0,
      ytdTds: 0,
      ytdEmployeePf: 0,
      currentTaxable: 100000,
      currentEmployeePf: 0,
      recurringTaxable: 100000,
      recurringEmployeePf: 0,
      monthsLeft: 11,
    });
    // 1200000 − 50000 = 1150000 → 12500 + 100000 + 45000 = 157500 + 4% = 163800
    expect(r.annualTax).toBe(163800);
    expect(r.monthlyTds).toBe(13650);
  });

  it("deducts nothing once TDS already covers the year", () => {
    const r = monthlyTds({
      rules: OLD,
      declared: { ...NO_DECLARATION, previousEmployerTds: 200000 },
      ytdTaxable: 0,
      ytdTds: 0,
      ytdEmployeePf: 0,
      currentTaxable: 100000,
      currentEmployeePf: 0,
      recurringTaxable: 100000,
      recurringEmployeePf: 0,
      monthsLeft: 11,
    });
    expect(r.monthlyTds).toBe(0);
  });
});
