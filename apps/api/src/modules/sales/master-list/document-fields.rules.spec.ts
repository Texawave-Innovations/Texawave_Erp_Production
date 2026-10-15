import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import {
  assertFieldAllowed,
  FIELDS_BY_DOCUMENT,
  normalizeOption,
} from "./document-fields.rules.js";

describe("document field rules", () => {
  it("offers each document only its own fields", () => {
    expect(FIELDS_BY_DOCUMENT.QUOTATION).toEqual([
      "VALIDITY",
      "DELIVERY_TERMS",
      "HSN_CODE",
      "BANK_ACCOUNT",
      "COMPANY_SEAL",
      "AUTHORIZED_SIGNATURE",
      "PREPARED_BY",
    ]);
    expect(FIELDS_BY_DOCUMENT.PROFORMA_INVOICE[0]).toBe("PAYMENT_TERMS");
    expect(FIELDS_BY_DOCUMENT.TAX_INVOICE[0]).toBe("PAYMENT_TERMS");
    expect(FIELDS_BY_DOCUMENT.DELIVERY_CHALLAN).not.toContain("PAYMENT_TERMS");
    expect(FIELDS_BY_DOCUMENT.PAYMENT_RECEIVED).toEqual(["PAYMENT_MODE"]);
    expect(FIELDS_BY_DOCUMENT.RETURNABLE_DC).toEqual([
      "COMPANY_SEAL",
      "AUTHORIZED_SIGNATURE",
      "PREPARED_BY",
    ]);
    expect(() => assertFieldAllowed("RETURNABLE_DC", "HSN_CODE")).toThrow(
      BusinessRuleViolationException,
    );
    expect(() => assertFieldAllowed("DELIVERY_CHALLAN", "VALIDITY")).toThrow(
      BusinessRuleViolationException,
    );
    expect(() => assertFieldAllowed("TAX_INVOICE", "DELIVERY_TERMS")).toThrow(
      BusinessRuleViolationException,
    );
    expect(() =>
      assertFieldAllowed("QUOTATION", "DELIVERY_TERMS"),
    ).not.toThrow();
  });

  it("HSN codes carry a 4-8 digit value; the label defaults to the code", () => {
    expect(normalizeOption("HSN_CODE", { value: "8471" })).toEqual({
      label: "8471",
      value: "8471",
      bankDetails: null,
    });
    expect(
      normalizeOption("HSN_CODE", { value: "9965", label: "Transport" }).label,
    ).toBe("Transport");
    expect(() => normalizeOption("HSN_CODE", { value: "84" })).toThrow(
      BusinessRuleViolationException,
    );
  });

  it("bank accounts need details; the label is built from them", () => {
    const opt = normalizeOption("BANK_ACCOUNT", {
      bankDetails: {
        bankName: "HDFC Bank",
        accountNumber: "235767577457",
        branch: "Main Branch",
        ifsc: "HDFC0001256",
      },
    });
    expect(opt.label).toBe("HDFC Bank - 235767577457 (Main Branch)");
    expect(() => normalizeOption("BANK_ACCOUNT", { label: "x" })).toThrow(
      BusinessRuleViolationException,
    );
    expect(() =>
      normalizeOption("BANK_ACCOUNT", {
        bankDetails: {
          bankName: "X",
          accountNumber: "123456",
          ifsc: "BAD",
        },
      }),
    ).toThrow(BusinessRuleViolationException);
  });

  it("text fields need a label and take no value or bank details", () => {
    expect(normalizeOption("VALIDITY", { label: " 30 Days " }).label).toBe(
      "30 Days",
    );
    expect(() => normalizeOption("PREPARED_BY", {})).toThrow(
      BusinessRuleViolationException,
    );
    expect(() =>
      normalizeOption("PAYMENT_TERMS", { label: "x", value: "1234" }),
    ).toThrow(BusinessRuleViolationException);
    expect(normalizeOption("PAYMENT_MODE", { label: "UPI" }).label).toBe("UPI");
    expect(() =>
      normalizeOption("PAYMENT_MODE", { label: "x".repeat(51) }),
    ).toThrow(BusinessRuleViolationException);
  });
});
