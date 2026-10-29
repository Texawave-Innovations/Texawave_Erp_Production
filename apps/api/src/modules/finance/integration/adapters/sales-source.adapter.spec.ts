import { describe, expect, it, vi } from "vitest";
import { SalesSourceAdapter } from "./sales-source.adapter.js";

const SCOPE = { organizationId: 1 };

function makeAdapter() {
  const prisma = {
    scmSalesOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    financeGstEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  const adapter = new SalesSourceAdapter(prisma as never);
  return { adapter, prisma };
}

describe("SalesSourceAdapter", () => {
  describe("getPostedSalesTransactions", () => {
    it("maps SCM Sales Orders to SalesTaxTransaction contract with line-item tax details", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSalesOrder.findMany.mockResolvedValueOnce([
        {
          id: 101,
          orderNumber: "SO-2026-001",
          orderDate: new Date("2026-10-15T10:00:00.000Z"),
          status: "CONFIRMED",
          customerId: 20,
          customer: {
            name: "Alpha Corp",
            gstin: "29ABCDE1234F1Z5",
          },
          subtotal: 10000,
          taxAmount: 1800,
          totalAmount: 11800,
          items: [
            {
              id: 1,
              productId: 5,
              description: "ERP Software Subscription",
              salesQty: 2,
              unitPrice: 5000,
              taxRate: 18,
              taxAmount: 1800,
              product: {
                name: "ERP License",
                hsn: "998314",
                uom: "NOS",
              },
            },
          ],
        },
      ]);

      const results = await adapter.getPostedSalesTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      const tx = results[0]!;
      expect(tx.documentNumber).toBe("SO-2026-001");
      expect(tx.customerName).toBe("Alpha Corp");
      expect(tx.customerGstin).toBe("29ABCDE1234F1Z5");
      expect(tx.isB2B).toBe(true);
      expect(tx.subtotal).toBe(10000);
      expect(tx.taxAmount).toBe(1800);
      expect(tx.totalAmount).toBe(11800);
      expect(tx.lines).toHaveLength(1);
      expect(tx.lines[0]!.hsnSacCode).toBe("998314");
      expect(tx.lines[0]!.cgstAmount).toBe(900);
      expect(tx.lines[0]!.sgstAmount).toBe(900);
    });

    it("falls back to Finance GST Output entries when no duplicate SCM order exists", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSalesOrder.findMany.mockResolvedValueOnce([]);
      prisma.financeGstEntry.findMany.mockResolvedValueOnce([
        {
          id: 50,
          sourceReference: "TEXA/INV/009",
          period: "2026-10",
          status: "ACTIVE",
          gstin: "29XYZAB5678C1Z2",
          taxableAmount: 20000,
          cgstAmount: 1800,
          sgstAmount: 1800,
          igstAmount: 0,
          totalTaxAmount: 3600,
          hsnSacCode: "9983",
          isProformaExcluded: false,
          createdAt: new Date("2026-10-20"),
        },
      ]);

      const results = await adapter.getPostedSalesTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.documentNumber).toBe("TEXA/INV/009");
      expect(results[0]!.customerGstin).toBe("29XYZAB5678C1Z2");
      expect(results[0]!.subtotal).toBe(20000);
      expect(results[0]!.taxAmount).toBe(3600);
      expect(results[0]!.lines[0]!.hsnSacCode).toBe("9983");
    });

    it("deduplicates transactions so an order in both SCM and GST ledger is counted only once", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSalesOrder.findMany.mockResolvedValueOnce([
        {
          id: 1,
          orderNumber: "INV-COMMON-001",
          orderDate: new Date("2026-10-10"),
          status: "CONFIRMED",
          customer: { name: "Client 1", gstin: null },
          subtotal: 5000,
          taxAmount: 900,
          totalAmount: 5900,
          items: [],
        },
      ]);

      prisma.financeGstEntry.findMany.mockResolvedValueOnce([
        {
          id: 99,
          sourceReference: "INV-COMMON-001", // Duplicate reference
          period: "2026-10",
          status: "ACTIVE",
          gstin: "URP",
          taxableAmount: 5000,
          cgstAmount: 450,
          sgstAmount: 450,
          igstAmount: 0,
          totalTaxAmount: 900,
          hsnSacCode: null,
          isProformaExcluded: false,
          createdAt: new Date("2026-10-10"),
        },
      ]);

      const results = await adapter.getPostedSalesTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.documentNumber).toBe("INV-COMMON-001");
    });

    it("applies organization scope to prevent cross-tenant data leaks", async () => {
      const { adapter, prisma } = makeAdapter();

      await adapter.getPostedSalesTransactions(
        { organizationId: 42 },
        { period: "2026-10" },
      );

      const soCalls = prisma.scmSalesOrder.findMany.mock.calls as Array<
        [{ where?: { organizationId?: number } }]
      >;
      expect(soCalls[0]?.[0]?.where?.organizationId).toBe(42);

      const gstCalls = prisma.financeGstEntry.findMany.mock.calls as Array<
        [{ where?: { organizationId?: number } }]
      >;
      expect(gstCalls[0]?.[0]?.where?.organizationId).toBe(42);
    });
  });

  describe("getSalesTransactionByReference", () => {
    it("finds by reference from SCM order or fallback GST entry", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSalesOrder.findMany.mockResolvedValueOnce([
        {
          id: 77,
          orderNumber: "SO-TARGET-77",
          orderDate: new Date("2026-10-12"),
          status: "CONFIRMED",
          customer: { name: "Target Customer", gstin: "29AABCU9603R1ZM" },
          subtotal: 1000,
          taxAmount: 180,
          totalAmount: 1180,
          items: [],
        },
      ]);

      const tx = await adapter.getSalesTransactionByReference(
        SCOPE,
        "SO-TARGET-77",
      );
      expect(tx).not.toBeNull();
      expect(tx?.documentNumber).toBe("SO-TARGET-77");
      expect(tx?.customerName).toBe("Target Customer");
    });
  });
});
