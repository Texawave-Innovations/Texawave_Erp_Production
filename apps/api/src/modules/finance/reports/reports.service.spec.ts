import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { ReportsService } from "./reports.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    getAccounts: vi.fn().mockResolvedValue([]),
    getAccountById: vi.fn().mockResolvedValue(null),
    getAccountByCode: vi.fn().mockResolvedValue(null),
    getPostedJournalLinesInDateRange: vi.fn().mockResolvedValue([]),
    getPostedJournalLinesUpToDate: vi.fn().mockResolvedValue([]),
    getAccountPriorTotals: vi
      .fn()
      .mockResolvedValue({ totalDebit: 0, totalCredit: 0 }),
    getAccountLedgerLines: vi.fn().mockResolvedValue({ lines: [], total: 0 }),
    getBankAccounts: vi.fn().mockResolvedValue([]),
    getPeriodClosingAuditData: vi.fn().mockResolvedValue({
      draftEntriesCount: 0,
      postedEntriesCount: 0,
      totalDebit: 0,
      totalCredit: 0,
      unreconciledBankTransactionsCount: 0,
    }),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
  };

  const service = new ReportsService(
    repository as never,
    tenantContext as never,
  );

  return { service, repository, tenantContext };
}

describe("ReportsService", () => {
  describe("Profit & Loss Statement (getProfitAndLoss)", () => {
    it("throws if startDate is after endDate", async () => {
      const { service } = makeService();
      await expect(
        service.getProfitAndLoss({
          startDate: "2026-10-31",
          endDate: "2026-10-01",
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("aggregates revenue credits and expense debits correctly", async () => {
      const { service, repository } = makeService();

      repository.getPostedJournalLinesInDateRange.mockResolvedValueOnce([
        // Revenue line: Credit 5000, Debit 200 -> Net Revenue 4800
        {
          accountId: 4010,
          debit: "200.00",
          credit: "5000.00",
          account: {
            id: 4010,
            accountCode: "4010",
            accountName: "Sales Revenue",
            accountType: "REVENUE",
          },
        },
        // Expense line: Debit 1200, Credit 100 -> Net Expense 1100
        {
          accountId: 5010,
          debit: "1200.00",
          credit: "100.00",
          account: {
            id: 5010,
            accountCode: "5010",
            accountName: "Office Supplies",
            accountType: "EXPENSE",
          },
        },
      ]);

      const result = await service.getProfitAndLoss({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });

      expect(result.period.startDate).toBe("2026-10-01");
      expect(result.period.endDate).toBe("2026-10-31");
      expect(result.revenue.total).toBe(4800);
      expect(result.revenue.accounts).toHaveLength(1);
      expect(result.revenue.accounts[0]?.amount).toBe(4800);
      expect(result.expenses.total).toBe(1100);
      expect(result.expenses.accounts).toHaveLength(1);
      expect(result.expenses.accounts[0]?.amount).toBe(1100);
      expect(result.netIncome).toBe(3700);
      expect(result.isProfitable).toBe(true);
    });

    it("flags isProfitable as false when expenses exceed revenues", async () => {
      const { service, repository } = makeService();

      repository.getPostedJournalLinesInDateRange.mockResolvedValueOnce([
        {
          accountId: 4010,
          debit: "0.00",
          credit: "1000.00",
          account: {
            id: 4010,
            accountCode: "4010",
            accountName: "Revenue",
            accountType: "REVENUE",
          },
        },
        {
          accountId: 5010,
          debit: "3500.00",
          credit: "0.00",
          account: {
            id: 5010,
            accountCode: "5010",
            accountName: "Rent",
            accountType: "EXPENSE",
          },
        },
      ]);

      const result = await service.getProfitAndLoss({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });

      expect(result.revenue.total).toBe(1000);
      expect(result.expenses.total).toBe(3500);
      expect(result.netIncome).toBe(-2500);
      expect(result.isProfitable).toBe(false);
    });
  });

  describe("Balance Sheet (getBalanceSheet)", () => {
    it("calculates Assets, Liabilities, and Equity including retained earnings and verifies balance", async () => {
      const { service, repository } = makeService();

      // Balanced ledger snapshot:
      // Asset (Cash): Debit 10,000
      // Liability (AP): Credit 2,000
      // Equity (Capital): Credit 5,000
      // Revenue: Credit 4,000
      // Expense: Debit 1,000
      // -> Retained Earnings = 4,000 - 1,000 = 3,000
      // -> Total Equity = 5,000 + 3,000 = 8,000
      // -> Liabilities + Equity = 2,000 + 8,000 = 10,000 == Assets (10,000)
      repository.getPostedJournalLinesUpToDate.mockResolvedValueOnce([
        {
          accountId: 1020,
          debit: "10000.00",
          credit: "0.00",
          account: {
            id: 1020,
            accountCode: "1020",
            accountName: "Bank Account",
            accountType: "ASSET",
          },
        },
        {
          accountId: 2010,
          debit: "0.00",
          credit: "2000.00",
          account: {
            id: 2010,
            accountCode: "2010",
            accountName: "Accounts Payable",
            accountType: "LIABILITY",
          },
        },
        {
          accountId: 3010,
          debit: "0.00",
          credit: "5000.00",
          account: {
            id: 3010,
            accountCode: "3010",
            accountName: "Owner Capital",
            accountType: "EQUITY",
          },
        },
        {
          accountId: 4010,
          debit: "0.00",
          credit: "4000.00",
          account: {
            id: 4010,
            accountCode: "4010",
            accountName: "Revenue",
            accountType: "REVENUE",
          },
        },
        {
          accountId: 5010,
          debit: "1000.00",
          credit: "0.00",
          account: {
            id: 5010,
            accountCode: "5010",
            accountName: "Utilities",
            accountType: "EXPENSE",
          },
        },
      ]);

      const result = await service.getBalanceSheet({
        asOfDate: "2026-10-31",
      });

      expect(result.assets.total).toBe(10000);
      expect(result.liabilities.total).toBe(2000);
      expect(result.equity.retainedEarnings).toBe(3000);
      expect(result.equity.total).toBe(8000);
      expect(result.difference).toBe(0);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe("Trial Balance (getTrialBalance)", () => {
    it("summarizes opening, period, and closing totals and verifies debits equal credits", async () => {
      const { service, repository } = makeService();

      repository.getAccounts.mockResolvedValueOnce([
        {
          id: 1,
          accountCode: "1020",
          accountName: "Bank Account",
          accountType: "ASSET",
        },
        {
          id: 2,
          accountCode: "4010",
          accountName: "Service Revenue",
          accountType: "REVENUE",
        },
      ]);

      const start = "2026-10-01";
      repository.getPostedJournalLinesUpToDate.mockResolvedValueOnce([
        // Opening bank debit: 5000
        {
          accountId: 1,
          debit: "5000.00",
          credit: "0.00",
          journalEntry: { entryDate: "2026-09-15T00:00:00.000Z" },
        },
        // Period bank debit: 2000
        {
          accountId: 1,
          debit: "2000.00",
          credit: "0.00",
          journalEntry: { entryDate: "2026-10-10T00:00:00.000Z" },
        },
        // Period revenue credit: 2000
        {
          accountId: 2,
          debit: "0.00",
          credit: "2000.00",
          journalEntry: { entryDate: "2026-10-10T00:00:00.000Z" },
        },
        // Opening revenue credit: 5000
        {
          accountId: 2,
          debit: "0.00",
          credit: "5000.00",
          journalEntry: { entryDate: "2026-09-15T00:00:00.000Z" },
        },
      ]);

      const result = await service.getTrialBalance({
        startDate: start,
        asOfDate: "2026-10-31",
      });

      expect(result.accounts).toHaveLength(2);
      const bankItem = result.accounts.find((a) => a.accountCode === "1020");
      expect(bankItem).toBeDefined();
      expect(bankItem?.openingDebit).toBe(5000);
      expect(bankItem?.periodDebit).toBe(2000);
      expect(bankItem?.closingDebit).toBe(7000);

      const revItem = result.accounts.find((a) => a.accountCode === "4010");
      expect(revItem).toBeDefined();
      expect(revItem?.openingCredit).toBe(5000);
      expect(revItem?.periodCredit).toBe(2000);
      expect(revItem?.closingCredit).toBe(7000);

      expect(result.totalDebit).toBe(7000);
      expect(result.totalCredit).toBe(7000);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe("General Ledger (getGeneralLedger)", () => {
    it("throws ResourceNotFoundException if account does not exist", async () => {
      const { service, repository } = makeService();
      repository.getAccountById.mockResolvedValueOnce(null);

      await expect(
        service.getGeneralLedger({
          accountId: 9999,
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          page: 1,
          limit: 20,
          skip: 0,
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("calculates opening balance and sequential running balance along journal lines", async () => {
      const { service, repository } = makeService();

      repository.getAccountById.mockResolvedValueOnce({
        id: 10,
        accountCode: "1020",
        accountName: "HDFC Current",
        accountType: "ASSET",
      });

      // Opening prior totals: debit 10,000, credit 2,000 -> opening balance 8,000
      repository.getAccountPriorTotals.mockResolvedValueOnce({
        totalDebit: 10000,
        totalCredit: 2000,
      });

      repository.getAccountLedgerLines.mockResolvedValueOnce({
        lines: [
          {
            id: 101,
            journalEntryId: 50,
            lineOrder: 1,
            description: "Customer invoice receipt",
            debit: "3000.00",
            credit: "0.00",
            journalEntry: {
              id: 50,
              entryNumber: "JV-202610-0001",
              entryDate: new Date("2026-10-05T00:00:00.000Z"),
              entryType: "PAYMENT_RECEIVED",
              referenceNumber: "INV-1001",
              narration: "Invoice payment",
            },
          },
          {
            id: 102,
            journalEntryId: 51,
            lineOrder: 2,
            description: "Vendor bill payout",
            debit: "0.00",
            credit: "1500.00",
            journalEntry: {
              id: 51,
              entryNumber: "JV-202610-0002",
              entryDate: new Date("2026-10-12T00:00:00.000Z"),
              entryType: "PAYMENT_MADE",
              referenceNumber: "BILL-2001",
              narration: "Supplier payment",
            },
          },
        ],
        total: 2,
      });

      const result = await service.getGeneralLedger({
        accountId: 10,
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        page: 1,
        limit: 20,
        skip: 0,
      });

      expect(result.openingBalance).toBe(8000);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.runningBalance).toBe(11000); // 8000 + 3000
      expect(result.transactions[1]?.runningBalance).toBe(9500); // 11000 - 1500
      expect(result.totalDebit).toBe(3000);
      expect(result.totalCredit).toBe(1500);
      expect(result.closingBalance).toBe(9500);
    });
  });

  describe("Cash & Bank Summary (getCashBankSummary)", () => {
    it("summarizes treasury accounts with opening, inflows, outflows, and closing", async () => {
      const { service, repository } = makeService();

      repository.getBankAccounts.mockResolvedValueOnce([
        {
          id: 1,
          accountName: "HDFC Primary",
          accountNumber: "50200012345678",
          bankName: "HDFC Bank",
          openingBalance: "10000.00",
          glAccountId: 102,
        },
      ]);
      repository.getAccounts.mockResolvedValueOnce([
        {
          id: 101,
          accountCode: "1010",
          accountName: "Petty Cash",
          accountType: "ASSET",
        },
      ]);

      // GL 102 prior totals
      repository.getAccountPriorTotals
        .mockResolvedValueOnce({ totalDebit: 15000, totalCredit: 5000 }) // HDFC open = 10,000
        .mockResolvedValueOnce({ totalDebit: 2000, totalCredit: 500 }); // Cash open = 1,500

      repository.getPostedJournalLinesInDateRange.mockResolvedValue([
        { accountId: 102, debit: "4000.00", credit: "1000.00" },
        { accountId: 101, debit: "500.00", credit: "200.00" },
      ]);

      const result = await service.getCashBankSummary({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });

      expect(result.accounts).toHaveLength(2);
      const cash = result.accounts.find((a) => a.type === "CASH");
      expect(cash?.openingBalance).toBe(1500);
      expect(cash?.totalInflows).toBe(500);
      expect(cash?.totalOutflows).toBe(200);
      expect(cash?.closingBalance).toBe(1800);

      const bank = result.accounts.find((a) => a.type === "BANK");
      expect(bank?.openingBalance).toBe(10000);
      expect(bank?.totalInflows).toBe(4000);
      expect(bank?.totalOutflows).toBe(1000);
      expect(bank?.closingBalance).toBe(13000);
    });
  });

  describe("Period Closing Status Audit (getPeriodClosingStatus)", () => {
    it("reports canClose as true when no draft entries exist and debits equal credits", async () => {
      const { service, repository } = makeService();

      repository.getPeriodClosingAuditData.mockResolvedValueOnce({
        draftEntriesCount: 0,
        postedEntriesCount: 25,
        totalDebit: 50000,
        totalCredit: 50000,
        unreconciledBankTransactionsCount: 0,
      });

      repository.getPostedJournalLinesInDateRange.mockResolvedValueOnce([]);

      const result = await service.getPeriodClosingStatus({
        period: "2026-10",
      });

      expect(result.period).toBe("2026-10");
      expect(result.startDate).toBe("2026-10-01");
      expect(result.endDate).toBe("2026-10-31");
      expect(result.isBalanced).toBe(true);
      expect(result.draftEntriesCount).toBe(0);
      expect(result.canClose).toBe(true);
      expect(result.validationMessages).toHaveLength(0);
    });

    it("blocks period closing when unposted drafts or unbalanced totals exist", async () => {
      const { service, repository } = makeService();

      repository.getPeriodClosingAuditData.mockResolvedValueOnce({
        draftEntriesCount: 3,
        postedEntriesCount: 20,
        totalDebit: 45000,
        totalCredit: 44000,
        unreconciledBankTransactionsCount: 2,
      });

      repository.getPostedJournalLinesInDateRange.mockResolvedValueOnce([]);

      const result = await service.getPeriodClosingStatus({
        period: "2026-10",
      });

      expect(result.canClose).toBe(false);
      expect(result.isBalanced).toBe(false);
      expect(result.validationMessages.length).toBeGreaterThanOrEqual(2);
      expect(
        result.validationMessages.some((msg) => msg.includes("unposted draft")),
      ).toBe(true);
      expect(
        result.validationMessages.some((msg) => msg.includes("do not balance")),
      ).toBe(true);
      expect(
        result.validationMessages.some((msg) => msg.includes("unreconciled")),
      ).toBe(true);
    });
  });
});
