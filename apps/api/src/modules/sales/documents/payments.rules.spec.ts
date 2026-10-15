import { parseDateOnly } from "../../../common/dates/date-only.js";
import {
  effectiveDueDate,
  modeLabel,
  monthRange,
  overdueDays,
} from "./payments.rules.js";

const d = parseDateOnly;

describe("payments received rules", () => {
  it("old mode codes become labels; typed modes are kept", () => {
    expect(modeLabel("BANK_TRANSFER")).toBe("Bank Transfer");
    expect(modeLabel("CASH")).toBe("Cash");
    expect(modeLabel(" NEFT ")).toBe("NEFT");
  });

  it("a month is its first to last day", () => {
    expect(monthRange("2026-02")).toEqual({
      from: d("2026-02-01"),
      to: d("2026-02-28"),
    });
    expect(monthRange("2028-02").to).toEqual(d("2028-02-29"));
    expect(monthRange("2026-12").to).toEqual(d("2026-12-31"));
  });

  it("the payment's due date wins over the invoice's", () => {
    expect(effectiveDueDate(d("2026-11-01"), d("2026-10-01"))).toEqual(
      d("2026-11-01"),
    );
    expect(effectiveDueDate(null, d("2026-10-01"))).toEqual(d("2026-10-01"));
    expect(effectiveDueDate(null, null)).toBeNull();
  });

  it("overdue only after the due date and while the invoice is open", () => {
    const today = d("2026-10-15");
    expect(overdueDays(d("2026-06-11"), "PARTIALLY_PAID", today)).toBe(126);
    expect(overdueDays(d("2026-10-14"), "UNPAID", today)).toBe(1);
    expect(overdueDays(d("2026-10-15"), "UNPAID", today)).toBeNull();
    expect(overdueDays(d("2026-06-11"), "PAID", today)).toBeNull();
    expect(overdueDays(null, "UNPAID", today)).toBeNull();
  });
});
