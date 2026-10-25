import { describe, expect, it } from "vitest";
import {
  financialYearLabel,
  formatProjectCode,
  formatTaskCode,
} from "./project-sequences.js";

describe("project code format", () => {
  it("labels the April–March financial year", () => {
    expect(financialYearLabel(new Date("2026-04-01T00:00:00Z"))).toBe("26-27");
    expect(financialYearLabel(new Date("2027-03-31T00:00:00Z"))).toBe("26-27");
    expect(financialYearLabel(new Date("2026-03-31T00:00:00Z"))).toBe("25-26");
  });

  it("formats prefix/module/type/FY/sequence like the legacy ERP", () => {
    expect(
      formatProjectCode(
        {
          companyPrefix: "TW",
          moduleIdentifier: "PRJ",
          typeCode: "me",
          financialYear: "26-27",
          sequenceDigits: 3,
        },
        7,
      ),
    ).toBe("TW/PRJ/ME/26-27/007");
  });

  it("omits the type segment when the project has no type", () => {
    expect(
      formatProjectCode(
        {
          companyPrefix: "TXW",
          moduleIdentifier: "PRJ",
          typeCode: null,
          financialYear: "26-27",
          sequenceDigits: 3,
        },
        12,
      ),
    ).toBe("TXW/PRJ/26-27/012");
  });

  it("never lets a segment inject an extra slash", () => {
    expect(
      formatProjectCode(
        {
          companyPrefix: "TXW",
          moduleIdentifier: "PRJ",
          typeCode: "M/E",
          financialYear: "26-27",
          sequenceDigits: 3,
        },
        1,
      ),
    ).toBe("TXW/PRJ/M-E/26-27/001");
  });

  it("appends the task running number to the project code", () => {
    expect(
      formatTaskCode(
        "TW/PRJ/ME/26-27/001",
        { taskPrefix: "T", separator: "-", sequenceDigits: 2 },
        3,
      ),
    ).toBe("TW/PRJ/ME/26-27/001-T03");
  });
});
