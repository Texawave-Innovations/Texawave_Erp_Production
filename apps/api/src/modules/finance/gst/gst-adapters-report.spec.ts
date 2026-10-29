import { describe, expect, it, vi } from "vitest";
import { GstService } from "./gst.service.js";
import type {
  ISalesTransactionSource,
  SalesTaxTransaction,
} from "../integration/contracts/sales-transaction.contract.js";
import type {
  IPurchasesTransactionSource,
  PurchaseTaxTransaction,
} from "../integration/contracts/purchases-transaction.contract.js";
import type {
  IMasterListSource,
  HsnMasterDetails,
} from "../integration/contracts/master-list.contract.js";

const SCOPE = { organizationId: 1 };

function makeServiceWithAdapters(options?: {
  salesTx?: SalesTaxTransaction[];
  purchaseTx?: PurchaseTaxTransaction[];
  hsnMaster?: Record<string, HsnMasterDetails>;
}) {
  const repository = {
    getPeriodEntries: vi.fn().mockResolvedValue([]),
    getEntriesByDateRange: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    updateStatus: vi.fn(),
    markReconciled: vi.fn(),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(1),
  };

  const masterListSource: IMasterListSource = {
    lookupHsnSac: vi.fn().mockImplementation((_scope, code: string) => {
      return Promise.resolve(options?.hsnMaster?.[code] ?? null);
    }),
    getHsnDirectory: vi.fn().mockResolvedValue([]),
  };

  const salesSource: ISalesTransactionSource = {
    getPostedSalesTransactions: vi
      .fn()
      .mockResolvedValue(options?.salesTx ?? []),
    getSalesTransactionByReference: vi.fn().mockResolvedValue(null),
  };

  const purchasesSource: IPurchasesTransactionSource = {
    getInwardTaxTransactions: vi
      .fn()
      .mockResolvedValue(options?.purchaseTx ?? []),
    getPurchaseTransactionByReference: vi.fn().mockResolvedValue(null),
  };

  const service = new GstService(
    repository as never,
    tenantContext as never,
    masterListSource,
    salesSource,
    purchasesSource,
  );

  return {
    service,
    repository,
    masterListSource,
    salesSource,
    purchasesSource,
  };
}

describe("GstService with Integration Adapters", () => {
  describe("getHsnSummary with MasterListSource enrichment", () => {
    it("enriches HSN/SAC summary rows with descriptions and UOM from MasterListSource", async () => {
      const hsnMaster: Record<string, HsnMasterDetails> = {
        "847130": {
          hsnSacCode: "847130",
          type: "HSN",
          description: "Portable digital computers and laptops",
          defaultTaxRate: 18,
          uom: "NOS",
          isActive: true,
        },
      };

      const { service, repository } = makeServiceWithAdapters({ hsnMaster });

      repository.getPeriodEntries.mockResolvedValueOnce([
        {
          id: 1,
          hsnSacCode: "847130",
          taxableAmount: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          totalTaxAmount: 18000,
          isProformaExcluded: false,
          status: "ACTIVE",
        },
      ]);

      const report = await service.getHsnSummary({ period: "2026-10" });

      expect(report.items).toHaveLength(1);
      const item = report.items[0]!;
      expect(item.hsnSacCode).toBe("847130");
      expect(item.description).toBe("Portable digital computers and laptops");
      expect(item.uom).toBe("NOS");
      expect(item.taxableAmount).toBe(100000);
      expect(item.totalTaxAmount).toBe(18000);
    });
  });

  describe("getNetTaxPosition", () => {
    it("calculates outward tax liability, eligible ITC, ineligible ITC, and net tax payable", async () => {
      const salesTx: SalesTaxTransaction[] = [
        {
          id: 1,
          documentNumber: "INV-2026-001",
          documentDate: "2026-10-15",
          period: "2026-10",
          status: "POSTED",
          customerName: "Client A",
          isB2B: true,
          isInterState: false,
          currency: "INR",
          subtotal: 100000,
          taxAmount: 18000,
          totalAmount: 118000,
          isProformaExcluded: false,
          lines: [
            {
              lineOrder: 1,
              description: "Services",
              unitPrice: 100000,
              taxableAmount: 100000,
              taxRate: 18,
              cgstAmount: 9000,
              sgstAmount: 9000,
              igstAmount: 0,
              totalTaxAmount: 18000,
            },
          ],
        },
      ];

      const purchaseTx: PurchaseTaxTransaction[] = [
        {
          id: 10,
          documentNumber: "BILL-001",
          supplierBillNumber: "SUPP-INV-1",
          documentDate: "2026-10-12",
          period: "2026-10",
          status: "POSTED",
          supplierName: "Registered Vendor",
          supplierGstin: "29AAAAA0000A1Z5",
          isRegisteredVendor: true,
          isInterState: false,
          currency: "INR",
          subtotal: 40000,
          taxAmount: 7200,
          totalAmount: 47200,
          isItcEligible: true, // Eligible ITC
          inwardSourceType: "SUPPLIER_BILL",
          lines: [
            {
              lineOrder: 1,
              description: "Hardware",
              taxableAmount: 40000,
              taxRate: 18,
              cgstAmount: 3600,
              sgstAmount: 3600,
              igstAmount: 0,
              totalTaxAmount: 7200,
              isItcEligible: true,
            },
          ],
        },
        {
          id: 11,
          documentNumber: "BILL-002",
          documentDate: "2026-10-14",
          period: "2026-10",
          status: "POSTED",
          supplierName: "Unregistered Vendor",
          supplierGstin: null,
          isRegisteredVendor: false,
          isInterState: false,
          currency: "INR",
          subtotal: 10000,
          taxAmount: 500,
          totalAmount: 10500,
          isItcEligible: false, // Ineligible ITC (unregistered or uneligible)
          inwardSourceType: "SUPPLIER_BILL",
          lines: [],
        },
      ];

      const { service } = makeServiceWithAdapters({ salesTx, purchaseTx });

      const report = await service.getNetTaxPosition({ period: "2026-10" });

      // Outward: 18000 (CGST: 9000, SGST: 9000)
      expect(report.outwardTaxLiability.totalTaxAmount).toBe(18000);
      expect(report.outwardTaxLiability.cgstAmount).toBe(9000);
      expect(report.outwardTaxLiability.sgstAmount).toBe(9000);

      // Inward Recorded Tax: 7200 + 500 = 7700
      expect(report.inwardRecordedTax.totalTaxAmount).toBe(7700);

      // Eligible ITC: 7200 (CGST: 3600, SGST: 3600)
      expect(report.eligibleItc.totalTaxAmount).toBe(7200);
      expect(report.eligibleItc.cgstAmount).toBe(3600);
      expect(report.eligibleItc.sgstAmount).toBe(3600);

      // Ineligible ITC: 500
      expect(report.ineligibleItc.totalTaxAmount).toBe(500);

      // Net Tax Payable: Outward (18000) - Eligible ITC (7200) = 10800
      // CGST: 9000 - 3600 = 5400
      // SGST: 9000 - 3600 = 5400
      expect(report.netTaxPayable.totalTaxAmount).toBe(10800);
      expect(report.netTaxPayable.cgstAmount).toBe(5400);
      expect(report.netTaxPayable.sgstAmount).toBe(5400);
    });

    it("falls back to GST repository if integration adapters are not injected", async () => {
      const repository = {
        getPeriodEntries: vi.fn().mockResolvedValue([
          {
            id: 1,
            entryType: "OUTPUT_GST",
            taxableAmount: 10000,
            cgstAmount: 900,
            sgstAmount: 900,
            igstAmount: 0,
            totalTaxAmount: 1800,
            status: "ACTIVE",
            isProformaExcluded: false,
          },
          {
            id: 2,
            entryType: "INPUT_TAX_CREDIT",
            taxableAmount: 5000,
            cgstAmount: 450,
            sgstAmount: 450,
            igstAmount: 0,
            totalTaxAmount: 900,
            status: "ACTIVE",
            isProformaExcluded: false,
          },
        ]),
        getEntriesByDateRange: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        findById: vi.fn(),
        findMany: vi.fn(),
        updateStatus: vi.fn(),
        markReconciled: vi.fn(),
      };

      const tenantContext = {
        getOrgScope: vi.fn().mockReturnValue(SCOPE),
        getUserId: vi.fn().mockReturnValue(1),
      };

      // Service instantiated without optional adapters
      const service = new GstService(
        repository as never,
        tenantContext as never,
      );

      const report = await service.getNetTaxPosition({ period: "2026-10" });

      expect(report.outwardTaxLiability.totalTaxAmount).toBe(1800);
      expect(report.eligibleItc.totalTaxAmount).toBe(900);
      expect(report.netTaxPayable.totalTaxAmount).toBe(900);
    });
  });
});
