import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AddressDto } from "./dto/address.dto.js";
import { BankDetailsDto } from "./dto/bank-details.dto.js";
import { GovernmentIdsDto } from "./dto/government-ids.dto.js";
import { PersonalDetailsDto } from "./dto/personal-details.dto.js";
import {
  missingOnboardingItems,
  type OnboardingSnapshot,
} from "./onboarding-completeness.js";

const messagesFor = <T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) =>
  validateSync(plainToInstance(cls, body)).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

const validAddress = {
  addressLine: "14, 3rd Cross",
  district: "Bengaluru Urban",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560034",
};

describe("onboarding validators", () => {
  describe("AddressDto", () => {
    it("accepts a complete address", () => {
      expect(messagesFor(AddressDto, validAddress)).toEqual([]);
    });

    it.each([
      ["pincode too short", "5600"],
      ["pincode with letters", "56003A"],
      ["pincode starting with 0", "060034"],
    ])("rejects %s", (_label, pincode) => {
      expect(messagesFor(AddressDto, { ...validAddress, pincode })).toContain(
        "Enter a valid 6-digit pincode.",
      );
    });

    it("rejects a missing required line", () => {
      const { addressLine: _omit, ...rest } = validAddress;
      expect(messagesFor(AddressDto, rest).length).toBeGreaterThan(0);
    });
  });

  describe("BankDetailsDto", () => {
    const valid = {
      accountHolderName: "Priya Sharma",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    };

    it("accepts valid bank details with an optional branch", () => {
      expect(
        messagesFor(BankDetailsDto, { ...valid, branchName: "Koramangala" }),
      ).toEqual([]);
    });

    it.each([
      ["account number 8 digits", "12345678"],
      ["account number 19 digits", "1234567890123456789"],
      ["account number with letters", "12345678901A"],
    ])("rejects %s", (_label, accountNumber) => {
      expect(
        messagesFor(BankDetailsDto, { ...valid, accountNumber }),
      ).toContain("Account number must be 9 to 18 digits.");
    });

    it.each([
      ["IFSC without the 0 in position 5", "HDFC1001234"],
      ["IFSC too short", "HDFC001234"],
      ["lower-case IFSC", "hdfc0001234"],
    ])("rejects %s", (_label, ifsc) => {
      expect(messagesFor(BankDetailsDto, { ...valid, ifsc })).toContain(
        "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).",
      );
    });
  });

  describe("GovernmentIdsDto", () => {
    it("accepts a 12-digit Aadhaar and a valid PAN with ESI and PF left out", () => {
      expect(
        messagesFor(GovernmentIdsDto, {
          aadhaarNumber: "123456789012",
          panNumber: "ABCDE1234F",
        }),
      ).toEqual([]);
    });

    it.each([
      ["Aadhaar of 14 digits", "12345678901234"],
      ["Aadhaar of 15 digits", "123456789012345"],
      ["Aadhaar with letters", "12345678901A"],
    ])("rejects %s", (_label, aadhaarNumber) => {
      expect(
        messagesFor(GovernmentIdsDto, {
          aadhaarNumber,
          panNumber: "ABCDE1234F",
        }),
      ).toContain("Aadhaar number must be exactly 12 digits.");
    });

    it("rejects a PAN in the wrong shape", () => {
      expect(
        messagesFor(GovernmentIdsDto, {
          aadhaarNumber: "123456789012",
          panNumber: "ABCD51234F",
        }),
      ).toContain(
        "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).",
      );
    });

    it("validates ESI and PF only when they are given", () => {
      expect(
        messagesFor(GovernmentIdsDto, {
          aadhaarNumber: "123456789012",
          panNumber: "ABCDE1234F",
          esiNumber: "12345",
        }),
      ).toContain("ESI number must be exactly 17 digits.");
      expect(
        messagesFor(GovernmentIdsDto, {
          aadhaarNumber: "123456789012",
          panNumber: "ABCDE1234F",
          pfNumber: "123456789012",
        }),
      ).toEqual([]);
    });
  });

  describe("PersonalDetailsDto", () => {
    const valid = {
      dateOfBirth: "1998-04-12",
      gender: "FEMALE",
      emergencyContactName: "Rajesh Sharma",
      emergencyContactRelation: "Father",
      emergencyContactPhone: "9841055667",
      fatherName: "Rajesh Sharma",
      fatherPhone: "9841055667",
      motherName: "Sunita Sharma",
      motherPhone: "9841055668",
    };

    it("accepts a complete personal section", () => {
      expect(messagesFor(PersonalDetailsDto, valid)).toEqual([]);
    });

    it("rejects a mobile number that does not start with 6 to 9", () => {
      expect(
        messagesFor(PersonalDetailsDto, {
          ...valid,
          fatherPhone: "1234567890",
        }),
      ).toContain("Enter a valid 10-digit mobile number starting with 6 to 9.");
    });

    it("rejects an unknown gender", () => {
      expect(
        messagesFor(PersonalDetailsDto, { ...valid, gender: "UNKNOWN" }),
      ).toContain("Select a valid gender.");
    });
  });
});

describe("missingOnboardingItems", () => {
  const complete: OnboardingSnapshot = {
    personal: {
      dateOfBirth: "1998-04-12",
      gender: "FEMALE",
      emergencyContactName: "A",
      emergencyContactRelation: "Father",
      emergencyContactPhone: "9841055667",
      fatherName: "A",
      fatherPhone: "9841055667",
      motherName: "B",
      motherPhone: "9841055668",
    },
    permanentAddress: validAddress,
    presentAddress: null,
    bank: {
      accountHolderName: "Priya",
      accountNumberEncrypted: "enc",
      ifsc: "HDFC0001234",
      bankName: "HDFC",
    },
    governmentIds: { aadhaarNumber: "123456789012", panNumber: "ABCDE1234F" },
    documents: [
      { documentType: "PROFILE_PHOTO" },
      { documentType: "AADHAAR" },
      { documentType: "PAN" },
      { documentType: "BANK_STATEMENT" },
      { documentType: "CERT_10TH" },
      { documentType: "CERT_12TH" },
      { documentType: "CERT_GRADUATION" },
    ],
  };

  it("returns nothing for a complete profile, with no present address (same as permanent)", () => {
    expect(missingOnboardingItems(complete)).toEqual([]);
  });

  it("lists each missing item by name", () => {
    const missing = missingOnboardingItems({
      ...complete,
      bank: null,
      documents: complete.documents.filter((d) => d.documentType !== "PAN"),
    });
    expect(missing).toEqual(
      expect.arrayContaining([
        "bank.accountHolderName",
        "bank.accountNumberEncrypted",
        "bank.ifsc",
        "bank.bankName",
        "document.PAN",
      ]),
    );
    expect(missing).not.toContain("governmentIds.aadhaarNumber");
  });

  it("flags a required address field left empty", () => {
    const missing = missingOnboardingItems({
      ...complete,
      permanentAddress: { ...validAddress, pincode: "" },
    });
    expect(missing).toEqual(["permanentAddress.pincode"]);
  });
});
