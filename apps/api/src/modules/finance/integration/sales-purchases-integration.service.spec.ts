import { describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { SalesPurchasesIntegrationService } from "./sales-purchases-integration.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 99;

const MOCK_AR_ACCOUNT = {
  id: 10,
  accountCode: "1200",
  accountName: "Accounts Receivable",
  accountType: "ASSET",
  currentBalance: 0,
};

const MOCK_REV_ACCOUNT = {
  id: 20,
  accountCode: "4010",
  accountName: "Sales Revenue",
  accountType: "REVENUE",
  currentBalance: 0,
};

const MOCK_GST_ACCOUNT = {
  id: 30,
  accountCode: "2020",
  accountName: "GST Output Tax Payable",
  accountType: "LIABILITY",
  currentBalance: 0,
};

const MOCK_AP_ACCOUNT = {
  id: 40,
  accountCode: "2010",
  accountName: "Accounts Payable",
  accountType: "LIABILITY",
  currentBalance: 0,
};

const MOCK_EXP_ACCOUNT = {
  id: 50,
  accountCode: "5010",
  accountName: "Cost of Goods Sold",
  accountType: "EXPENSE",
  currentBalance: 0,
};

interface AccountLookupArgs {
  where: {
    accountCode?: string;
    accountType?: string;
  };
}

interface JournalCreateCallData {
  data: {
    referenceNumber: string;
    totalDebit: number;
    totalCredit: number;
    status: string;
    entryType: string;
    lines: {
      create: Array<{
        accountId: number;
        lineOrder: number;
        description: string;
        debit: number;
        credit: number;
      }>;
    };
  };
}

interface GstCreateCallData {
  data: {
    sourceReference: string;
    entryType: string;
    sourceType: string;
    gstin: string;
    taxableAmount: number;
    totalTaxAmount: number;
    isProformaExcluded: boolean;
    status: string;
  };
}

function makeService() {
  const financeJournalEntry = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockResolvedValue({ id: 501, entryNumber: "JV-202610-0099" }),
    update: vi.fn().mockResolvedValue({ id: 501 }),
  };

  const financeGstEntry = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 601 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeAccount = {
    findFirst: vi.fn().mockImplementation((args: AccountLookupArgs) => {
      const code = args.where.accountCode;
      const type = args.where.accountType;
      if (code === "1200" || type === "ASSET")
        return Promise.resolve(MOCK_AR_ACCOUNT);
      if (code === "4010" || type === "REVENUE")
        return Promise.resolve(MOCK_REV_ACCOUNT);
      if (code === "2020") return Promise.resolve(MOCK_GST_ACCOUNT);
      if (code === "2010" || type === "LIABILITY")
        return Promise.resolve(MOCK_AP_ACCOUNT);
      if (code === "5010" || type === "EXPENSE")
        return Promise.resolve(MOCK_EXP_ACCOUNT);
      return Promise.resolve(null);
    }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  };

  const prisma = {
    financeJournalEntry,
    financeGstEntry,
    financeAccount,
    $transaction: vi
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma)),
  };

  const journalRepository = {
    generateNextEntryNumber: vi.fn().mockResolvedValue("JV-202610-0099"),
  };

  const gstRepository = {
    create: vi.fn(),
    updateStatus: vi.fn(),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new SalesPurchasesIntegrationService(
    prisma as never,
    journalRepository as never,
    gstRepository as never,
    tenantContext as never,
  );

  return {
    service,
    prisma,
    financeJournalEntry,
    financeGstEntry,
    financeAccount,
    journalRepository,
  };
}

describe("SalesPurchasesIntegrationService", () => {
  describe("postSalesInvoice", () => {
    it("rejects an invoice where total <= 0", async () => {
      const { service } = makeService();

      await expect(
        service.postSalesInvoice({
          invoiceNumber: "INV-100",
          invoiceDate: "2026-10-15",
          customerName: "Acme",
          subtotal: 0,
          taxAmount: 0,
          total: 0,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("rejects an invoice where subtotal + tax != total", async () => {
      const { service } = makeService();

      await expect(
        service.postSalesInvoice({
          invoiceNumber: "INV-100",
          invoiceDate: "2026-10-15",
          customerName: "Acme",
          subtotal: 10000,
          taxAmount: 1800,
          total: 15000, // Imbalanced
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("creates a balanced double-entry journal entry and OUTPUT_GST entry", async () => {
      const { service, financeJournalEntry, financeGstEntry, financeAccount } =
        makeService();

      const result = await service.postSalesInvoice({
        invoiceNumber: "TEXA/INV/2026/001",
        invoiceDate: "2026-10-15",
        customerId: 4,
        customerName: "Acme Global",
        customerGstin: "29AABCT1332L1ZV",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        cgstAmount: 900,
        sgstAmount: 900,
        hsnSacCode: "998314",
      });

      expect(result.success).toBe(true);
      expect(result.documentReference).toBe("TEXA/INV/2026/001");
      expect(result.journalEntryId).toBe(501);
      expect(result.gstEntryId).toBe(601);

      // Verify journal entry lines:
      // Line 0: Debit AR (11800)
      // Line 1: Credit Revenue (10000)
      // Line 2: Credit GST Output (1800)
      const journalCall = financeJournalEntry.create.mock
        .calls[0]?.[0] as JournalCreateCallData;
      expect(journalCall.data.referenceNumber).toBe("TEXA/INV/2026/001");
      expect(journalCall.data.totalDebit).toBe(11800);
      expect(journalCall.data.totalCredit).toBe(11800);
      expect(journalCall.data.status).toBe("POSTED");

      const lines = journalCall.data.lines.create;
      expect(lines).toHaveLength(3);
      expect(lines[0]?.accountId).toBe(MOCK_AR_ACCOUNT.id);
      expect(lines[0]?.debit).toBe(11800);
      expect(lines[0]?.credit).toBe(0);

      expect(lines[1]?.accountId).toBe(MOCK_REV_ACCOUNT.id);
      expect(lines[1]?.debit).toBe(0);
      expect(lines[1]?.credit).toBe(10000);

      expect(lines[2]?.accountId).toBe(MOCK_GST_ACCOUNT.id);
      expect(lines[2]?.debit).toBe(0);
      expect(lines[2]?.credit).toBe(1800);

      // Verify balance updates on all 3 accounts
      expect(financeAccount.update).toHaveBeenCalledTimes(3);

      // Verify GST entry
      const gstCall = financeGstEntry.create.mock
        .calls[0]?.[0] as GstCreateCallData;
      expect(gstCall.data.entryType).toBe("OUTPUT_GST");
      expect(gstCall.data.sourceType).toBe("SALES_INVOICE");
      expect(gstCall.data.sourceReference).toBe("TEXA/INV/2026/001");
      expect(gstCall.data.gstin).toBe("29AABCT1332L1ZV");
      expect(gstCall.data.taxableAmount).toBe(10000);
      expect(gstCall.data.totalTaxAmount).toBe(1800);
      expect(gstCall.data.isProformaExcluded).toBe(false);
      expect(gstCall.data.status).toBe("ACTIVE");
    });

    it("auto-excludes proforma invoices (/PI/) from GST reporting while still recording accounting", async () => {
      const { service, financeGstEntry } = makeService();

      await service.postSalesInvoice({
        invoiceNumber: "TEXA/PI/2026/008",
        invoiceDate: "2026-10-15",
        customerName: "Beta Client",
        subtotal: 5000,
        taxAmount: 900,
        total: 5900,
      });

      const gstCall = financeGstEntry.create.mock
        .calls[0]?.[0] as GstCreateCallData;
      expect(gstCall.data.sourceReference).toBe("TEXA/PI/2026/008");
      expect(gstCall.data.isProformaExcluded).toBe(true);
    });

    it("prevents duplicate posting and returns alreadyPosted on retries", async () => {
      const { service, financeJournalEntry, financeGstEntry } = makeService();

      financeJournalEntry.findFirst.mockResolvedValueOnce({
        id: 777,
        entryNumber: "JV-202610-0077",
        status: "POSTED",
      });
      financeGstEntry.findFirst.mockResolvedValueOnce({
        id: 888,
        status: "ACTIVE",
      });

      const res = await service.postSalesInvoice({
        invoiceNumber: "TEXA/INV/2026/001",
        invoiceDate: "2026-10-15",
        customerName: "Acme",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
      });

      expect(res.alreadyPosted).toBe(true);
      expect(res.journalEntryId).toBe(777);
      expect(res.gstEntryId).toBe(888);
      expect(financeJournalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe("postPurchaseBill", () => {
    it("rejects an imbalanced purchase bill", async () => {
      const { service } = makeService();

      await expect(
        service.postPurchaseBill({
          billNumber: "TW/BILL/0001",
          billDate: "2026-10-15",
          supplierName: "Supplier X",
          subtotal: 20000,
          taxAmount: 3600,
          total: 25000, // Imbalanced
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("creates a balanced double-entry voucher (Debit COGS & GST Input, Credit AP) and INPUT_TAX_CREDIT entry", async () => {
      const { service, financeJournalEntry, financeGstEntry, financeAccount } =
        makeService();

      const result = await service.postPurchaseBill({
        billNumber: "TW/BILL/0001",
        supplierBillNumber: "SUPP-INV-9901",
        billDate: "2026-10-15",
        supplierId: 2,
        supplierName: "Zenith Components",
        supplierGstin: "33AAMCT4293K1ZU",
        subtotal: 20000,
        taxAmount: 3600,
        total: 23600,
        cgstAmount: 1800,
        sgstAmount: 1800,
      });

      expect(result.success).toBe(true);
      expect(result.documentReference).toBe("SUPP-INV-9901");
      expect(result.journalEntryId).toBe(501);
      expect(result.gstEntryId).toBe(601);

      // Verify journal entry lines:
      // Line 0: Debit Expense/COGS (20000)
      // Line 1: Debit GST Input (3600)
      // Line 2: Credit AP (23600)
      const journalCall = financeJournalEntry.create.mock
        .calls[0]?.[0] as JournalCreateCallData;
      expect(journalCall.data.referenceNumber).toBe("SUPP-INV-9901");
      expect(journalCall.data.totalDebit).toBe(23600);
      expect(journalCall.data.totalCredit).toBe(23600);
      expect(journalCall.data.status).toBe("POSTED");

      const lines = journalCall.data.lines.create;
      expect(lines).toHaveLength(3);
      expect(lines[0]?.accountId).toBe(MOCK_EXP_ACCOUNT.id);
      expect(lines[0]?.debit).toBe(20000);
      expect(lines[0]?.credit).toBe(0);

      expect(lines[1]?.accountId).toBe(MOCK_GST_ACCOUNT.id);
      expect(lines[1]?.debit).toBe(3600);
      expect(lines[1]?.credit).toBe(0);

      expect(lines[2]?.accountId).toBe(MOCK_AP_ACCOUNT.id);
      expect(lines[2]?.debit).toBe(0);
      expect(lines[2]?.credit).toBe(23600);

      expect(financeAccount.update).toHaveBeenCalledTimes(3);

      const gstCall = financeGstEntry.create.mock
        .calls[0]?.[0] as GstCreateCallData;
      expect(gstCall.data.entryType).toBe("INPUT_TAX_CREDIT");
      expect(gstCall.data.sourceType).toBe("PURCHASE_BILL");
      expect(gstCall.data.sourceReference).toBe("SUPP-INV-9901");
      expect(gstCall.data.gstin).toBe("33AAMCT4293K1ZU");
      expect(gstCall.data.taxableAmount).toBe(20000);
      expect(gstCall.data.totalTaxAmount).toBe(3600);
      expect(gstCall.data.status).toBe("ACTIVE");
    });

    it("prevents duplicate purchase bill posting on retries", async () => {
      const { service, financeJournalEntry } = makeService();

      financeJournalEntry.findFirst.mockResolvedValueOnce({
        id: 991,
        entryNumber: "JV-202610-0991",
        status: "POSTED",
      });

      const res = await service.postPurchaseBill({
        billNumber: "TW/BILL/0001",
        billDate: "2026-10-15",
        supplierName: "Zenith",
        subtotal: 20000,
        taxAmount: 3600,
        total: 23600,
      });

      expect(res.alreadyPosted).toBe(true);
      expect(res.journalEntryId).toBe(991);
      expect(financeJournalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe("cancellation & reversal workflows", () => {
    it("generates a reversal journal voucher and cancels GST entry upon cancellation", async () => {
      const {
        service,
        financeJournalEntry,
        financeGstEntry,
        journalRepository,
      } = makeService();

      financeJournalEntry.findFirst.mockResolvedValueOnce({
        id: 101,
        entryNumber: "JV-202610-0101",
        status: "POSTED",
        totalDebit: "11800.00",
        totalCredit: "11800.00",
        lines: [
          {
            accountId: 10,
            lineOrder: 0,
            debit: "11800.00",
            credit: "0.00",
            account: MOCK_AR_ACCOUNT,
          },
          {
            accountId: 20,
            lineOrder: 1,
            debit: "0.00",
            credit: "10000.00",
            account: MOCK_REV_ACCOUNT,
          },
          {
            accountId: 30,
            lineOrder: 2,
            debit: "0.00",
            credit: "1800.00",
            account: MOCK_GST_ACCOUNT,
          },
        ],
      });

      journalRepository.generateNextEntryNumber.mockResolvedValueOnce(
        "REV-202610-0005",
      );

      const res = await service.cancelSalesInvoice({
        documentReference: "TEXA/INV/2026/001",
        reason: "Customer cancelled order",
      });

      expect(res.success).toBe(true);
      expect(res.journalEntryId).toBe(101);
      expect(res.reversalJournalEntryId).toBe(501);

      // Original entry marked as REVERSED
      expect(financeJournalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
        }),
      );

      // Reversal entry created with swapped lines
      const revCall = financeJournalEntry.create.mock
        .calls[0]?.[0] as JournalCreateCallData;
      expect(revCall.data.entryType).toBe("REVERSAL");
      const revLines = revCall.data.lines.create;
      expect(revLines[0]?.accountId).toBe(10);
      expect(revLines[0]?.debit).toBe(0);
      expect(revLines[0]?.credit).toBe(11800);

      expect(revLines[1]?.accountId).toBe(20);
      expect(revLines[1]?.debit).toBe(10000);
      expect(revLines[1]?.credit).toBe(0);

      // GST entry marked CANCELLED
      expect(financeGstEntry.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 1,
          sourceReference: "TEXA/INV/2026/001",
          status: "ACTIVE",
        },
        data: { status: "CANCELLED" },
      });
    });

    it("returns alreadyCancelled safely if document is not found or already reversed", async () => {
      const { service, financeJournalEntry } = makeService();

      financeJournalEntry.findFirst
        .mockResolvedValueOnce(null) // no POSTED entry
        .mockResolvedValueOnce({
          id: 101,
          entryNumber: "REV-101",
          status: "REVERSED",
        });

      const res = await service.cancelPurchaseBill({
        documentReference: "TW/BILL/0001",
        reason: "Already cancelled",
      });

      expect(res.alreadyCancelled).toBe(true);
      expect(res.journalEntryId).toBe(101);
    });
  });

  describe("getIntegrationStatus", () => {
    it("reports integration status for a document reference", async () => {
      const { service, financeJournalEntry, financeGstEntry } = makeService();

      financeJournalEntry.findFirst.mockResolvedValueOnce({
        id: 50,
        entryNumber: "JV-202610-0050",
        entryDate: new Date("2026-10-15T00:00:00.000Z"),
        status: "POSTED",
        totalDebit: "11800.00",
        totalCredit: "11800.00",
      });

      financeGstEntry.findFirst.mockResolvedValueOnce({
        id: 60,
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        taxableAmount: "10000.00",
        totalTaxAmount: "1800.00",
        status: "ACTIVE",
      });

      const status = await service.getIntegrationStatus("INV-99");

      expect(status.documentReference).toBe("INV-99");
      expect(status.isJournalPosted).toBe(true);
      expect(status.journalEntry?.entryNumber).toBe("JV-202610-0050");
      expect(status.isGstRecorded).toBe(true);
      expect(status.gstEntry?.gstin).toBe("29AABCT1332L1ZV");
    });
  });
});
