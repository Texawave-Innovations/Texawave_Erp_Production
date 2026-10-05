import { Prisma } from "@texawave-erp/database";
import {
  defaultEffectiveDate,
  deriveGross,
  financialYearLabel,
  formatRevisionDocumentNo,
  revisionDocPrefix,
  revisionDocType,
} from "./revision-letters.rules.js";

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const D = (value: string) => new Prisma.Decimal(value);

describe("financialYearLabel (legacy getFinancialYearLabel)", () => {
  it("runs April to March: 31 March belongs to the year that began a year earlier", () => {
    expect(financialYearLabel(utc(2026, 3, 31))).toBe("25-26");
  });

  it("switches on 1 April", () => {
    expect(financialYearLabel(utc(2026, 4, 1))).toBe("26-27");
  });

  it("labels an October date with the April-start year", () => {
    expect(financialYearLabel(utc(2026, 10, 5))).toBe("26-27");
  });
});

describe("document numbering (legacy TW/HR/REV/{FY}/{seq})", () => {
  it("builds the per-year counter key and prefix", () => {
    expect(revisionDocPrefix("26-27")).toBe("TW/HR/REV/26-27/");
    expect(revisionDocType("26-27")).toBe("hr_revision_letter_26-27");
  });

  it("zero-pads the issued sequence to three digits, as legacy does", () => {
    expect(formatRevisionDocumentNo("TW/HR/REV/26-27/", 3, 1)).toBe(
      "TW/HR/REV/26-27/001",
    );
    expect(formatRevisionDocumentNo("TW/HR/REV/26-27/", 3, 42)).toBe(
      "TW/HR/REV/26-27/042",
    );
  });

  it("does not truncate a fourth-digit sequence", () => {
    expect(formatRevisionDocumentNo("TW/HR/REV/26-27/", 3, 1234)).toBe(
      "TW/HR/REV/26-27/1234",
    );
  });
});

describe("defaultEffectiveDate (legacy: 1st of next month)", () => {
  it("is the 1st of the following month", () => {
    expect(defaultEffectiveDate(utc(2026, 10, 5))).toBe("2026-11-01");
  });

  it("rolls over the year from December", () => {
    expect(defaultEffectiveDate(utc(2026, 12, 31))).toBe("2027-01-01");
  });

  it("is the 1st even when today is the 1st", () => {
    expect(defaultEffectiveDate(utc(2026, 2, 1))).toBe("2026-03-01");
  });
});

describe("deriveGross (legacy: monthly = basic+da+hra+ca, annual = ×12)", () => {
  it("sums the four components and multiplies by 12", () => {
    expect(
      deriveGross({
        basic: D("35000"),
        da: D("15000"),
        hra: D("30000"),
        ca: D("20000"),
      }),
    ).toEqual({ grossMonthly: "100000.00", grossAnnual: "1200000.00" });
  });

  it("is exact for cent amounts where binary floats are not (0.10 + 0.20)", () => {
    expect(
      deriveGross({
        basic: D("0.10"),
        da: D("0.20"),
        hra: D("0"),
        ca: D("0"),
      }),
    ).toEqual({ grossMonthly: "0.30", grossAnnual: "3.60" });
  });

  it("is zero for a letter with no components yet", () => {
    expect(
      deriveGross({ basic: D("0"), da: D("0"), hra: D("0"), ca: D("0") }),
    ).toEqual({ grossMonthly: "0.00", grossAnnual: "0.00" });
  });
});
