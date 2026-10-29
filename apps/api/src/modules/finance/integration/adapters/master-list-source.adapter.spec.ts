import { describe, expect, it, vi } from "vitest";
import { MasterListSourceAdapter } from "./master-list-source.adapter.js";

const SCOPE = { organizationId: 1 };

function makeAdapter() {
  const prisma = {
    scmProduct: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    financeMasterListItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const adapter = new MasterListSourceAdapter(prisma as never);
  return { adapter, prisma };
}

describe("MasterListSourceAdapter", () => {
  describe("lookupHsnSac", () => {
    it("looks up HSN details from SCM Product table when present", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmProduct.findFirst.mockResolvedValueOnce({
        hsn: "847130",
        name: "Laptop Pro 16",
        description: "High performance development workstation",
        uom: "NOS",
      });

      const result = await adapter.lookupHsnSac(SCOPE, "847130");

      expect(result).not.toBeNull();
      expect(result?.hsnSacCode).toBe("847130");
      expect(result?.type).toBe("HSN");
      expect(result?.description).toBe(
        "High performance development workstation",
      );
      expect(result?.uom).toBe("NOS");
    });

    it("looks up SAC details from Finance Master List Items when not in SCM products", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmProduct.findFirst.mockResolvedValueOnce(null);
      prisma.financeMasterListItem.findFirst.mockResolvedValueOnce({
        category: "SAC_CODE",
        value: "998311",
        numericValue: 18,
        customFields: {
          description: "Management consulting and advisory services",
          uom: "OTH",
        },
        isActive: true,
      });

      const result = await adapter.lookupHsnSac(SCOPE, "998311");

      expect(result).not.toBeNull();
      expect(result?.hsnSacCode).toBe("998311");
      expect(result?.type).toBe("SAC");
      expect(result?.description).toBe(
        "Management consulting and advisory services",
      );
      expect(result?.defaultTaxRate).toBe(18);
    });

    it("falls back to canonical statutory GST directory when code is not in database", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmProduct.findFirst.mockResolvedValueOnce(null);
      prisma.financeMasterListItem.findFirst.mockResolvedValueOnce(null);

      const result = await adapter.lookupHsnSac(SCOPE, "9983");

      expect(result).not.toBeNull();
      expect(result?.hsnSacCode).toBe("9983");
      expect(result?.type).toBe("SAC");
      expect(result?.description).toContain("Information technology");
      expect(result?.defaultTaxRate).toBe(18);
    });

    it("returns null for empty or non-existent code with no fallback", async () => {
      const { adapter } = makeAdapter();
      const result = await adapter.lookupHsnSac(SCOPE, "   ");
      expect(result).toBeNull();
    });
  });

  describe("getHsnDirectory", () => {
    it("returns directory aggregating database entries and canonical chapters", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmProduct.findMany.mockResolvedValueOnce([
        {
          hsn: "8471",
          name: "Server",
          description: "Enterprise Server",
          uom: "NOS",
        },
      ]);
      prisma.financeMasterListItem.findMany.mockResolvedValueOnce([]);

      const directory = await adapter.getHsnDirectory(SCOPE);

      expect(directory.length).toBeGreaterThan(0);
      const found8471 = directory.find((d) => d.hsnSacCode === "8471");
      expect(found8471).toBeDefined();
    });
  });
});
