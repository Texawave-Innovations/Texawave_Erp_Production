import { describe, expect, it, vi } from "vitest";
import { ReportsRepository } from "./reports.repository.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };

function makeRepository() {
  const financeAccount = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  };
  const financeJournalLine = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi
      .fn()
      .mockResolvedValue({ _sum: { debit: "1500.00", credit: "1500.00" } }),
  };
  const financeJournalEntry = {
    count: vi.fn().mockResolvedValue(0),
  };
  const financeBankAccount = {
    findMany: vi.fn().mockResolvedValue([]),
  };
  const financeBankTransaction = {
    count: vi.fn().mockResolvedValue(0),
  };

  const prisma = {
    financeAccount,
    financeJournalLine,
    financeJournalEntry,
    financeBankAccount,
    financeBankTransaction,
  };

  const repository = new ReportsRepository(prisma as never);
  return {
    repository,
    financeAccount,
    financeJournalLine,
    financeJournalEntry,
    financeBankAccount,
    financeBankTransaction,
  };
}

describe("ReportsRepository", () => {
  describe("@OrgScoped() validation", () => {
    it("throws synchronously if called without a valid OrgScope", () => {
      const { repository } = makeRepository();
      // @ts-expect-error Testing invalid runtime scope
      expect(() => repository.getAccounts(null)).toThrow(
        /called without a valid OrgScope/,
      );
      // @ts-expect-error Testing undefined runtime scope
      expect(() =>
        repository.getPostedJournalLinesInDateRange(
          undefined,
          new Date(),
          new Date(),
        ),
      ).toThrow(/called without a valid OrgScope/);
      // @ts-expect-error Testing empty object scope
      expect(() => repository.getAccountById({}, 1)).toThrow(
        /called without a valid OrgScope/,
      );
    });
  });

  describe("getAccounts", () => {
    it("scopes account retrieval by organizationId and excludes deleted", async () => {
      const { repository, financeAccount } = makeRepository();
      await repository.getAccounts(SCOPE_A, ["ASSET", "EXPENSE"]);

      expect(financeAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            deletedAt: null,
            isActive: true,
            accountType: { in: ["ASSET", "EXPENSE"] },
          },
          orderBy: { accountCode: "asc" },
        }),
      );
    });
  });

  describe("getPostedJournalLinesInDateRange", () => {
    it("filters only POSTED entries within the given date bounds and tenant", async () => {
      const { repository, financeJournalLine } = makeRepository();
      const start = new Date("2026-10-01T00:00:00.000Z");
      const end = new Date("2026-10-31T23:59:59.999Z");

      await repository.getPostedJournalLinesInDateRange(SCOPE_B, start, end);

      expect(financeJournalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 20,
            journalEntry: {
              status: "POSTED",
              entryDate: {
                gte: start,
                lte: end,
              },
            },
          },
        }),
      );
    });
  });

  describe("getPostedJournalLinesUpToDate", () => {
    it("queries cumulative posted lines up to asOfDate for the tenant", async () => {
      const { repository, financeJournalLine } = makeRepository();
      const asOf = new Date("2026-10-31T23:59:59.999Z");

      await repository.getPostedJournalLinesUpToDate(SCOPE_A, asOf);

      expect(financeJournalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            journalEntry: {
              status: "POSTED",
              entryDate: {
                lte: asOf,
              },
            },
          },
        }),
      );
    });
  });

  describe("getAccountPriorTotals", () => {
    it("sums debits and credits prior to start date correctly", async () => {
      const { repository, financeJournalLine } = makeRepository();
      financeJournalLine.findMany.mockResolvedValueOnce([
        { debit: "100.50", credit: "20.25" },
        { debit: "50.00", credit: "10.00" },
      ]);

      const res = await repository.getAccountPriorTotals(
        SCOPE_A,
        15,
        new Date("2026-10-01T00:00:00.000Z"),
      );

      expect(res.totalDebit).toBe(150.5);
      expect(res.totalCredit).toBe(30.25);
    });
  });

  describe("getAccountLedgerLines", () => {
    it("queries lines with pagination and ordering", async () => {
      const { repository, financeJournalLine } = makeRepository();
      financeJournalLine.findMany.mockResolvedValueOnce([]);
      financeJournalLine.count.mockResolvedValueOnce(5);

      const res = await repository.getAccountLedgerLines(
        SCOPE_A,
        10,
        new Date("2026-10-01"),
        new Date("2026-10-31"),
        10,
        25,
      );

      expect(financeJournalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 25,
        }),
      );
      expect(res.total).toBe(5);
    });
  });

  describe("getPeriodClosingAuditData", () => {
    it("returns counts and aggregate totals", async () => {
      const { repository, financeJournalEntry, financeBankTransaction } =
        makeRepository();
      financeJournalEntry.count
        .mockResolvedValueOnce(2) // draft
        .mockResolvedValueOnce(18); // posted
      financeBankTransaction.count.mockResolvedValueOnce(1); // unreconciled

      const res = await repository.getPeriodClosingAuditData(
        SCOPE_A,
        new Date("2026-10-01"),
        new Date("2026-10-31"),
      );

      expect(res.draftEntriesCount).toBe(2);
      expect(res.postedEntriesCount).toBe(18);
      expect(res.totalDebit).toBe(1500);
      expect(res.totalCredit).toBe(1500);
      expect(res.unreconciledBankTransactionsCount).toBe(1);
    });
  });
});
