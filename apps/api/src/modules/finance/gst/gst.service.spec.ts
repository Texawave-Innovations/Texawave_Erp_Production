import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { GstService } from "./gst.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 45;

function makeService() {
  const repository = {
    create: vi
      .fn()
      .mockImplementation((_scope, data) =>
        Promise.resolve({ id: 1, ...data }),
      ),
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getPeriodEntries: vi.fn().mockResolvedValue([]),
    getEntriesByDateRange: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(true),
    markReconciled: vi.fn().mockResolvedValue(1),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new GstService(repository as never, tenantContext as never);
  return { service, repository, tenantContext };
}

describe("GstService", () => {
  describe("createEntry", () => {
    it("throws BusinessRuleViolationException when tax components do not sum to totalTaxAmount", async () => {
      const { service } = makeService();

      await expect(
        service.createEntry({
          gstin: "29AABCT1332L1ZV",
          period: "2026-10",
          entryType: "OUTPUT_GST",
          sourceType: "SALES_INVOICE",
          sourceReference: "TEXA/INV/2026/001",
          taxableAmount: 10000,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          totalTaxAmount: 2500, // Mismatch: 900 + 900 != 2500
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("auto-detects proforma invoice references and sets isProformaExcluded to true", async () => {
      const { service, repository } = makeService();

      const created = await service.createEntry({
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "TEXA/PI/2026/004", // Proforma reference
        taxableAmount: 5000,
        cgstAmount: 450,
        sgstAmount: 450,
        igstAmount: 0,
      });

      expect(created.isProformaExcluded).toBe(true);
      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          sourceReference: "TEXA/PI/2026/004",
          isProformaExcluded: true,
          totalTaxAmount: 900,
        }),
      );
    });

    it("creates standard tax invoice entry with isProformaExcluded false", async () => {
      const { service, repository } = makeService();

      const created = await service.createEntry({
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "TEXA/INV/2026/001",
        taxableAmount: 10000,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        igstRate: 0,
        igstAmount: 0,
        totalTaxAmount: 1800,
      });

      expect(created.isProformaExcluded).toBe(false);
      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          gstin: "29AABCT1332L1ZV",
          isProformaExcluded: false,
          totalTaxAmount: 1800,
        }),
      );
    });
  });

  describe("getEntryById", () => {
    it("throws ResourceNotFoundException if entry does not exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValueOnce(null);

      await expect(service.getEntryById(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("returns entry when found", async () => {
      const { service, repository } = makeService();
      const mockEntry = { id: 10, sourceReference: "INV-10" };
      repository.findById.mockResolvedValueOnce(mockEntry);

      const res = await service.getEntryById(10);
      expect(res).toEqual(mockEntry);
    });
  });

  describe("getHsnSummary", () => {
    it("groups eligible items by HSN/SAC code and excludes proforma and cancelled entries", async () => {
      const { service, repository } = makeService();

      repository.getPeriodEntries.mockResolvedValueOnce([
        // Regular HSN 998314 entry 1
        {
          id: 1,
          hsnSacCode: "998314",
          taxableAmount: "10000.00",
          cgstAmount: "900.00",
          sgstAmount: "900.00",
          igstAmount: "0.00",
          totalTaxAmount: "1800.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // Regular HSN 998314 entry 2
        {
          id: 2,
          hsnSacCode: "998314",
          taxableAmount: "5000.00",
          cgstAmount: "450.00",
          sgstAmount: "450.00",
          igstAmount: "0.00",
          totalTaxAmount: "900.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // HSN 998313 entry
        {
          id: 3,
          hsnSacCode: "998313",
          taxableAmount: "8000.00",
          cgstAmount: "0.00",
          sgstAmount: "0.00",
          igstAmount: "1440.00",
          totalTaxAmount: "1440.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // Proforma invoice (must be excluded)
        {
          id: 4,
          hsnSacCode: "998314",
          taxableAmount: "20000.00",
          cgstAmount: "1800.00",
          sgstAmount: "1800.00",
          igstAmount: "0.00",
          totalTaxAmount: "3600.00",
          isProformaExcluded: true,
          status: "ACTIVE",
        },
        // Cancelled entry (must be excluded)
        {
          id: 5,
          hsnSacCode: "998314",
          taxableAmount: "4000.00",
          cgstAmount: "360.00",
          sgstAmount: "360.00",
          igstAmount: "0.00",
          totalTaxAmount: "720.00",
          isProformaExcluded: false,
          status: "CANCELLED",
        },
      ]);

      const result = await service.getHsnSummary({ period: "2026-10" });

      expect(result.items).toHaveLength(2);
      expect(result.totalRecords).toBe(3);

      const hsn998314 = result.items.find((i) => i.hsnSacCode === "998314");
      expect(hsn998314).toBeDefined();
      expect(hsn998314?.taxableAmount).toBe(15000);
      expect(hsn998314?.cgstAmount).toBe(1350);
      expect(hsn998314?.sgstAmount).toBe(1350);
      expect(hsn998314?.totalTaxAmount).toBe(2700);
      expect(hsn998314?.transactionCount).toBe(2);

      const hsn998313 = result.items.find((i) => i.hsnSacCode === "998313");
      expect(hsn998313).toBeDefined();
      expect(hsn998313?.taxableAmount).toBe(8000);
      expect(hsn998313?.igstAmount).toBe(1440);
      expect(hsn998313?.totalTaxAmount).toBe(1440);

      expect(result.totalTaxableAmount).toBe(23000);
      expect(result.totalTaxAmount).toBe(4140);
    });
  });

  describe("getGstr1Summary", () => {
    it("categorizes B2B vs B2C, calculates rate slabs, and excludes proforma vouchers", async () => {
      const { service, repository } = makeService();

      repository.getPeriodEntries.mockResolvedValueOnce([
        // B2B: Registered 15-character GSTIN, 18% GST (9% CGST + 9% SGST)
        {
          id: 1,
          gstin: "29AABCT1332L1ZV",
          taxableAmount: "10000.00",
          cgstRate: "9.00",
          cgstAmount: "900.00",
          sgstRate: "9.00",
          sgstAmount: "900.00",
          igstRate: "0.00",
          igstAmount: "0.00",
          totalTaxAmount: "1800.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // B2C: Unregistered consumer ("URP"), 18% GST
        {
          id: 2,
          gstin: "URP",
          taxableAmount: "2000.00",
          cgstRate: "9.00",
          cgstAmount: "180.00",
          sgstRate: "9.00",
          sgstAmount: "180.00",
          igstRate: "0.00",
          igstAmount: "0.00",
          totalTaxAmount: "360.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // B2B: 12% IGST interstate
        {
          id: 3,
          gstin: "33AAMCT4293K1ZU",
          taxableAmount: "5000.00",
          cgstRate: "0.00",
          cgstAmount: "0.00",
          sgstRate: "0.00",
          sgstAmount: "0.00",
          igstRate: "12.00",
          igstAmount: "600.00",
          totalTaxAmount: "600.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // Proforma invoice: must be excluded and counted
        {
          id: 4,
          gstin: "29AABCT1332L1ZV",
          taxableAmount: "25000.00",
          cgstRate: "9.00",
          cgstAmount: "2250.00",
          sgstRate: "9.00",
          sgstAmount: "2250.00",
          igstRate: "0.00",
          igstAmount: "0.00",
          totalTaxAmount: "4500.00",
          isProformaExcluded: true,
          status: "ACTIVE",
        },
      ]);

      const result = await service.getGstr1Summary({ period: "2026-10" });

      expect(result.period).toBe("2026-10");
      expect(result.totalInvoices).toBe(3);
      expect(result.proformaExcludedCount).toBe(1);

      // B2B totals (entries 1 and 3)
      expect(result.b2b.invoiceCount).toBe(2);
      expect(result.b2b.taxableAmount).toBe(15000);
      expect(result.b2b.totalTaxAmount).toBe(2400);

      // B2C totals (entry 2)
      expect(result.b2c.invoiceCount).toBe(1);
      expect(result.b2c.taxableAmount).toBe(2000);
      expect(result.b2c.totalTaxAmount).toBe(360);

      // Rate buckets
      expect(result.rateBuckets).toHaveLength(2);
      const rate12 = result.rateBuckets.find((r) => r.rate === 12);
      expect(rate12?.taxableAmount).toBe(5000);
      expect(rate12?.igstAmount).toBe(600);

      const rate18 = result.rateBuckets.find((r) => r.rate === 18);
      expect(rate18?.taxableAmount).toBe(12000);
      expect(rate18?.cgstAmount).toBe(1080);
      expect(rate18?.sgstAmount).toBe(1080);

      expect(result.totalTaxableAmount).toBe(17000);
      expect(result.totalTaxAmount).toBe(2760);
    });
  });

  describe("getGstr3bSummary", () => {
    it("aggregates outward liabilities and eligible ITC to compute net tax payable", async () => {
      const { service, repository } = makeService();

      repository.getPeriodEntries.mockResolvedValueOnce([
        // Outward liability: Sales Invoice
        {
          entryType: "OUTPUT_GST",
          taxableAmount: "50000.00",
          cgstAmount: "4500.00",
          sgstAmount: "4500.00",
          igstAmount: "0.00",
          totalTaxAmount: "9000.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
        // Inward ITC: Purchase Bill
        {
          entryType: "INPUT_TAX_CREDIT",
          taxableAmount: "20000.00",
          cgstAmount: "1800.00",
          sgstAmount: "1800.00",
          igstAmount: "0.00",
          totalTaxAmount: "3600.00",
          isProformaExcluded: false,
          status: "ACTIVE",
        },
      ]);

      const result = await service.getGstr3bSummary({ period: "2026-10" });

      expect(result.outwardTaxableSupplies.totalTaxAmount).toBe(9000);
      expect(result.eligibleItc.totalTaxAmount).toBe(3600);

      // Net payable: 4500 - 1800 = 2700 CGST and 2700 SGST -> 5400 Total
      expect(result.netTaxPayable.cgstAmount).toBe(2700);
      expect(result.netTaxPayable.sgstAmount).toBe(2700);
      expect(result.netTaxPayable.totalTaxAmount).toBe(5400);
    });
  });

  describe("reconcile (GST Reconciliation Engine)", () => {
    it("accurately classifies MATCHED, TAX_MISMATCH, MISSING_IN_PORTAL, and MISSING_IN_BOOKS", async () => {
      const { service, repository } = makeService();

      repository.getPeriodEntries.mockResolvedValueOnce([
        // Book 1: Perfectly matched with counterpart within 1.00 INR
        {
          id: 101,
          sourceReference: "BILL-2001",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: "10000.00",
          totalTaxAmount: "1800.00",
          status: "ACTIVE",
        },
        // Book 2: Tax mismatch (book says 1800, portal says 1200)
        {
          id: 102,
          sourceReference: "BILL-2002",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: "10000.00",
          totalTaxAmount: "1800.00",
          status: "ACTIVE",
        },
        // Book 3: Missing in Portal
        {
          id: 103,
          sourceReference: "BILL-2003",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: "5000.00",
          totalTaxAmount: "900.00",
          status: "ACTIVE",
        },
      ]);

      const counterpartEntries = [
        // Match for Book 1 (slight rounding 1800.50 vs 1800.00 -> diff 0.50 <= 1.00)
        {
          invoiceNumber: "BILL-2001",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: 10000,
          totalTaxAmount: 1800.5,
        },
        // Mismatch for Book 2
        {
          invoiceNumber: "BILL-2002",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: 10000,
          totalTaxAmount: 1200.0,
        },
        // Counterpart only: Missing in Books
        {
          invoiceNumber: "BILL-2099",
          gstin: "29AABCT1332L1ZV",
          taxableAmount: 7000,
          totalTaxAmount: 1260.0,
        },
      ];

      const result = await service.reconcile({
        period: "2026-10",
        persistReconciliation: true,
        counterpartEntries,
      });

      expect(result.matchedCount).toBe(1);
      expect(result.taxMismatchCount).toBe(1);
      expect(result.missingInPortalCount).toBe(1);
      expect(result.missingInBooksCount).toBe(1);

      // Verify persistence call was triggered for matched id 101
      expect(repository.markReconciled).toHaveBeenCalledWith(SCOPE, [101]);

      // Verify discrepancy items
      const mismatch = result.discrepancies.find(
        (d) => d.status === "TAX_MISMATCH",
      );
      expect(mismatch).toBeDefined();
      expect(mismatch?.invoiceReference).toBe("BILL-2002");
      expect(mismatch?.taxDifference).toBe(600);

      const missingInBooks = result.discrepancies.find(
        (d) => d.status === "MISSING_IN_BOOKS",
      );
      expect(missingInBooks).toBeDefined();
      expect(missingInBooks?.invoiceReference).toBe("BILL-2099");

      const missingInPortal = result.discrepancies.find(
        (d) => d.status === "MISSING_IN_PORTAL",
      );
      expect(missingInPortal).toBeDefined();
      expect(missingInPortal?.invoiceReference).toBe("BILL-2003");
    });
  });

  describe("getReconciliationSummary", () => {
    it("returns reconciliation stats and progress percentage", async () => {
      const { service, repository } = makeService();

      repository.getPeriodEntries.mockResolvedValueOnce([
        { id: 1, totalTaxAmount: "1000.00", status: "RECONCILED" },
        { id: 2, totalTaxAmount: "1000.00", status: "RECONCILED" },
        { id: 3, totalTaxAmount: "2000.00", status: "ACTIVE" },
      ]);

      const summary = await service.getReconciliationSummary("2026-10");

      expect(summary.totalEntries).toBe(3);
      expect(summary.reconciledCount).toBe(2);
      expect(summary.pendingCount).toBe(1);
      expect(summary.totalItcAmount).toBe(4000);
      expect(summary.reconciledItcAmount).toBe(2000);
      expect(summary.reconciliationPercentage).toBe(66.7);
    });
  });
});
