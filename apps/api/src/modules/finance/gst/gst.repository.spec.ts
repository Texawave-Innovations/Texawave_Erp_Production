import { describe, expect, it, vi } from "vitest";
import { GstRepository } from "./gst.repository.js";
import type { QueryGstEntriesDto } from "./dto/query-gst-entries.dto.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };

function makeRepository() {
  const financeGstEntry = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1, organizationId: 10 }),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const prisma = {
    financeGstEntry,
  };

  const repository = new GstRepository(prisma as never);
  return { repository, financeGstEntry };
}

describe("GstRepository", () => {
  describe("@OrgScoped() validation", () => {
    it("throws synchronously if called without a valid OrgScope", () => {
      const { repository } = makeRepository();
      // @ts-expect-error Testing invalid runtime scope
      expect(() => repository.findById(null, 1)).toThrow(
        /called without a valid OrgScope/,
      );
      // @ts-expect-error Testing undefined runtime scope
      expect(() => repository.getPeriodEntries(undefined, "2026-10")).toThrow(
        /called without a valid OrgScope/,
      );
      // @ts-expect-error Testing empty object scope
      expect(() => repository.updateStatus({}, 1, "FILED")).toThrow(
        /called without a valid OrgScope/,
      );
    });
  });

  describe("create", () => {
    it("injects scope.organizationId into the created record", async () => {
      const { repository, financeGstEntry } = makeRepository();
      const input = {
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST" as const,
        sourceType: "SALES_INVOICE" as const,
        sourceReference: "INV-1001",
        taxableAmount: 10000,
        totalTaxAmount: 1800,
      };

      await repository.create(SCOPE_A, input as never);

      expect(financeGstEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...input,
            organizationId: 10,
          },
        }),
      );
    });
  });

  describe("findById", () => {
    it("scopes lookup to organizationId", async () => {
      const { repository, financeGstEntry } = makeRepository();
      await repository.findById(SCOPE_B, 42);

      expect(financeGstEntry.findFirst).toHaveBeenCalledWith({
        where: {
          id: 42,
          organizationId: 20,
        },
      });
    });
  });

  describe("findMany", () => {
    it("applies query filters and pagination within tenant boundary", async () => {
      const { repository, financeGstEntry } = makeRepository();
      const query: QueryGstEntriesDto = {
        page: 1,
        limit: 15,
        skip: 0,
        period: "2026-10",
        entryType: "OUTPUT_GST",
        status: "ACTIVE",
        hsnSacCode: "998314",
      };

      await repository.findMany(SCOPE_A, query);

      expect(financeGstEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            period: "2026-10",
            entryType: "OUTPUT_GST",
            status: "ACTIVE",
            hsnSacCode: "998314",
          },
          skip: 0,
          take: 15,
        }),
      );
    });
  });

  describe("getPeriodEntries", () => {
    it("retrieves entries for the period, excluding CANCELLED", async () => {
      const { repository, financeGstEntry } = makeRepository();
      await repository.getPeriodEntries(SCOPE_A, "2026-10", "INPUT_TAX_CREDIT");

      expect(financeGstEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            period: "2026-10",
            entryType: "INPUT_TAX_CREDIT",
            status: { not: "CANCELLED" },
          },
        }),
      );
    });
  });

  describe("markReconciled", () => {
    it("updates matching ids to RECONCILED under tenant scope", async () => {
      const { repository, financeGstEntry } = makeRepository();
      const count = await repository.markReconciled(SCOPE_A, [101, 102]);

      expect(financeGstEntry.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 10,
          id: { in: [101, 102] },
        },
        data: { status: "RECONCILED" },
      });
      expect(count).toBe(1);
    });

    it("returns 0 early if ids array is empty without touching database", async () => {
      const { repository, financeGstEntry } = makeRepository();
      const count = await repository.markReconciled(SCOPE_A, []);

      expect(financeGstEntry.updateMany).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });
});
