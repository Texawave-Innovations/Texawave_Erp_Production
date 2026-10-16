import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { CustomerAddressDto } from "./dto/customer.dto.js";
import {
  assertContactAndBank,
  maskAccountNumber,
  normalizeAddresses,
  resolveTaxIdentity,
} from "./customers.rules.js";

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof BusinessRuleViolationException) return e.errorCode;
    throw e;
  }
  return undefined;
}

const address = (
  over: Partial<CustomerAddressDto> = {},
): CustomerAddressDto => ({
  addressType: "BILLING",
  label: "Head Office",
  street: "12 Mount Road",
  city: "Chennai",
  stateCode: "33",
  pincode: "600002",
  ...over,
});

describe("resolveTaxIdentity", () => {
  it("auto-detects state and PAN from the GSTIN", () => {
    expect(
      resolveTaxIdentity({
        gstin: "33AAAAA0000A1Z5",
        stateCode: null,
        pan: null,
      }),
    ).toEqual({ gstin: "33AAAAA0000A1Z5", stateCode: "33", pan: "AAAAA0000A" });
  });

  it("keeps an edited state (the form allows overriding it)", () => {
    expect(
      resolveTaxIdentity({
        gstin: "27AAAAA0000A1Z5",
        stateCode: "33",
        pan: null,
      }).stateCode,
    ).toBe("33");
  });

  it("rejects a PAN that is not the one inside the GSTIN", () => {
    expect(
      code(() =>
        resolveTaxIdentity({
          gstin: "33AAAAA0000A1Z5",
          stateCode: null,
          pan: "ABCDE1234F",
        }),
      ),
    ).toBe("PAN_GSTIN_MISMATCH");
  });

  it("rejects unknown state codes, in the GSTIN or on their own", () => {
    expect(
      code(() =>
        resolveTaxIdentity({
          gstin: "99AAAAA0000A1Z5",
          stateCode: null,
          pan: null,
        }),
      ),
    ).toBe("INVALID_GSTIN");
    expect(
      code(() =>
        resolveTaxIdentity({ gstin: null, stateCode: "25", pan: null }),
      ),
    ).toBe("INVALID_STATE_CODE");
  });

  it("leaves a customer without GSTIN alone", () => {
    expect(
      resolveTaxIdentity({ gstin: null, stateCode: null, pan: "ABCDE1234F" }),
    ).toEqual({ gstin: null, stateCode: null, pan: "ABCDE1234F" });
  });
});

describe("normalizeAddresses", () => {
  it("makes the first address of each type the default when none is chosen", () => {
    const out = normalizeAddresses([
      address(),
      address({ label: "Branch" }),
      address({ addressType: "SHIPPING", label: "Plant" }),
    ]);
    expect(out.map((a) => a.isDefault)).toEqual([true, false, true]);
  });

  it("keeps an explicit default", () => {
    const out = normalizeAddresses([
      address(),
      address({ label: "Branch", isDefault: true }),
    ]);
    expect(out.map((a) => a.isDefault)).toEqual([false, true]);
  });

  it("allows one default per type only", () => {
    expect(
      code(() =>
        normalizeAddresses([
          address({ isDefault: true }),
          address({ isDefault: true }),
        ]),
      ),
    ).toBe("MULTIPLE_DEFAULT_ADDRESSES");
  });

  it("rejects an unknown state code", () => {
    expect(code(() => normalizeAddresses([address({ stateCode: "00" })]))).toBe(
      "INVALID_STATE_CODE",
    );
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last four digits", () => {
    expect(maskAccountNumber("50100234567890")).toBe("**********7890");
    expect(maskAccountNumber("123")).toBe("***");
  });
});

describe("assertContactAndBank", () => {
  const ok = {
    mobileCountryCode: "+91",
    mobileNumber: "9876543210",
    cgstRate: 9,
    sgstRate: 9,
    bankName: "HDFC Bank",
    hasAccountNumber: true,
    bankIfsc: "HDFC0001234",
  };

  it("accepts a complete, consistent customer", () => {
    expect(code(() => assertContactAndBank(ok))).toBeUndefined();
    expect(
      code(() =>
        assertContactAndBank({
          ...ok,
          cgstRate: null,
          sgstRate: null,
          bankName: null,
          hasAccountNumber: false,
          bankIfsc: null,
        }),
      ),
    ).toBeUndefined();
  });

  it("an Indian mobile is 10 digits starting with 6-9; others keep 6-15 digits", () => {
    expect(
      code(() => assertContactAndBank({ ...ok, mobileNumber: "1234567890" })),
    ).toBe("INVALID_MOBILE");
    expect(
      code(() => assertContactAndBank({ ...ok, mobileNumber: "98765" })),
    ).toBe("INVALID_MOBILE");
    expect(
      code(() =>
        assertContactAndBank({
          ...ok,
          mobileCountryCode: "+971",
          mobileNumber: "501234567",
        }),
      ),
    ).toBeUndefined();
  });

  it("CGST and SGST come together, at the same rate", () => {
    expect(code(() => assertContactAndBank({ ...ok, sgstRate: null }))).toBe(
      "GST_RATES_MISMATCH",
    );
    expect(code(() => assertContactAndBank({ ...ok, sgstRate: 6 }))).toBe(
      "GST_RATES_MISMATCH",
    );
    expect(
      code(() => assertContactAndBank({ ...ok, cgstRate: "9", sgstRate: 9 })),
    ).toBeUndefined();
  });

  it("an account number needs the bank name and IFSC", () => {
    expect(code(() => assertContactAndBank({ ...ok, bankIfsc: null }))).toBe(
      "BANK_DETAILS_INCOMPLETE",
    );
    expect(code(() => assertContactAndBank({ ...ok, bankName: null }))).toBe(
      "BANK_DETAILS_INCOMPLETE",
    );
  });

  it("on update only the groups that were sent are checked", () => {
    const legacy = { ...ok, mobileNumber: "12345", sgstRate: null };
    expect(
      code(() =>
        assertContactAndBank(legacy, { mobile: false, gst: false, bank: true }),
      ),
    ).toBeUndefined();
    expect(
      code(() =>
        assertContactAndBank(legacy, { mobile: true, gst: false, bank: false }),
      ),
    ).toBe("INVALID_MOBILE");
  });
});
