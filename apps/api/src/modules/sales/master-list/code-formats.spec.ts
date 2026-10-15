import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { countryFromCallingCode } from "../shared/countries.js";
import {
  DEFAULT_CODE_FORMATS,
  formatCode,
  sequenceDocType,
} from "./code-formats.rules.js";
import { CodeFormatsService } from "./code-formats.service.js";

describe("code format rules", () => {
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
    await expect(service.findAll()).resolves.toEqual([
      {
        codeType: "customer",
        prefix: "CUS",
        padding: 3,
        isDefault: true,
        updatedAt: null,
        example: "CUS-IN-001",
      },
    ]);
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
