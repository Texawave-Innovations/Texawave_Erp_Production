import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL_RULES,
  splitGross,
  toRules,
} from "./payroll-settings.rules.js";

describe("splitGross", () => {
  it("splits by the legacy 35/30/20 default with the remainder as other allowance", () => {
    expect(splitGross(40000, DEFAULT_PAYROLL_RULES)).toEqual({
      basic: 14000,
      hra: 12000,
      conveyance: 8000,
      otherAllowance: 6000,
    });
  });

  it("always adds up to exactly the gross, even with rounding", () => {
    const parts = splitGross(33333.33, DEFAULT_PAYROLL_RULES);
    const total =
      parts.basic + parts.hra + parts.conveyance + parts.otherAllowance;
    expect(Math.round(total * 100) / 100).toBe(33333.33);
  });

  it("uses the organization's percentages", () => {
    expect(
      splitGross(10000, {
        basicPercent: 50,
        hraPercent: 25,
        conveyancePercent: 0,
      }),
    ).toEqual({ basic: 5000, hra: 2500, conveyance: 0, otherAllowance: 2500 });
  });
});

describe("toRules", () => {
  it("falls back to the defaults when the organization has no settings row", () => {
    expect(toRules(null)).toEqual(DEFAULT_PAYROLL_RULES);
  });

  it("converts stored decimals to numbers", () => {
    const row = {
      ...DEFAULT_PAYROLL_RULES,
      esiEmployeeRate: { toString: () => "0.75" },
      pfWageCeiling: { toString: () => "18000.00" },
    };
    expect(toRules(row)).toMatchObject({
      esiEmployeeRate: 0.75,
      pfWageCeiling: 18000,
    });
  });
});
