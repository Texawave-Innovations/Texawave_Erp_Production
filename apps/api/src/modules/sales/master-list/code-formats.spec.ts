import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { countryFromCallingCode } from "../shared/countries.js";
import {
  DEFAULT_CODE_FORMATS,
  documentSequenceDocType,
  exampleCode,
  fiscalYearLabel,
  formatCode,
  formatDocumentNumber,
  sequenceDocType,
} from "./code-formats.rules.js";
import { CodeFormatsService } from "./code-formats.service.js";

describe("code format rules", () => {
  it("labels the April–March financial year", () => {
    expect(fiscalYearLabel(new Date("2026-10-15"))).toBe("26-27");
    expect(fiscalYearLabel(new Date("2027-03-31"))).toBe("26-27");
    expect(fiscalYearLabel(new Date("2027-04-01"))).toBe("27-28");
    expect(fiscalYearLabel(new Date("2099-06-01"))).toBe("99-00");
  });

  it("formats document numbers PREFIX/FY/NNNN with a counter per type and year", () => {
    expect(
      formatDocumentNumber(DEFAULT_CODE_FORMATS.quotation, "26-27", 7),
    ).toBe("TW/QUO/26-27/0007");
    expect(
      formatDocumentNumber(DEFAULT_CODE_FORMATS.tax_invoice, "26-27", 12345),
    ).toBe("TW/IN/26-27/12345");
    expect(documentSequenceDocType("quotation", "26-27")).toBe(
      "sales_quotation_26-27",
    );
    expect(documentSequenceDocType("quotation", "27-28")).not.toBe(
      documentSequenceDocType("quotation", "26-27"),
    );
    expect(
      exampleCode(
        "proforma_invoice",
        DEFAULT_CODE_FORMATS.proforma_invoice,
        new Date("2026-10-15"),
      ),
    ).toBe("TW/PI/26-27/0001");
    expect(
      exampleCode("customer", DEFAULT_CODE_FORMATS.customer, new Date()),
    ).toBe("CUS-IN-001");
  });

  it("formats PREFIX-COUNTRY-NUMBER, padded and growing past the width", () => {
    const f = DEFAULT_CODE_FORMATS.customer;
    expect(formatCode(f, "IN", 1)).toBe("CUS-IN-001");
    expect(formatCode(f, "AE", 42)).toBe("CUS-AE-042");
    expect(formatCode(f, "IN", 1000)).toBe("CUS-IN-1000");
    expect(formatCode({ prefix: "CL", padding: 5 }, "US", 7)).toBe(
      "CL-US-00007",
    );
  });

  it("keeps one counter per code type and country", () => {
    expect(sequenceDocType("customer", "IN")).toBe("sales_customer_IN");
    expect(sequenceDocType("customer", "AE")).not.toBe(
      sequenceDocType("customer", "IN"),
    );
  });

  it("maps mobile country codes to ISO countries", () => {
    expect(countryFromCallingCode("+91")).toBe("IN");
    expect(countryFromCallingCode("+971")).toBe("AE");
    expect(() => countryFromCallingCode("+999")).toThrow();
  });
});

describe("CodeFormatsService", () => {
  const scope = { organizationId: 1 };
  function makeService() {
    const repository = {
      findAll: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
    const tenantContext = {
      getOrgScope: vi.fn().mockReturnValue(scope),
      getUserId: vi.fn().mockReturnValue(42),
    };
    return {
      service: new CodeFormatsService(
        repository as never,
        tenantContext as never,
      ),
      repository,
    };
  }

  it("lists every code type, falling back to its default", async () => {
    const { service } = makeService();
    const all = await service.findAll();
    expect(all.map((f) => [f.codeType, f.prefix, f.padding])).toEqual([
      ["customer", "CUS", 3],
      ["quotation", "TW/QUO", 4],
      ["proforma_invoice", "TW/PI", 4],
      ["tax_invoice", "TW/IN", 4],
      ["delivery_challan", "TW/DC", 4],
    ]);
    expect(all.every((f) => f.isDefault && f.updatedAt === null)).toBe(true);
    expect(all[0]?.example).toBe("CUS-IN-001");
    expect(all[1]?.example).toMatch(/^TW\/QUO\/\d{2}-\d{2}\/0001$/);
  });

  it("rejects a separator in a customer prefix but allows one in a document prefix", async () => {
    const { service, repository } = makeService();
    await expect(
      service.update("customer", { prefix: "TW/CUS" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    repository.upsert.mockResolvedValue({
      codeType: "quotation",
      prefix: "TX/Q",
      padding: 4,
      updatedAt: new Date(),
    });
    await expect(
      service.update("quotation", { prefix: "TX/Q" }),
    ).resolves.toMatchObject({ prefix: "TX/Q", isDefault: false });
  });

  it("returns the stored format once edited", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      codeType: "customer",
      prefix: "CL",
      padding: 4,
      updatedAt: new Date(),
    });
    await expect(service.getFormat("customer")).resolves.toEqual({
      prefix: "CL",
      padding: 4,
    });
  });

  it("updates only the fields sent, with the acting user", async () => {
    const { service, repository } = makeService();
    repository.upsert.mockResolvedValue({
      codeType: "customer",
      prefix: "CL",
      padding: 3,
      updatedAt: new Date(),
    });
    const res = await service.update("customer", { prefix: "CL" });
    expect(repository.upsert).toHaveBeenCalledWith(
      scope,
      "customer",
      { prefix: "CL" },
      42,
    );
    expect(res).toMatchObject({ example: "CL-IN-001", isDefault: false });
  });

  it("404s for an unknown code type", async () => {
    const { service } = makeService();
    await expect(service.findOne("vendor")).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.update("vendor", {})).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
