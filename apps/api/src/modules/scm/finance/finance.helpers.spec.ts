import { describe, expect, it } from "vitest";
import {
  billStatusFor,
  dueDateFrom,
  isOverdue,
  outstanding,
  paymentTermDays,
} from "./finance.helpers.js";

describe("billStatusFor", () => {
  it("is OPEN with no payment, PARTIALLY_PAID part-way, PAID when settled", () => {
    expect(billStatusFor(1180, 0)).toBe("OPEN");
    expect(billStatusFor(1180, 500)).toBe("PARTIALLY_PAID");
    expect(billStatusFor(1180, 1180)).toBe("PAID");
  });

  it("does not drift on floating point sums", () => {
    expect(billStatusFor(0.3, 0.1 + 0.2)).toBe("PAID");
  });
});

describe("outstanding", () => {
  it("never goes negative", () => {
    expect(outstanding(100, 40)).toBe(60);
    expect(outstanding(100, 100)).toBe(0);
    expect(outstanding(100, 130)).toBe(0);
  });
});

describe("payment terms", () => {
  it("reads the day count out of free text", () => {
    expect(paymentTermDays("Net 30")).toBe(30);
    expect(paymentTermDays("45 Days")).toBe(45);
    expect(paymentTermDays("Advance")).toBeNull();
    expect(paymentTermDays(null)).toBeNull();
  });

  it("derives the due date from the bill date", () => {
    expect(dueDateFrom("2026-10-01", "Net 30")).toBe("2026-10-31");
    expect(dueDateFrom("2026-12-20", "Net 30")).toBe("2027-01-19");
    expect(dueDateFrom("2026-10-01", "Advance")).toBeNull();
  });
});

describe("isOverdue", () => {
  const today = new Date(2026, 9, 18);
  it("flags unpaid bills past due only", () => {
    expect(
      isOverdue({ status: "OPEN", dueDate: new Date("2026-10-17") }, today),
    ).toBe(true);
    expect(
      isOverdue({ status: "OPEN", dueDate: new Date("2026-10-18") }, today),
    ).toBe(false);
    expect(
      isOverdue(
        { status: "PARTIALLY_PAID", dueDate: new Date("2026-09-01") },
        today,
      ),
    ).toBe(true);
    expect(
      isOverdue({ status: "PAID", dueDate: new Date("2026-09-01") }, today),
    ).toBe(false);
    expect(
      isOverdue(
        { status: "CANCELLED", dueDate: new Date("2026-09-01") },
        today,
      ),
    ).toBe(false);
    expect(isOverdue({ status: "OPEN", dueDate: null }, today)).toBe(false);
  });
});
