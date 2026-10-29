import { describe, expect, it, vi, beforeEach } from "vitest";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { SalesOrdersService } from "./sales-orders.service.js";
import type {
  PostSalesInvoiceDto,
  PostSalesInvoiceTaxItemDto,
} from "../../finance/integration/dto/post-sales-invoice.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

interface MockSalesOrdersRepo {
  findMany: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  findOneForInvoicing: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  transition: ReturnType<typeof vi.fn>;
}

interface MockProducts {
  findOne: ReturnType<typeof vi.fn>;
}

interface MockTenantContext {
  getOrgScope: () => { organizationId: number };
  getUserId: () => number;
}

interface MockIntegrationService {
  postSalesInvoice: ReturnType<
    typeof vi.fn<
      (dto: PostSalesInvoiceDto) => Promise<{
        success: boolean;
        documentReference: string;
        journalEntryId: number;
        journalEntryNumber: string;
        gstEntryId: number;
        message: string;
      }>
    >
  >;
  cancelSalesInvoice: ReturnType<typeof vi.fn>;
}

interface MockNumbering {
  next: ReturnType<typeof vi.fn>;
}

interface MockPrisma {
  payrollSetting: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  financeGstEntry: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  financeJournalEntry: {
    findFirst: ReturnType<typeof vi.fn>;
  };
}

describe("SalesOrdersService — Invoice Issuance & Finance Integration", () => {
  let service: SalesOrdersService;
  let mockRepo: MockSalesOrdersRepo;
  let mockProducts: MockProducts;
  let mockTenantContext: MockTenantContext;
  let mockIntegrationService: MockIntegrationService;
  let mockNumbering: MockNumbering;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockRepo = {
      findMany: vi.fn(),
      findOne: vi.fn(),
      findOneForInvoicing: vi.fn(),
      create: vi.fn(),
      transition: vi.fn(),
    };

    mockProducts = {
      findOne: vi.fn(),
    };

    mockTenantContext = {
      getOrgScope: () => SCOPE,
      getUserId: () => USER_ID,
    };

    mockIntegrationService = {
      postSalesInvoice: vi.fn().mockResolvedValue({
        success: true,
        documentReference: "TW/INV/26-27/0001",
        journalEntryId: 101,
        journalEntryNumber: "JV-2026-0001",
        gstEntryId: 201,
        message: "Sales invoice successfully posted to Finance.",
      }),
      cancelSalesInvoice: vi.fn().mockResolvedValue({
        success: true,
        documentReference: "TW/INV/26-27/0001",
        journalEntryId: 101,
        reversalJournalEntryId: 102,
        message: "Document reversed.",
      }),
    };

    mockNumbering = {
      next: vi.fn().mockResolvedValue("TW/INV/26-27/0001"),
    };

    mockPrisma = {
      payrollSetting: {
        findFirst: vi.fn().mockResolvedValue({
          companyGstin: "29AAACT9999K1ZV", // Karnataka (State 29)
        }),
      },
      financeGstEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      financeJournalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    service = new SalesOrdersService(
      mockRepo as never,
      mockProducts as never,
      mockTenantContext as never,
      mockIntegrationService as never,
      mockNumbering as never,
      mockPrisma as never,
    );
  });

  describe("issueInvoice() lifecycle preconditions", () => {
    it("rejects non-existent sales order with ResourceNotFoundException", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue(null);

      await expect(service.issueInvoice(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("rejects DRAFT sales order with ORDER_NOT_CONFIRMED", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        status: "DRAFT",
        subtotal: 1000,
        taxAmount: 180,
        total: 1180,
        items: [{ id: 10 }],
      });

      await expect(service.issueInvoice(1)).rejects.toThrow(
        "Cannot issue tax invoice for an unconfirmed sales order. Please confirm the order first.",
      );
    });

    it("rejects CANCELLED sales order with ORDER_CANCELLED", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        status: "CANCELLED",
        subtotal: 1000,
        taxAmount: 180,
        total: 1180,
        items: [{ id: 10 }],
      });

      await expect(service.issueInvoice(1)).rejects.toThrow(
        "Cannot issue tax invoice for a cancelled sales order.",
      );
    });

    it("rejects order with zero or negative total", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        status: "CONFIRMED",
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        items: [{ id: 10 }],
      });

      await expect(service.issueInvoice(1)).rejects.toThrow(
        "Sales order total must be greater than zero to issue a tax invoice.",
      );
    });

    it("rejects order with empty line items", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        status: "CONFIRMED",
        subtotal: 1000,
        taxAmount: 180,
        total: 1180,
        items: [],
      });

      await expect(service.issueInvoice(1)).rejects.toThrow(
        "Sales order must contain at least one line item to issue a tax invoice.",
      );
    });

    it("rejects future invoice date", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        status: "CONFIRMED",
        subtotal: 1000,
        taxAmount: 180,
        total: 1180,
        items: [
          {
            salesQty: 1,
            unitPrice: 1000,
            taxRate: 18,
            product: { hsn: "8471" },
          },
        ],
      });

      await expect(
        service.issueInvoice(1, { invoiceDate: "2099-12-31" }),
      ).rejects.toThrow("Invoice date cannot be in the future.");
    });
  });

  describe("issueInvoice() idempotency", () => {
    it("returns existing posting details if invoice was already issued", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        soNumber: "TW/SO/26-27/0001",
        status: "CONFIRMED",
        subtotal: 1000,
        taxAmount: 180,
        total: 1180,
        items: [{ id: 10 }],
      });

      mockPrisma.financeGstEntry.findFirst.mockResolvedValue({
        id: 501,
        sourceReference: "TW/INV/26-27/0001",
        period: "2026-10",
      });

      mockPrisma.financeJournalEntry.findFirst.mockResolvedValue({
        id: 301,
        entryNumber: "JV-2026-0001",
      });

      const res = await service.issueInvoice(1);
      expect(res.alreadyIssued).toBe(true);
      expect(res.invoiceNumber).toBe("TW/INV/26-27/0001");
      expect(res.journalEntryId).toBe(301);
      expect(mockIntegrationService.postSalesInvoice).not.toHaveBeenCalled();
    });
  });

  describe("issueInvoice() tax routing & multi-line grouping", () => {
    it("correctly routes intra-state supplies (CGST 50% + SGST 50%) when customer is in same state", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 1,
        soNumber: "TW/SO/26-27/0001",
        status: "CONFIRMED",
        customerId: 10,
        customerName: "Bengaluru Tech Ltd",
        currency: "INR",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        customer: {
          gstin: "29AABCT1332L1ZV", // State 29 (matches company state 29)
        },
        items: [
          {
            salesQty: 10,
            unitPrice: 1000,
            taxRate: 18,
            product: { hsn: "847130" },
          },
        ],
      });

      const res = await service.issueInvoice(1);
      expect(res.success).toBe(true);
      expect(mockNumbering.next).toHaveBeenCalledWith(
        mockPrisma,
        SCOPE.organizationId,
        "taxInvoice",
      );

      expect(mockIntegrationService.postSalesInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: "TW/INV/26-27/0001",
          subtotal: 10000,
          taxAmount: 1800,
          total: 11800,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
          taxItems: [
            expect.objectContaining({
              hsnSacCode: "847130",
              taxableAmount: 10000,
              cgstAmount: 900,
              sgstAmount: 900,
              igstAmount: 0,
            }),
          ],
        }),
        USER_ID,
      );
    });

    it("correctly routes inter-state supplies (IGST 100%) when customer is in different state", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 2,
        soNumber: "TW/SO/26-27/0002",
        status: "CONFIRMED",
        customerId: 20,
        customerName: "Mumbai Enterprises Pvt Ltd",
        currency: "INR",
        subtotal: 20000,
        taxAmount: 3600,
        total: 23600,
        customer: {
          gstin: "27AABCM5555L1ZV", // State 27 (differs from company state 29)
        },
        items: [
          {
            salesQty: 2,
            unitPrice: 10000,
            taxRate: 18,
            product: { hsn: "847130" },
          },
        ],
      });

      const res = await service.issueInvoice(2);
      expect(res.success).toBe(true);

      expect(mockIntegrationService.postSalesInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 20000,
          taxAmount: 3600,
          total: 23600,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 3600,
          igstRate: 18,
          taxItems: [
            expect.objectContaining({
              hsnSacCode: "847130",
              taxableAmount: 20000,
              cgstAmount: 0,
              sgstAmount: 0,
              igstAmount: 3600,
              igstRate: 18,
            }),
          ],
        }),
        USER_ID,
      );
    });

    it("faithfully preserves multi-line items with distinct HSN and tax rates", async () => {
      mockRepo.findOneForInvoicing.mockResolvedValue({
        id: 3,
        soNumber: "TW/SO/26-27/0003",
        status: "CONFIRMED",
        customerId: 30,
        customerName: "Multi-item Client",
        currency: "INR",
        subtotal: 15000,
        taxAmount: 2280, // 1800 (18% on 10000) + 480 (12% on 4000) + 0 (0% on 1000)
        total: 17280,
        customer: {
          gstin: "29AABCC1111L1ZV",
        },
        items: [
          {
            salesQty: 10,
            unitPrice: 1000,
            taxRate: 18,
            product: { hsn: "847130" },
          },
          {
            salesQty: 4,
            unitPrice: 1000,
            taxRate: 12,
            product: { hsn: "998314" },
          },
          {
            salesQty: 1,
            unitPrice: 1000,
            taxRate: 0,
            product: { hsn: "490110" },
          },
        ],
      });

      const res = await service.issueInvoice(3);
      expect(res.success).toBe(true);

      const postCall =
        mockIntegrationService.postSalesInvoice.mock.calls[0]![0];
      expect(postCall.taxItems).toHaveLength(3);

      const hsn8471 = postCall.taxItems!.find(
        (i: PostSalesInvoiceTaxItemDto) => i.hsnSacCode === "847130",
      );
      expect(hsn8471).toBeDefined();
      expect(hsn8471!.taxableAmount).toBe(10000);
      expect(hsn8471!.totalTaxAmount).toBe(1800);
      expect(hsn8471!.cgstAmount).toBe(900);
      expect(hsn8471!.sgstAmount).toBe(900);

      const hsn9983 = postCall.taxItems!.find(
        (i: PostSalesInvoiceTaxItemDto) => i.hsnSacCode === "998314",
      );
      expect(hsn9983).toBeDefined();
      expect(hsn9983!.taxableAmount).toBe(4000);
      expect(hsn9983!.totalTaxAmount).toBe(480);
      expect(hsn9983!.cgstAmount).toBe(240);
      expect(hsn9983!.sgstAmount).toBe(240);

      const hsn4901 = postCall.taxItems!.find(
        (i: PostSalesInvoiceTaxItemDto) => i.hsnSacCode === "490110",
      );
      expect(hsn4901).toBeDefined();
      expect(hsn4901!.taxableAmount).toBe(1000);
      expect(hsn4901!.totalTaxAmount).toBe(0);
    });
  });

  describe("cancel() invoice reversal workflow", () => {
    it("automatically triggers GL reversal and GST cancellation when cancelling an invoiced order", async () => {
      mockPrisma.financeGstEntry.findFirst.mockResolvedValue({
        id: 701,
        sourceReference: "TW/INV/26-27/0001",
        status: "ACTIVE",
      });

      mockRepo.transition.mockResolvedValue({
        id: 1,
        status: "CANCELLED",
      });

      const res = await service.cancel(1);
      expect(res.status).toBe("CANCELLED");
      expect(mockIntegrationService.cancelSalesInvoice).toHaveBeenCalledWith(
        {
          documentReference: "TW/INV/26-27/0001",
          reason: "Sales order cancelled (Order ID: 1)",
        },
        USER_ID,
      );
      expect(mockRepo.transition).toHaveBeenCalledWith(
        SCOPE,
        1,
        ["DRAFT", "CONFIRMED"],
        "CANCELLED",
        USER_ID,
      );
    });

    it("cancels un-invoiced order without calling integration cancellation", async () => {
      mockPrisma.financeGstEntry.findFirst.mockResolvedValue(null);

      mockRepo.transition.mockResolvedValue({
        id: 2,
        status: "CANCELLED",
      });

      const res = await service.cancel(2);
      expect(res.status).toBe("CANCELLED");
      expect(mockIntegrationService.cancelSalesInvoice).not.toHaveBeenCalled();
    });
  });

  describe("findOne() and findAll() invoice enrichment", () => {
    it("findOne enriches order with invoice metadata when invoice is active", async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        soNumber: "TW/SO/26-27/0001",
        status: "CONFIRMED",
      });

      mockPrisma.financeGstEntry.findFirst.mockResolvedValue({
        sourceReference: "TW/INV/26-27/0001",
        createdAt: new Date("2026-10-26T10:00:00Z"),
      });

      const row = await service.findOne(1);
      expect(row.invoiceNumber).toBe("TW/INV/26-27/0001");
      expect(row.invoicedStatus).toBe("Invoiced");
    });

    it("findOne marks order Not Invoiced when no active invoice exists", async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 2,
        soNumber: "TW/SO/26-27/0002",
        status: "CONFIRMED",
      });

      mockPrisma.financeGstEntry.findFirst.mockResolvedValue(null);

      const row = await service.findOne(2);
      expect(row.invoiceNumber).toBeNull();
      expect(row.invoicedStatus).toBe("Not Invoiced");
    });
  });
});
