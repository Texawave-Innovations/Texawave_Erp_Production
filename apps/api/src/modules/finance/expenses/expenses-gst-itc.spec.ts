import { describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { ExpensesService } from "./expenses.service.js";
import type {
  ExpenseGstEntryData,
  ExpenseJournalEntryData,
} from "./expenses.repository.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const MOCK_EXPENSE_ACCOUNT = {
  id: 100,
  accountCode: "5020",
  accountName: "General Operating Expenses",
  accountType: "EXPENSE",
};

const MOCK_ITC_ACCOUNT = {
  id: 130,
  accountCode: "1300",
  accountName: "GST Input Tax Credit",
  accountType: "ASSET",
};

const MOCK_OUTPUT_GST_LIABILITY = {
  id: 220,
  accountCode: "2020",
  accountName: "GST Output Tax Payable",
  accountType: "LIABILITY",
};

const MOCK_BANK_ACCOUNT_GL = {
  id: 200,
  accountCode: "1020",
  accountName: "Operating Bank Account",
  accountType: "ASSET",
};

interface AccountLookupArgs {
  where: {
    accountCode?: string;
    accountType?: string;
    accountName?: { contains?: string; mode?: string };
    id?: number;
  };
}

interface MockExpenseRecord {
  id: number;
  organizationId: number;
  expenseNumber: string;
  expenseTypeId: number;
  expenseDate: string;
  amount: string;
  taxAmount: string;
  netAmount: string;
  status: string;
  paymentModeId: number | null;
  bankAccountId: number | null;
  glAccountId: number | null;
  vendorName: string | null;
  vendorGstin: string | null;
  vendorInvoiceNumber: string | null;
  vendorInvoiceDate: string | null;
  hsnSacCode: string | null;
  taxRate: string | null;
  cgstAmount: string | null;
  sgstAmount: string | null;
  igstAmount: string | null;
  isItcEligible: boolean;
  ineligibilityReason: string | null;
  gstJurisdiction: string | null;
  notes: string | null;
  journalEntryId: number | null;
  deletedAt: string | null;
}

interface CreatedExpensePayload {
  vendorGstin?: string | null;
  gstJurisdiction?: string | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  status?: string | null;
  [key: string]: unknown;
}

function makeTestSetup() {
  let createdPayload: CreatedExpensePayload | null = null;
  let paidJournalData: ExpenseJournalEntryData | null = null;
  let paidGstData: ExpenseGstEntryData | null = null;

  const currentExpense: MockExpenseRecord = {
    id: 10,
    organizationId: 1,
    expenseNumber: "EXP-202610-0001",
    expenseTypeId: 1,
    expenseDate: "2026-10-23T00:00:00.000Z",
    amount: "1000.00",
    taxAmount: "180.00",
    netAmount: "1180.00",
    status: "DRAFT",
    paymentModeId: 2,
    bankAccountId: 1,
    glAccountId: 100,
    vendorName: "Acme Office Supplies",
    vendorGstin: "33AAMCT4293K1ZU",
    vendorInvoiceNumber: "INV-9901",
    vendorInvoiceDate: "2026-10-20T00:00:00.000Z",
    hsnSacCode: "998311",
    taxRate: "18.00",
    cgstAmount: "90.00",
    sgstAmount: "90.00",
    igstAmount: "0.00",
    isItcEligible: true,
    ineligibilityReason: null,
    gstJurisdiction: "INTRA_STATE",
    notes: "Paper & Printer Cartridges",
    journalEntryId: null,
    deletedAt: null,
  };

  const repository = {
    findById: vi
      .fn()
      .mockImplementation(() => Promise.resolve({ ...currentExpense })),
    findByExpenseNumber: vi.fn().mockResolvedValue(null),
    generateNextExpenseNumber: vi.fn().mockResolvedValue("EXP-202610-0001"),
    create: vi
      .fn()
      .mockImplementation((_scope: unknown, data: Record<string, unknown>) => {
        createdPayload = data;
        const res = {
          id: 10,
          ...data,
          status: typeof data.status === "string" ? data.status : "DRAFT",
        };
        Object.assign(currentExpense, res);
        return Promise.resolve(res);
      }),
    update: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, _id: unknown, data: Record<string, unknown>) => {
          Object.assign(currentExpense, data);
          return Promise.resolve({ ...currentExpense });
        },
      ),
    payAndPostExpense: vi
      .fn()
      .mockImplementation(
        (
          _scope: unknown,
          _id: unknown,
          jData: ExpenseJournalEntryData,
          _deltas: unknown,
          _updates: unknown,
          _userId: unknown,
          gData: ExpenseGstEntryData | null,
        ) => {
          paidJournalData = jData;
          paidGstData = gData;
          currentExpense.status = "PAID";
          currentExpense.journalEntryId = 50;
          return Promise.resolve({
            ...currentExpense,
            status: "PAID",
            journalEntryId: 50,
          });
        },
      ),
    cancelAndReverseExpense: vi.fn().mockImplementation(() => {
      currentExpense.status = "CANCELLED";
      return Promise.resolve({ ...currentExpense, status: "CANCELLED" });
    }),
  };

  const journalRepository = {
    generateNextEntryNumber: vi.fn().mockResolvedValue("JV-202610-0001"),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const prisma = {
    payrollSetting: {
      findFirst: vi.fn().mockResolvedValue({ companyGstin: "33AAECP4821K1Z6" }), // Tamil Nadu 33
    },
    financeMasterListItem: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1,
        value: "Office Supplies",
        category: "expense_type",
      }),
    },
    financeBankAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1,
        accountName: "Operating Account",
        glAccountId: 200,
      }),
    },
    financeAccount: {
      findFirst: vi.fn().mockImplementation((args: AccountLookupArgs) => {
        const code = args.where.accountCode;
        const type = args.where.accountType;
        const id = args.where.id;

        if (id === 100 || code === "5020" || type === "EXPENSE") {
          return Promise.resolve(MOCK_EXPENSE_ACCOUNT);
        }
        if (
          code === "1300" ||
          (type === "ASSET" &&
            args.where.accountName?.contains?.toLowerCase().includes("input"))
        ) {
          return Promise.resolve(MOCK_ITC_ACCOUNT);
        }
        if (code === "2020") {
          return Promise.resolve(MOCK_OUTPUT_GST_LIABILITY);
        }
        if (id === 200 || code === "1020" || type === "ASSET") {
          return Promise.resolve(MOCK_BANK_ACCOUNT_GL);
        }
        return Promise.resolve(null);
      }),
    },
    financeJournalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: 50,
        entryNumber: "JV-202610-0001",
        totalDebit: "1180.00",
        totalCredit: "1180.00",
        lines: [
          {
            accountId: 100,
            lineOrder: 0,
            debit: "1000.00",
            credit: "0.00",
            account: { accountType: "EXPENSE" },
          },
          {
            accountId: 130,
            lineOrder: 1,
            debit: "180.00",
            credit: "0.00",
            account: { accountType: "ASSET" },
          },
          {
            accountId: 200,
            lineOrder: 2,
            debit: "0.00",
            credit: "1180.00",
            account: { accountType: "ASSET" },
          },
        ],
      }),
    },
  };

  const service = new ExpensesService(
    repository as never,
    journalRepository as never,
    tenantContext as never,
    prisma as never,
  );

  return {
    service,
    repository,
    prisma,
    getCreatedPayload: () => createdPayload as CreatedExpensePayload,
    getPaidJournalData: () => paidJournalData,
    getPaidGstData: () => paidGstData,
    currentExpense,
  };
}

describe("Expenses GST & Input Tax Credit (ITC) Integration — Phase 3", () => {
  describe("Tax Schema & Validation", () => {
    it("validates GSTIN format and rejects malformed vendor GSTIN", async () => {
      const { service } = makeTestSetup();

      await expect(
        service.create({
          expenseTypeId: 1,
          expenseDate: "2026-10-23",
          amount: 1000,
          taxAmount: 180,
          vendorGstin: "INVALID-GSTIN-123",
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("accepts valid 15-character Indian GSTIN and normalises to uppercase", async () => {
      const { service, getCreatedPayload } = makeTestSetup();

      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        vendorGstin: "33aamct4293k1zu", // lowercase
      });

      const payload = getCreatedPayload();
      expect(payload.vendorGstin).toBe("33AAMCT4293K1ZU");
    });

    it("rejects when explicit tax components do not equal total tax amount", async () => {
      const { service } = makeTestSetup();

      await expect(
        service.create({
          expenseTypeId: 1,
          expenseDate: "2026-10-23",
          amount: 1000,
          taxAmount: 180,
          cgstAmount: 100, // 100 + 100 = 200 != 180
          sgstAmount: 100,
          igstAmount: 0,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("automatically calculates INTRA_STATE (CGST + SGST) when state codes match", async () => {
      const { service, getCreatedPayload } = makeTestSetup();

      // Company is 33 (TN), Vendor is 33 (TN)
      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        vendorGstin: "33AAMCT4293K1ZU",
      });

      const payload = getCreatedPayload();
      expect(payload.gstJurisdiction).toBe("INTRA_STATE");
      expect(payload.cgstAmount).toBe(90);
      expect(payload.sgstAmount).toBe(90);
      expect(payload.igstAmount).toBe(0);
    });

    it("automatically calculates INTER_STATE (IGST) when state codes differ", async () => {
      const { service, getCreatedPayload } = makeTestSetup();

      // Company is 33 (TN), Vendor is 27 (Maharashtra)
      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        vendorGstin: "27AAACB2154P1ZG",
      });

      const payload = getCreatedPayload();
      expect(payload.gstJurisdiction).toBe("INTER_STATE");
      expect(payload.igstAmount).toBe(180);
      expect(payload.cgstAmount).toBe(0);
      expect(payload.sgstAmount).toBe(0);
    });

    it("respects explicit gstJurisdiction override", async () => {
      const { service, getCreatedPayload } = makeTestSetup();

      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        vendorGstin: "33AAMCT4293K1ZU",
        gstJurisdiction: "INTER_STATE", // Explicit override
      });

      const payload = getCreatedPayload();
      expect(payload.gstJurisdiction).toBe("INTER_STATE");
      expect(payload.igstAmount).toBe(180);
    });
  });

  describe("Disbursement (`pay()`) & General Ledger Double-Entry", () => {
    it("operating expense disbursement: debits Expense for full amount and credits Bank for net amount without creating GST ITC entry", async () => {
      const { service, getPaidJournalData, getPaidGstData } = makeTestSetup();

      await service.pay(10);

      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      expect(journal?.totalDebit).toBe(1180);
      expect(journal?.totalCredit).toBe(1180);
      expect(journal?.lines).toHaveLength(2);

      // Line 0: Debit Expense (1180)
      expect(journal?.lines[0]?.accountId).toBe(MOCK_EXPENSE_ACCOUNT.id);
      expect(journal?.lines[0]?.debit).toBe(1180);
      expect(journal?.lines[0]?.credit).toBe(0);

      // Line 1: Credit Bank Account (1180)
      expect(journal?.lines[1]?.accountId).toBe(MOCK_BANK_ACCOUNT_GL.id);
      expect(journal?.lines[1]?.debit).toBe(0);
      expect(journal?.lines[1]?.credit).toBe(1180);

      // Crucial: No GST entry created for ordinary operating expenses
      const gst = getPaidGstData();
      expect(gst).toBeNull();
    });

    it("succeeds cleanly even when account 1300 (Input Tax Credit) is absent from Chart of Accounts", async () => {
      const { service, prisma, getPaidJournalData } = makeTestSetup();

      // Account 1300 does not exist (as in Org 1)
      prisma.financeAccount.findFirst.mockImplementation(
        (args: AccountLookupArgs) => {
          const code = args.where.accountCode;
          if (code === "1300") return Promise.resolve(null);
          if (code === "2020")
            return Promise.resolve(MOCK_OUTPUT_GST_LIABILITY);
          if (args.where.id === 100 || code === "5020")
            return Promise.resolve(MOCK_EXPENSE_ACCOUNT);
          if (args.where.id === 200 || code === "1020")
            return Promise.resolve(MOCK_BANK_ACCOUNT_GL);
          return Promise.resolve(null);
        },
      );

      await service.pay(10);

      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      expect(journal?.totalDebit).toBe(1180);
      expect(journal?.totalCredit).toBe(1180);
      expect(journal?.lines).toHaveLength(2);
    });

    it("atomic PAID creation: creating with status PAID immediately executes GL disbursement without creating GST entries", async () => {
      const { service, getPaidJournalData, getPaidGstData } = makeTestSetup();

      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        status: "PAID",
        vendorGstin: "33AAMCT4293K1ZU",
      });

      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      expect(journal?.totalDebit).toBe(1180);

      const gst = getPaidGstData();
      expect(gst).toBeNull();
    });

    it("idempotency: paying an already PAID expense throws EXPENSE_ALREADY_PAID", async () => {
      const { service, currentExpense } = makeTestSetup();
      currentExpense.status = "PAID";

      await expect(service.pay(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("Cancellation & Reversal Workflow", () => {
    it("cancelling a paid expense creates reversal voucher and cancels active GST entry", async () => {
      const { service, currentExpense, repository } = makeTestSetup();
      currentExpense.status = "PAID";
      currentExpense.journalEntryId = 50;

      await service.cancel(10);

      expect(repository.cancelAndReverseExpense).toHaveBeenCalled();
    });

    it("cancelling an ineligible-ITC expense reverses journal without error", async () => {
      const { service, currentExpense, repository } = makeTestSetup();
      currentExpense.status = "PAID";
      currentExpense.journalEntryId = 50;
      currentExpense.isItcEligible = false;

      await service.cancel(10);

      expect(repository.cancelAndReverseExpense).toHaveBeenCalled();
    });

    it("creating a draft expense does NOT post to GL and does NOT create GST entry", async () => {
      const { service, getPaidJournalData, getPaidGstData } = makeTestSetup();

      await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        status: "DRAFT",
      });

      expect(getPaidJournalData()).toBeNull();
      expect(getPaidGstData()).toBeNull();
    });
  });

  describe("Simplified Business Expenses (Zero Tax & Non-Recoverable Tax)", () => {
    it("ordinary expense without GST fields creates cleanly and pays without account 1300 in COA", async () => {
      const { service, prisma, getPaidJournalData, getPaidGstData } =
        makeTestSetup();

      // Ensure account 1300 DOES NOT EXIST in this organization's Chart of Accounts
      prisma.financeAccount.findFirst.mockImplementation(
        (args: AccountLookupArgs) => {
          const code = args.where.accountCode;
          if (code === "1300") return Promise.resolve(null);
          if (args.where.id === 100 || code === "5020")
            return Promise.resolve(MOCK_EXPENSE_ACCOUNT);
          if (args.where.id === 200 || code === "1020")
            return Promise.resolve(MOCK_BANK_ACCOUNT_GL);
          return Promise.resolve(null);
        },
      );

      // User creates an ordinary office expense with NO tax and NO vendor GSTIN
      const res = await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 500,
        status: "PAID",
      });

      expect(res).toBeDefined();
      expect(res?.status).toBe("PAID");
      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      expect(journal?.totalDebit).toBe(500);
      expect(journal?.totalCredit).toBe(500);
      expect(journal?.lines).toHaveLength(2);
      expect(journal?.lines[0]?.accountId).toBe(MOCK_EXPENSE_ACCOUNT.id);
      expect(journal?.lines[0]?.debit).toBe(500);
      expect(journal?.lines[1]?.accountId).toBe(MOCK_BANK_ACCOUNT_GL.id);
      expect(journal?.lines[1]?.credit).toBe(500);

      // No GST registry entry created
      expect(getPaidGstData()).toBeNull();
    });

    it("expense with receipt tax from unregistered vendor absorbs tax into expense without account 1300", async () => {
      const { service, prisma, getPaidJournalData, getPaidGstData } =
        makeTestSetup();

      // Ensure account 1300 DOES NOT EXIST
      prisma.financeAccount.findFirst.mockImplementation(
        (args: AccountLookupArgs) => {
          const code = args.where.accountCode;
          if (code === "1300") return Promise.resolve(null);
          if (args.where.id === 100 || code === "5020")
            return Promise.resolve(MOCK_EXPENSE_ACCOUNT);
          if (args.where.id === 200 || code === "1020")
            return Promise.resolve(MOCK_BANK_ACCOUNT_GL);
          return Promise.resolve(null);
        },
      );

      // User paid ₹1000 + ₹180 tax to an unregistered vendor or without GSTIN
      const res = await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        vendorName: "Local Stationery Shop",
        status: "PAID",
      });

      expect(res).toBeDefined();
      expect(res?.status).toBe("PAID");
      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      // Gross 1180 absorbed into Expense account
      expect(journal?.totalDebit).toBe(1180);
      expect(journal?.totalCredit).toBe(1180);
      expect(journal?.lines).toHaveLength(2);
      expect(journal?.lines[0]?.accountId).toBe(MOCK_EXPENSE_ACCOUNT.id);
      expect(journal?.lines[0]?.debit).toBe(1180);
      expect(journal?.lines[1]?.accountId).toBe(MOCK_BANK_ACCOUNT_GL.id);
      expect(journal?.lines[1]?.credit).toBe(1180);

      // No GST registry entry created
      expect(getPaidGstData()).toBeNull();
    });

    it("expense with vendor GSTIN but isItcEligible=false absorbs tax into expense without account 1300", async () => {
      const { service, prisma, getPaidJournalData, getPaidGstData } =
        makeTestSetup();

      // Ensure account 1300 DOES NOT EXIST
      prisma.financeAccount.findFirst.mockImplementation(
        (args: AccountLookupArgs) => {
          const code = args.where.accountCode;
          if (code === "1300") return Promise.resolve(null);
          if (args.where.id === 100 || code === "5020")
            return Promise.resolve(MOCK_EXPENSE_ACCOUNT);
          if (args.where.id === 200 || code === "1020")
            return Promise.resolve(MOCK_BANK_ACCOUNT_GL);
          return Promise.resolve(null);
        },
      );

      const res = await service.create({
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 2000,
        taxAmount: 100,
        vendorName: "Hotel Grand",
        vendorGstin: "33AAMCT4293K1ZU",
        isItcEligible: false,
        ineligibilityReason: "Food and catering blocked under Section 17(5)",
        status: "PAID",
      });

      expect(res).toBeDefined();
      expect(res?.status).toBe("PAID");
      const journal = getPaidJournalData();
      expect(journal).not.toBeNull();
      expect(journal?.totalDebit).toBe(2100);
      expect(journal?.lines).toHaveLength(2);
      expect(journal?.lines[0]?.debit).toBe(2100);
      expect(getPaidGstData()).toBeNull();
    });
  });
});
