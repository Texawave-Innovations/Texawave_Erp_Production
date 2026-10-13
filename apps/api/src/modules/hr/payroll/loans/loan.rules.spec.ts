import { describe, expect, it } from "vitest";
import {
  applyPrepayment,
  buildSchedule,
  checkLoanLimits,
} from "./loan.rules.js";

describe("loan rules", () => {
  it("builds a schedule summing to the principal, last installment adjusted", () => {
    const s = buildSchedule(
      10000,
      3000,
      4,
      new Date("2026-01-31T00:00:00.000Z"),
    )!;
    expect(s.map((i) => i.amount)).toEqual([3000, 3000, 3000, 1000]);
    expect(s[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("refuses an EMI that does not fit the principal", () => {
    expect(buildSchedule(10000, 2000, 4, new Date())).toBeNull();
    expect(buildSchedule(10000, 5000, 4, new Date())).toBeNull();
  });

  it("checks the principal and EMI limits", () => {
    const base = { grossMonthly: 20000, maxMultiple: 3, maxEmiPercent: 50 };
    expect(
      checkLoanLimits({
        ...base,
        principal: 60000,
        emiAmount: 5000,
        otherEmis: 0,
      }),
    ).toMatchObject({ overLimit: false, emiOverLimit: false });
    expect(
      checkLoanLimits({
        ...base,
        principal: 60001,
        emiAmount: 5000,
        otherEmis: 0,
      }).overLimit,
    ).toBe(true);
    expect(
      checkLoanLimits({
        ...base,
        principal: 1000,
        emiAmount: 5001,
        otherEmis: 5000,
      }).emiOverLimit,
    ).toBe(true);
  });

  it("applies a prepayment to the last installments first", () => {
    const pending = [
      { id: 1, installmentNo: 1, amount: 1000 },
      { id: 2, installmentNo: 2, amount: 1000 },
      { id: 3, installmentNo: 3, amount: 500 },
    ];
    expect(applyPrepayment(pending, 1700)).toEqual({
      prepaidIds: [3, 2],
      reduced: { id: 1, amount: 800 },
      applied: 1700,
    });
    expect(applyPrepayment(pending, 2500)).toEqual({
      prepaidIds: [3, 2, 1],
      reduced: null,
      applied: 2500,
    });
  });
});
