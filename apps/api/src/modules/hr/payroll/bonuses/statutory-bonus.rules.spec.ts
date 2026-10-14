import { describe, expect, it } from "vitest";
import { gratuity, statutoryBonus } from "./statutory-bonus.rules.js";

const RULES = {
  bonusEligibilityLimit: 21000,
  bonusCalculationCeiling: 7000,
  bonusPercent: 8.33,
};
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("statutory bonus", () => {
  it("is 8.33% of Basic + DA capped at the ceiling each month", () => {
    const months = [
      { basicDaEarned: 9000, payableDays: 30 },
      { basicDaEarned: 4000, payableDays: 15 },
    ];
    // min(9000, 7000) + 4000 = 11000 × 8.33% = 916.3 → 916
    expect(statutoryBonus(9000, months, RULES)).toMatchObject({
      eligible: true,
      bonusWages: 11000,
      amount: 916,
    });
  });

  it("excludes salaries above the eligibility limit", () => {
    expect(
      statutoryBonus(25000, [{ basicDaEarned: 25000, payableDays: 30 }], RULES)
        .eligible,
    ).toBe(false);
  });

  it("needs 30 days worked in the year", () => {
    expect(
      statutoryBonus(9000, [{ basicDaEarned: 9000, payableDays: 29 }], RULES)
        .eligible,
    ).toBe(false);
  });
});

describe("gratuity", () => {
  const base = { monthlyBasicDa: 26000, minYears: 5, cap: 2000000 };

  it("needs five completed years", () => {
    expect(
      gratuity({
        ...base,
        dateOfJoining: d("2021-06-01"),
        asOf: d("2026-05-31"),
      }).eligible,
    ).toBe(false);
    expect(
      gratuity({
        ...base,
        dateOfJoining: d("2021-06-01"),
        asOf: d("2026-06-01"),
      }).eligible,
    ).toBe(true);
  });

  it("counts a part year over six months as a full year", () => {
    const r = gratuity({
      ...base,
      dateOfJoining: d("2020-01-01"),
      asOf: d("2026-08-01"),
    });
    expect(r.completedYears).toBe(6);
    expect(r.countedYears).toBe(7);
    expect(r.amount).toBe(105000); // 26000 × 15 × 7 / 26
  });

  it("is capped", () => {
    expect(
      gratuity({
        ...base,
        cap: 50000,
        dateOfJoining: d("2000-01-01"),
        asOf: d("2026-01-01"),
      }).amount,
    ).toBe(50000);
  });
});
