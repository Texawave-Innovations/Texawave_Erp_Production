import { describe, expect, it, vi } from "vitest";
import { PurchasesSourceAdapter } from "./purchases-source.adapter.js";

const SCOPE = { organizationId: 1 };

function makeAdapter() {
  const prisma = {
    scmSupplierBill: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    financeExpense: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    financeGstEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  const adapter = new PurchasesSourceAdapter(prisma as never);
  return { adapter, prisma };
}

describe("PurchasesSourceAdapter", () => {
  describe("getInwardTaxTransactions", () => {
    it("maps posted Supplier Bills to PurchaseTaxTransaction contract and flags eligible ITC", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSupplierBill.findMany.mockResolvedValueOnce([
        {
          id: 201,
          billNumber: "TW/BILL/001",
          supplierBillNumber: "VEND-INV-88",
          billDate: new Date("2026-10-18T10:00:00.000Z"),
          status: "POSTED",
          supplierId: 12,
          isItcEligible: true,
          supplier: {
            name: "Dell Technologies India",
            gstin: "29AAACD1234E1Z1",
          },
          subtotal: 50000,
          taxAmount: 9000,
          totalAmount: 59000,
          purchaseOrder: {
            items: [
              {
                id: 1,
                productId: 8,
                quantity: 1,
                unitPrice: 50000,
                taxRate: 18,
                taxAmount: 9000,
                product: {
                  name: "PowerEdge Server",
                  description: "Rackmount server",
                  hsn: "8471",
                  uom: "NOS",
                },
              },
            ],
          },
        },
      ]);

      const results = await adapter.getInwardTaxTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      const tx = results[0]!;
      expect(tx.documentNumber).toBe("TW/BILL/001");
      expect(tx.supplierBillNumber).toBe("VEND-INV-88");
      expect(tx.isItcEligible).toBe(true);
      expect(tx.subtotal).toBe(50000);
      expect(tx.taxAmount).toBe(9000);
      expect(tx.inwardSourceType).toBe("SUPPLIER_BILL");
      expect(tx.lines).toHaveLength(1);
      expect(tx.lines[0]!.hsnSacCode).toBe("8471");
    });

    it("STATUTORY RULE: Purchase Orders alone do NOT generate inward ITC transactions", async () => {
      const { adapter, prisma } = makeAdapter();

      // No posted bills, no paid expenses, only an unfulfilled PO (which is not queried)
      prisma.scmSupplierBill.findMany.mockResolvedValueOnce([]);
      prisma.financeExpense.findMany.mockResolvedValueOnce([]);
      prisma.financeGstEntry.findMany.mockResolvedValueOnce([]);

      const results = await adapter.getInwardTaxTransactions(SCOPE, {
        period: "2026-10",
      });

      // Assert that without confirmed bills or expenses, 0 transactions are returned
      expect(results).toHaveLength(0);
    });

    it("maps paid Finance Expenses with valid vendor GSTIN to inward purchase transactions", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSupplierBill.findMany.mockResolvedValueOnce([]);
      prisma.financeExpense.findMany.mockResolvedValueOnce([
        {
          id: 5,
          expenseNumber: "EXP-2026-005",
          expenseDate: new Date("2026-10-14"),
          payee: "AWS Cloud Services",
          vendorGstin: "29AABCA1234D1ZP",
          subtotal: 10000,
          taxAmount: 1800,
          totalAmount: 11800,
          status: "PAID",
          isItcEligible: true,
          hsnSacCode: "998315",
          description: "Cloud computing and hosting fees",
        },
      ]);

      const results = await adapter.getInwardTaxTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      const tx = results[0]!;
      expect(tx.documentNumber).toBe("EXP-2026-005");
      expect(tx.supplierName).toBe("AWS Cloud Services");
      expect(tx.supplierGstin).toBe("29AABCA1234D1ZP");
      expect(tx.isItcEligible).toBe(true);
      expect(tx.inwardSourceType).toBe("EXPENSE");
      expect(tx.lines[0]!.hsnSacCode).toBe("998315");
    });

    it("marks isItcEligible false if vendor GSTIN is missing (unregistered vendor)", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSupplierBill.findMany.mockResolvedValueOnce([
        {
          id: 202,
          billNumber: "TW/BILL/002",
          supplierBillNumber: "LOCAL-CASH-1",
          billDate: new Date("2026-10-19"),
          status: "POSTED",
          supplierId: 13,
          isItcEligible: true, // Marked eligible on bill, but unregistered supplier!
          supplier: {
            name: "Local Hardware Store",
            gstin: null, // Unregistered!
          },
          subtotal: 2000,
          taxAmount: 100,
          totalAmount: 2100,
          purchaseOrder: null,
        },
      ]);

      const results = await adapter.getInwardTaxTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
      // Under statutory rules, input tax cannot be claimed if vendor lacks GSTIN
      expect(results[0]!.isItcEligible).toBe(false);
    });

    it("deduplicates across supplier bills, expenses, and GST ledger entries", async () => {
      const { adapter, prisma } = makeAdapter();

      prisma.scmSupplierBill.findMany.mockResolvedValueOnce([
        {
          id: 1,
          billNumber: "BILL-DUPE-01",
          supplierBillNumber: "SUPP-INV-99",
          billDate: new Date("2026-10-05"),
          status: "POSTED",
          supplier: { name: "Supplier A", gstin: "29AAAAA0000A1Z5" },
          subtotal: 4000,
          taxAmount: 720,
          totalAmount: 4720,
          isItcEligible: true,
          purchaseOrder: null,
        },
      ]);

      prisma.financeGstEntry.findMany.mockResolvedValueOnce([
        {
          id: 301,
          sourceReference: "SUPP-INV-99", // Same reference as supplier bill
          period: "2026-10",
          status: "ACTIVE",
          gstin: "29AAAAA0000A1Z5",
          taxableAmount: 4000,
          cgstAmount: 360,
          sgstAmount: 360,
          igstAmount: 0,
          totalTaxAmount: 720,
          hsnSacCode: "9983",
          isProformaExcluded: false,
          createdAt: new Date("2026-10-05"),
        },
      ]);

      const results = await adapter.getInwardTaxTransactions(SCOPE, {
        period: "2026-10",
      });

      expect(results).toHaveLength(1);
    });
  });
});
