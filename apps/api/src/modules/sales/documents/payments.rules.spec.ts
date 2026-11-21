import { parseDateOnly } from "../../../common/dates/date-only.js";
import {
  dateRange,
  effectiveDueDate,
  modeLabel,
  overdueDays,
} from "./payments.rules.js";

const d = parseDateOnly;

describe("payments received rules", () => {
  it("old mode codes become labels; typed modes are kept", () => {
    expect(modeLabel("BANK_TRANSFER")).toBe("Bank Transfer");
    expect(modeLabel("CASH")).toBe("Cash");
    expect(modeLabel(" NEFT ")).toBe("NEFT");
  });

  it("a date range may be open at either end, and is absent when both are", () => {
    expect(dateRange(undefined, undefined)).toBeUndefined();
    expect(dateRange("2026-10-01", "2026-10-31")).toEqual({
      from: d("2026-10-01"),
      to: d("2026-10-31"),
    });
    expect(dateRange("2026-10-01", undefined)).toEqual({
      from: d("2026-10-01"),
      to: undefined,
    });
    expect(dateRange(undefined, "2026-10-31")?.from).toBeUndefined();
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
