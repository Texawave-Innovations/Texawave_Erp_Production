import { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { amountInWords } from "./amount-in-words.js";
import {
  computeTotals,
  paymentStatus,
  resolveRates,
  taxModeFor,
} from "./document-totals.js";
import { inr, pdfFileName } from "./printable.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const none = { cgstRate: null, sgstRate: null, igstRate: null };

describe("document totals", () => {
  it("decides CGST+SGST within the supplier's state, IGST across states", () => {
    expect(taxModeFor("33", "33")).toBe("INTRA");
    expect(taxModeFor("33", "29")).toBe("INTER");
    expect(taxModeFor("33", "96")).toBe("INTER");
  });

  it("takes rates from the document first, then the customer", () => {
    const r = resolveRates(
      "INTRA",
      { cgstRate: 6, sgstRate: null, igstRate: null },
      { cgstRate: 9, sgstRate: 9, igstRate: 18 },
    );
    expect([r.cgstRate.toNumber(), r.sgstRate.toNumber()]).toEqual([6, 9]);
    expect(r.igstRate.toNumber()).toBe(0);
  });

  it("inter-state: IGST entered, else CGST+SGST entered, else customer", () => {
    expect(
      resolveRates(
        "INTER",
        { cgstRate: 9, sgstRate: 9, igstRate: null },
        none,
      ).igstRate.toNumber(),
    ).toBe(18);
    expect(
      resolveRates("INTER", none, {
        ...none,
        igstRate: 12,
      }).igstRate.toNumber(),
    ).toBe(12);
    const r = resolveRates("INTER", { ...none, igstRate: 5 }, none);
    expect([r.cgstRate.toNumber(), r.sgstRate.toNumber()]).toEqual([0, 0]);
  });

  it("has no default rate", () => {
    expect(() => resolveRates("INTRA", none, none)).toThrow(
      BusinessRuleViolationException,
    );
    expect(() => resolveRates("INTER", none, none)).toThrow(
      BusinessRuleViolationException,
    );
  });

  it("prices lines + transport, taxes to the paisa, rounds the total to the rupee", () => {
    const rates = resolveRates(
      "INTRA",
      { cgstRate: 9, sgstRate: 9, igstRate: null },
      none,
    );
    const t = computeTotals(
      [
        { quantity: 1.5, unitPrice: 333.33 },
        { quantity: 2, unitPrice: 100 },
      ],
      49.5,
      rates,
    );
    expect(t.lineAmounts.map((a) => a.toFixed(2))).toEqual([
      "500.00",
      "200.00",
    ]);
    expect(t.itemsSubtotal.toFixed(2)).toBe("700.00");
    expect(t.taxableAmount.toFixed(2)).toBe("749.50");
    expect(t.cgstAmount.toFixed(2)).toBe("67.46"); // 67.455 → half-up
    expect(t.sgstAmount.toFixed(2)).toBe("67.46");
    expect(t.totalAmount.toFixed(2)).toBe("884.00"); // 884.42
    expect(t.roundOff.toFixed(2)).toBe("-0.42");
    expect(
      t.taxableAmount
        .plus(t.cgstAmount)
        .plus(t.sgstAmount)
        .plus(t.igstAmount)
        .plus(t.roundOff)
        .equals(t.totalAmount),
    ).toBe(true);
  });

  it("legacy example: 600 + 18% → 708", () => {
    const t = computeTotals(
      [{ quantity: 1, unitPrice: 600 }],
      0,
      resolveRates("INTER", { ...none, igstRate: 18 }, none),
    );
    expect(t.igstAmount.toFixed(2)).toBe("108.00");
    expect(t.totalAmount.toFixed(2)).toBe("708.00");
  });

  it("payment status from total and received (a ₹0 invoice is paid)", () => {
    expect(paymentStatus(D(708), D(0))).toBe("UNPAID");
    expect(paymentStatus(D(708), D(100))).toBe("PARTIALLY_PAID");
    expect(paymentStatus(D(708), D(708))).toBe("PAID");
    expect(paymentStatus(D(0), D(0))).toBe("PAID");
  });
});

describe("amount in words (Indian system)", () => {
  it.each([
    [0, "Rupees Zero Only"],
    [708, "Rupees Seven Hundred Eight Only"],
    [
      17770.8,
      "Rupees Seventeen Thousand Seven Hundred Seventy and Eighty Paise Only",
    ],
    [
      1234567,
      "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only",
    ],
    [250000000, "Rupees Twenty Five Crore Only"],
  ])("%s", (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });
});

describe("printing helpers", () => {
  it("groups rupees the Indian way", () => {
    expect(inr(D(708))).toBe("708.00");
    expect(inr(D(14770.8))).toBe("14,770.80");
    expect(inr(D(1234567.5))).toBe("12,34,567.50");
    expect(inr(D(-0.42))).toBe("-0.42");
  });

  it("makes a safe PDF file name from a number", () => {
    expect(pdfFileName("TW/QUO/26-27/0001")).toBe("TW-QUO-26-27-0001.pdf");
  });
});
