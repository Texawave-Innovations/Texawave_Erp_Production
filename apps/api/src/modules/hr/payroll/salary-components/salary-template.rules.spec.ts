import { describe, expect, it } from "vitest";
import { applyTemplate, TemplateRuleError } from "./salary-template.rules.js";

const L = (
  componentId: number,
  code: string,
  calculationType:
    "FIXED" | "PERCENT_OF_GROSS" | "PERCENT_OF_BASIC" | "REMAINDER",
  value = 0,
  kind: "EARNING" | "DEDUCTION" = "EARNING",
) => ({ componentId, code, kind, calculationType, value });

describe("applyTemplate", () => {
  it("works out percent-of-gross, percent-of-basic, fixed and remainder lines", () => {
    const out = applyTemplate(
      [
        L(1, "BASIC", "PERCENT_OF_GROSS", 40),
        L(2, "HRA", "PERCENT_OF_BASIC", 50),
        L(3, "CONVEYANCE", "FIXED", 1600),
        L(4, "SPECIAL_ALLOWANCE", "REMAINDER"),
        L(5, "CANTEEN", "FIXED", 300, "DEDUCTION"),
      ],
      50000,
    );
    expect(out.map((l) => [l.code, l.monthlyAmount])).toEqual([
      ["BASIC", 20000],
      ["HRA", 10000],
      ["CONVEYANCE", 1600],
      ["SPECIAL_ALLOWANCE", 18400],
      ["CANTEEN", 300],
    ]);
  });

  it("refuses earnings above the gross", () => {
    expect(() =>
      applyTemplate(
        [L(1, "BASIC", "FIXED", 60000), L(2, "OTHER", "REMAINDER")],
        50000,
      ),
    ).toThrow(TemplateRuleError);
  });

  it("refuses a template without a remainder that does not add up to the gross", () => {
    expect(() => applyTemplate([L(1, "BASIC", "FIXED", 40000)], 50000)).toThrow(
      /REMAINDER/,
    );
  });

  it("refuses percent-of-basic without a Basic line", () => {
    expect(() =>
      applyTemplate(
        [L(2, "HRA", "PERCENT_OF_BASIC", 50), L(4, "X", "REMAINDER")],
        50000,
      ),
    ).toThrow(TemplateRuleError);
  });
});
