import { describe, expect, it } from "vitest";
import {
  csvCell,
  maskEmployeeBankDetails,
  maskTail,
  toPayrollBankView,
} from "./sensitive-data.js";

const BANK = {
  bankName: "State Bank",
  accountNumberMasked: "********1234",
  ifsc: "SBIN0000001",
  deletedAt: null,
};

describe("maskTail", () => {
  it("keeps only the last four characters", () => {
    expect(maskTail("ABCDE1234F")).toBe("******234F");
  });

  it("fully masks values of four characters or fewer", () => {
    expect(maskTail("1234")).toBe("****");
    expect(maskTail("12")).toBe("**");
    expect(maskTail("")).toBe("");
  });

  it.each([null, undefined])("returns null for %s", (v) => {
    expect(maskTail(v)).toBeNull();
  });
});

describe("toPayrollBankView", () => {
  it("maps the onboarding bank row and masks PAN when the gov-id row was selected", () => {
    const view = toPayrollBankView({
      id: 1,
      firstName: "Asha",
      bankDetail: BANK,
      employeeGovernmentId: { panNumber: "ABCDE1234F", deletedAt: null },
    });

    expect(view).toEqual({
      id: 1,
      firstName: "Asha",
      bankDetails: {
        bankName: "State Bank",
        accountNumber: "********1234",
        ifscCode: "SBIN0000001",
        panNumber: "******234F",
      },
    });
    expect(view).not.toHaveProperty("bankDetail");
    expect(view).not.toHaveProperty("employeeGovernmentId");
  });

  it("omits panNumber entirely when the gov-id relation was not selected", () => {
    const view = toPayrollBankView({ id: 1, bankDetail: BANK });
    expect(view.bankDetails).not.toBeNull();
    expect(view.bankDetails).not.toHaveProperty("panNumber");
  });

  it("returns a null panNumber when the gov-id row is soft-deleted or absent", () => {
    expect(
      toPayrollBankView({
        bankDetail: BANK,
        employeeGovernmentId: {
          panNumber: "ABCDE1234F",
          deletedAt: new Date(),
        },
      }).bankDetails?.panNumber,
    ).toBeNull();
    expect(
      toPayrollBankView({ bankDetail: BANK, employeeGovernmentId: null })
        .bankDetails?.panNumber,
    ).toBeNull();
  });

  it("treats a missing or soft-deleted bank row as no bank details", () => {
    expect(toPayrollBankView({ bankDetail: null }).bankDetails).toBeNull();
    expect(toPayrollBankView({}).bankDetails).toBeNull();
    expect(
      toPayrollBankView({ bankDetail: { ...BANK, deletedAt: new Date() } })
        .bankDetails,
    ).toBeNull();
  });
});

describe("maskEmployeeBankDetails", () => {
  it("replaces the nested employee with the masked view, keeping other fields", () => {
    const row = {
      id: 9,
      netPayable: "1000.00",
      employee: { id: 1, bankDetail: BANK },
    };
    const masked = maskEmployeeBankDetails(row);
    expect(masked.id).toBe(9);
    expect(masked.netPayable).toBe("1000.00");
    expect(masked.employee).toEqual({
      id: 1,
      bankDetails: {
        bankName: "State Bank",
        accountNumber: "********1234",
        ifscCode: "SBIN0000001",
      },
    });
  });
});

describe("csvCell", () => {
  it("quotes values and doubles embedded quotes", () => {
    expect(csvCell('Ravi "R" Kumar')).toBe('"Ravi ""R"" Kumar"');
    expect(csvCell(1500.5)).toBe('"1500.5"');
  });

  it("renders null/undefined as an empty quoted cell", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"])(
    "neutralises a leading formula character in %j",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );

  it("also prefixes a negative number (leading minus)", () => {
    expect(csvCell(-5)).toBe(`"'-5"`);
  });
});
