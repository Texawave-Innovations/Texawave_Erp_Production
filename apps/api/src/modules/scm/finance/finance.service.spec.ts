import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { FinanceService } from "./finance.service.js";
import type { PostPurchaseBillDto } from "../../finance/integration/dto/post-purchase-bill.dto.js";
import type { QueryBillDto } from "./dto/finance.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 50;

interface MockFinanceRepo {
  findBills: ReturnType<typeof vi.fn>;
  findBill: ReturnType<typeof vi.fn>;
  findBillForPosting: ReturnType<typeof vi.fn>;
  createBill: ReturnType<typeof vi.fn>;
  updateBill: ReturnType<typeof vi.fn>;
  cancelBill: ReturnType<typeof vi.fn>;
  supplierSummary: ReturnType<typeof vi.fn>;
}

interface MockSuppliers {
  findOne: ReturnType<typeof vi.fn>;
}

interface MockTenantContext {
  getOrgScope: () => { organizationId: number };
  getUserId: () => number;
}

interface MockFiles {
  save: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

interface MockMasterListGuard {
  assertValid: ReturnType<typeof vi.fn>;
}

interface MockIntegration {
  postPurchaseBill: ReturnType<
    typeof vi.fn<
      (dto: PostPurchaseBillDto) => Promise<{
        success: boolean;
        documentReference: string;
        journalEntryId: number;
        journalEntryNumber: string;
        gstEntryId: number;
        message: string;
      }>
    >
  >;
  cancelPurchaseBill: ReturnType<typeof vi.fn>;
}

interface MockPrisma {
  payrollSetting: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  financeJournalEntry: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  financeGstEntry: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

describe("FinanceService — Supplier Bills Posting & Finance/GST Integration", () => {
  let service: FinanceService;
  let mockRepo: MockFinanceRepo;
  let mockSuppliers: MockSuppliers;
  let mockTenantContext: MockTenantContext;
  let mockFiles: MockFiles;
  let mockMasterListGuard: MockMasterListGuard;
  let mockIntegration: MockIntegration;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockRepo = {
      findBills: vi.fn(),
      findBill: vi.fn(),
      findBillForPosting: vi.fn(),
      createBill: vi.fn(),
      updateBill: vi.fn(),
      cancelBill: vi.fn(),
      supplierSummary: vi.fn(),
    };

    mockSuppliers = {
      findOne: vi.fn(),
    };

    mockTenantContext = {
      getOrgScope: () => SCOPE,
      getUserId: () => USER_ID,
    };

    mockFiles = {
      save: vi.fn(),
      read: vi.fn(),
      remove: vi.fn(),
    };

    mockMasterListGuard = {
      assertValid: vi.fn().mockResolvedValue(undefined),
    };

    mockIntegration = {
      postPurchaseBill: vi.fn().mockResolvedValue({
        success: true,
        documentReference: "SUPP-INV-8891",
        journalEntryId: 301,
        journalEntryNumber: "JV-2026-0301",
        gstEntryId: 401,
        message: "Purchase bill successfully posted to Finance.",
      }),
      cancelPurchaseBill: vi.fn().mockResolvedValue({
        success: true,
        documentReference: "SUPP-INV-8891",
        journalEntryId: 301,
        reversalJournalEntryId: 302,
        message: "Purchase bill reversed.",
      }),
    };

    mockPrisma = {
      payrollSetting: {
        findFirst: vi.fn().mockResolvedValue({
          companyGstin: "29AAACT9999K1ZV", // Karnataka (State 29)
        }),
      },
      financeJournalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      financeGstEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    service = new FinanceService(
      mockRepo as never,
      mockSuppliers as never,
      mockTenantContext as never,
      mockFiles as never,
      mockMasterListGuard as never,
      mockIntegration as never,
      mockPrisma as never,
    );
  });

  describe("postBillToFinance() validation and lifecycle", () => {
    it("rejects non-existent bill with ResourceNotFoundException", async () => {
      mockRepo.findBillForPosting.mockResolvedValue(null);

      await expect(service.postBillToFinance(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("rejects CANCELLED bill with BusinessRuleViolationException (BILL_CANCELLED)", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 10,
        billNumber: "TW/BILL/0010",
        status: "CANCELLED",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
      });

      await expect(service.postBillToFinance(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("successfully posts an OPEN supplier bill to Finance and GST", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 11,
        billNumber: "TW/BILL/0011",
        supplierBillNumber: "SUPP-INV-8891",
        billDate: new Date("2026-10-20"),
        supplierId: 5,
        currency: "INR",
        subtotal: 20000,
        taxAmount: 3600,
        total: 23600,
        status: "OPEN",
        notes: "Monthly raw material supply",
        supplier: {
          id: 5,
          supplierCode: "SUP-005",
          companyName: "Acme Industrial Supplies",
          gstin: "29AABCT1332L1ZV", // Karnataka (same state)
          state: "Karnataka",
        },
        purchaseOrder: null,
      });

      const result = await service.postBillToFinance(11);

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBe(301);
      expect(result.gstEntryId).toBe(401);
      expect(mockIntegration.postPurchaseBill).toHaveBeenCalledTimes(1);

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.billNumber).toBe("TW/BILL/0011");
      expect(payload.supplierBillNumber).toBe("SUPP-INV-8891");
      expect(payload.supplierName).toBe("Acme Industrial Supplies");
      expect(payload.subtotal).toBe(20000);
      expect(payload.taxAmount).toBe(3600);
      expect(payload.total).toBe(23600);
      // Intra-state: CGST + SGST split
      expect(payload.cgstAmount).toBe(1800);
      expect(payload.sgstAmount).toBe(1800);
      expect(payload.igstAmount).toBe(0);
      expect(payload.isItcEligible).toBe(true);
    });
  });

  describe("Tax jurisdiction determination (Intra-state vs Inter-state)", () => {
    it("determines INTRA_STATE (CGST + SGST) when supplier state matches company state", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 12,
        billNumber: "TW/BILL/0012",
        supplierBillNumber: "INV-100",
        billDate: new Date("2026-10-21"),
        supplierId: 5,
        currency: "INR",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        status: "OPEN",
        supplier: {
          id: 5,
          companyName: "Local Vendor",
          gstin: "29BBBBB0000A1Z5", // State 29
        },
      });

      await service.postBillToFinance(12);

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.cgstAmount).toBe(900);
      expect(payload.sgstAmount).toBe(900);
      expect(payload.igstAmount).toBe(0);
    });

    it("determines INTER_STATE (IGST) when supplier state differs from company state", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 13,
        billNumber: "TW/BILL/0013",
        supplierBillNumber: "INV-200",
        billDate: new Date("2026-10-21"),
        supplierId: 6,
        currency: "INR",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        status: "OPEN",
        supplier: {
          id: 6,
          companyName: "Interstate Vendor",
          gstin: "33AAAAA1111B1Z9", // Tamil Nadu (State 33 != 29)
        },
      });

      await service.postBillToFinance(13);

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.cgstAmount).toBe(0);
      expect(payload.sgstAmount).toBe(0);
      expect(payload.igstAmount).toBe(1800);
    });

    it("respects explicit jurisdiction override from DTO", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 14,
        billNumber: "TW/BILL/0014",
        supplierBillNumber: "INV-300",
        billDate: new Date("2026-10-21"),
        supplierId: 6,
        currency: "INR",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        status: "OPEN",
        supplier: {
          id: 6,
          companyName: "Interstate Vendor",
          gstin: "33AAAAA1111B1Z9",
        },
      });

      await service.postBillToFinance(14, { jurisdiction: "INTRA_STATE" });

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.cgstAmount).toBe(900);
      expect(payload.sgstAmount).toBe(900);
      expect(payload.igstAmount).toBe(0);
    });
  });

  describe("Multi-line HSN and Tax Rate Slabs grouping", () => {
    it("groups PO line items by HSN and tax rate when bill is linked to a PO", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 15,
        billNumber: "TW/BILL/0015",
        supplierBillNumber: "PO-BILL-001",
        billDate: new Date("2026-10-22"),
        supplierId: 7,
        purchaseOrderId: 3,
        currency: "INR",
        subtotal: 15000,
        taxAmount: 2280,
        total: 17280,
        status: "OPEN",
        supplier: {
          id: 7,
          companyName: "Hardware Distributor",
          gstin: "29CCCCC2222C1Z8", // Intra-state
        },
        purchaseOrder: {
          id: 3,
          poNumber: "PO-2026-003",
          items: [
            {
              id: 1,
              lineNo: 1,
              quantity: 10,
              unitPrice: 1000, // 10,000 taxable
              taxRate: 18,
              taxAmount: 1800,
              total: 11800,
              product: { hsn: "847130" },
            },
            {
              id: 2,
              lineNo: 2,
              quantity: 5,
              unitPrice: 1000, // 5,000 taxable
              taxRate: 12,
              taxAmount: 480,
              total: 5480,
              product: { hsn: "852351" },
            },
          ],
        },
      });

      await service.postBillToFinance(15);

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.taxItems).toBeDefined();
      expect(payload.taxItems).toHaveLength(2);

      const item1 = payload.taxItems![0]!;
      expect(item1.hsnSacCode).toBe("847130");
      expect(item1.taxableAmount).toBe(10000);
      expect(item1.taxRate).toBe(18);
      expect(item1.cgstAmount).toBe(900);
      expect(item1.sgstAmount).toBe(900);

      const item2 = payload.taxItems![1]!;
      expect(item2.hsnSacCode).toBe("852351");
      expect(item2.taxableAmount).toBe(5000);
      expect(item2.taxRate).toBe(12);
      expect(item2.cgstAmount).toBe(240);
      expect(item2.sgstAmount).toBe(240);
    });
  });

  describe("Ineligible ITC handling", () => {
    it("passes isItcEligible: false to integration service when marked ineligible", async () => {
      mockRepo.findBillForPosting.mockResolvedValue({
        id: 16,
        billNumber: "TW/BILL/0016",
        supplierBillNumber: "BLOCKED-001",
        billDate: new Date("2026-10-23"),
        supplierId: 8,
        currency: "INR",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        status: "OPEN",
        supplier: {
          id: 8,
          companyName: "Motor Vehicles Dealer",
          gstin: "29DDDDD3333D1Z7",
        },
      });

      await service.postBillToFinance(16, { isItcEligible: false });

      const payload = mockIntegration.postPurchaseBill.mock.calls[0]![0];
      expect(payload.isItcEligible).toBe(false);
    });
  });

  describe("Cancellation & reversal integration", () => {
    it("calls cancelPurchaseBill and cancels the bill in SCM", async () => {
      mockRepo.findBill.mockResolvedValue({
        id: 17,
        billNumber: "TW/BILL/0017",
        supplierBillNumber: "SUPP-INV-CANCEL",
        status: "OPEN",
        total: 5000,
        paidAmount: 0,
      });

      mockRepo.cancelBill.mockResolvedValue({
        id: 17,
        billNumber: "TW/BILL/0017",
        status: "CANCELLED",
      });

      const res = await service.cancelBill(17, "Incorrect invoice details");

      expect(mockIntegration.cancelPurchaseBill).toHaveBeenCalledWith(
        {
          documentReference: "SUPP-INV-CANCEL",
          reason: "Incorrect invoice details",
        },
        USER_ID,
      );
      expect(mockRepo.cancelBill).toHaveBeenCalledWith(
        SCOPE,
        17,
        "Incorrect invoice details",
        USER_ID,
      );
      expect(res?.status).toBe("CANCELLED");
    });
  });

  describe("listBills() and getBill() enrichment", () => {
    it("enriches bills list with isPosted: true and journal/gst metadata", async () => {
      mockRepo.findBills.mockResolvedValue({
        items: [
          {
            id: 20,
            billNumber: "TW/BILL/0020",
            supplierBillNumber: "INV-2020",
            total: 1000,
            paidAmount: 0,
          },
          {
            id: 21,
            billNumber: "TW/BILL/0021",
            supplierBillNumber: null,
            total: 2000,
            paidAmount: 0,
          },
        ],
        total: 2,
      });

      mockPrisma.financeJournalEntry.findMany.mockResolvedValue([
        {
          id: 501,
          entryNumber: "JV-2026-0501",
          referenceNumber: "INV-2020",
          postedAt: new Date("2026-10-24T10:00:00Z"),
        },
      ]);
      mockPrisma.financeGstEntry.findMany.mockResolvedValue([
        {
          id: 601,
          sourceReference: "INV-2020",
        },
      ]);

      const result = await service.listBills({
        page: 1,
        limit: 10,
      } as QueryBillDto);

      expect(result.items).toHaveLength(2);

      const bill1 = result.items[0]! as unknown as {
        isPosted: boolean;
        journalEntryId: number | null;
        journalEntryNumber: string | null;
        gstEntryId: number | null;
      };
      expect(bill1.isPosted).toBe(true);
      expect(bill1.journalEntryId).toBe(501);
      expect(bill1.journalEntryNumber).toBe("JV-2026-0501");
      expect(bill1.gstEntryId).toBe(601);

      const bill2 = result.items[1]! as unknown as {
        isPosted: boolean;
        journalEntryId: number | null;
        gstEntryId: number | null;
      };
      expect(bill2.isPosted).toBe(false);
      expect(bill2.journalEntryId).toBeNull();
      expect(bill2.gstEntryId).toBeNull();
    });

    it("enriches single getBill with isPosted metadata", async () => {
      mockRepo.findBill.mockResolvedValue({
        id: 25,
        billNumber: "TW/BILL/0025",
        supplierBillNumber: "INV-2025",
        total: 5000,
        paidAmount: 0,
      });

      mockPrisma.financeJournalEntry.findFirst.mockResolvedValue({
        id: 701,
        entryNumber: "JV-2026-0701",
        postedAt: new Date("2026-10-25T11:00:00Z"),
      });
      mockPrisma.financeGstEntry.findFirst.mockResolvedValue({
        id: 801,
      });

      const bill = await service.getBill(25);

      expect(bill.isPosted).toBe(true);
      expect(bill.journalEntryId).toBe(701);
      expect(bill.journalEntryNumber).toBe("JV-2026-0701");
      expect(bill.gstEntryId).toBe(801);
    });
  });
});
