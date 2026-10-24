import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { BankingService } from "./banking.service.js";
import type { BankAccountsRepository } from "./bank-accounts.repository.js";
import type { BankTransactionsRepository } from "./bank-transactions.repository.js";
import type { JournalEntriesRepository } from "../journal/journal-entries.repository.js";
import { QueryBankAccountsDto } from "./dto/query-bank-accounts.dto.js";
import { QueryBankTransactionsDto } from "./dto/query-bank-transactions.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 24;

const MOCK_ACCOUNT = {
  id: 1,
  organizationId: 1,
  accountName: "HDFC Operating Current",
  accountNumber: "50200012345678",
  bankName: "HDFC Bank",
  ifscCode: "HDFC0001234",
  branchName: "Koramangala",
  accountType: "CURRENT",
  currency: "INR",
  openingBalance: "10000.00",
  currentBalance: "10000.00",
  glAccountId: 20,
  isActive: true,
  deletedAt: null,
};

const MOCK_TX = {
  id: 10,
  organizationId: 1,
  bankAccountId: 1,
  transactionDate: "2026-10-23T00:00:00.000Z",
  transactionType: "CREDIT",
  amount: "5000.00",
  balanceAfter: "15000.00",
  description: "Client wire deposit",
  referenceNumber: "WIRE-9901",
  matchedJournalEntryId: 50,
  isReconciled: true,
  reconciledAt: "2026-10-23T00:00:00.000Z",
};

function makeService() {
  const accountsRepository = {
    findMany: vi.fn().mockResolvedValue({ items: [MOCK_ACCOUNT], total: 1 }),
    findById: vi.fn().mockResolvedValue(MOCK_ACCOUNT),
    findByAccountNumber: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(MOCK_ACCOUNT),
    update: vi
      .fn()
      .mockResolvedValue({ ...MOCK_ACCOUNT, accountName: "Updated Name" }),
    softDelete: vi.fn().mockResolvedValue(true),
  };

  const transactionsRepository = {
    findMany: vi.fn().mockResolvedValue({ items: [MOCK_TX], total: 1 }),
    findById: vi.fn().mockResolvedValue(MOCK_TX),
    recordTransactionWithBalance: vi.fn().mockResolvedValue(MOCK_TX),
    reconcile: vi.fn().mockResolvedValue({ ...MOCK_TX, isReconciled: true }),
    unreconcile: vi
      .fn()
      .mockResolvedValue({
        ...MOCK_TX,
        isReconciled: false,
        reconciledAt: null,
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
    financeAccount: {
      findFirst: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { id?: number; accountCode?: string } }) => {
            if (where.id === 20 || where.accountCode === "1020") {
              return Promise.resolve({
                id: 20,
                accountCode: "1020",
                accountName: "Bank Account",
                accountType: "ASSET",
              });
            }
            if (where.id === 70) {
              return Promise.resolve({
                id: 70,
                accountCode: "4010",
                accountName: "Interest Income",
                accountType: "REVENUE",
              });
            }
            if (where.id === 99) {
              return Promise.resolve({
                id: 99,
                accountCode: "5010",
                accountName: "Bank Charges",
                accountType: "EXPENSE",
              });
            }
            return Promise.resolve(null);
          },
        ),
    },
    financeJournalEntry: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 50, entryNumber: "JV-202610-0001" }),
    },
  };

  const service = new BankingService(
    accountsRepository as unknown as BankAccountsRepository,
    transactionsRepository as unknown as BankTransactionsRepository,
    journalRepository as unknown as JournalEntriesRepository,
    tenantContext as unknown as TenantContextService,
    prisma as unknown as PrismaService,
  );

  return {
    service,
    accountsRepository,
    transactionsRepository,
    journalRepository,
    prisma,
  };
}

describe("BankingService", () => {
  describe("Bank Accounts", () => {
    it("returns paginated bank accounts", async () => {
      const { service } = makeService();
      const res = await service.findAllAccounts(new QueryBankAccountsDto());
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it("throws ResourceNotFoundException when bank account does not exist", async () => {
      const { service, accountsRepository } = makeService();
      accountsRepository.findById.mockResolvedValue(null);

      await expect(service.findAccountById(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("creates bank account with ASSET glAccountId", async () => {
      const { service, accountsRepository } = makeService();

      const created = await service.createAccount({
        accountName: "HDFC Operating Current",
        accountNumber: "50200012345678",
        bankName: "HDFC Bank",
        ifscCode: "HDFC0001234",
        openingBalance: 10000,
        glAccountId: 20,
      });

      expect(created).toBeDefined();
      expect(accountsRepository.create).toHaveBeenCalled();
    });

    it("rejects duplicate account number in the same tenant", async () => {
      const { service, accountsRepository } = makeService();
      accountsRepository.findByAccountNumber.mockResolvedValue(MOCK_ACCOUNT);

      await expect(
        service.createAccount({
          accountName: "Duplicate",
          accountNumber: "50200012345678",
          bankName: "HDFC Bank",
          ifscCode: "HDFC0001234",
        }),
      ).rejects.toThrow(ResourceConflictException);
    });

    it("rejects non-ASSET glAccountId", async () => {
      const { service, prisma } = makeService();
      prisma.financeAccount.findFirst.mockResolvedValue({
        id: 33,
        accountCode: "2010",
        accountType: "LIABILITY",
      });

      await expect(
        service.createAccount({
          accountName: "Bad GL Account",
          accountNumber: "12345",
          bankName: "Test Bank",
          ifscCode: "TEST0001",
          glAccountId: 33,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("soft deletes bank account", async () => {
      const { service, accountsRepository } = makeService();
      await service.deleteAccount(1);
      expect(accountsRepository.softDelete).toHaveBeenCalledWith(
        SCOPE,
        1,
        USER_ID,
      );
    });
  });

  describe("Bank Transactions", () => {
    it("returns paginated bank transactions", async () => {
      const { service } = makeService();
      const res = await service.findAllTransactions(
        new QueryBankTransactionsDto(),
      );
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it("throws ResourceNotFoundException when transaction does not exist", async () => {
      const { service, transactionsRepository } = makeService();
      transactionsRepository.findById.mockResolvedValue(null);

      await expect(service.findTransactionById(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("rejects negative transaction amount", async () => {
      const { service } = makeService();

      await expect(
        service.recordTransaction({
          bankAccountId: 1,
          transactionDate: "2026-10-23",
          transactionType: "CREDIT",
          amount: -50,
          description: "Invalid",
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("rejects future transaction date", async () => {
      const { service } = makeService();

      await expect(
        service.recordTransaction({
          bankAccountId: 1,
          transactionDate: "2099-01-01",
          transactionType: "CREDIT",
          amount: 50,
          description: "Future",
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("records CREDIT transaction and generates balanced GL entry when counter GL provided", async () => {
      const { service, transactionsRepository } = makeService();

      await service.recordTransaction({
        bankAccountId: 1,
        transactionDate: "2026-10-23",
        transactionType: "CREDIT",
        amount: 500,
        description: "Bank Interest",
        counterGlAccountId: 70, // REVENUE
      });

      expect(
        transactionsRepository.recordTransactionWithBalance,
      ).toHaveBeenCalled();
      const call = transactionsRepository.recordTransactionWithBalance.mock
        .calls[0] as [
        unknown,
        number,
        { transactionType: string; amount: number },
        {
          totalDebit: number;
          totalCredit: number;
          lines: Array<{ accountId: number; debit: number; credit: number }>;
        },
      ];
      expect(call[0]).toEqual(SCOPE);
      expect(call[1]).toBe(1);
      expect(call[2].transactionType).toBe("CREDIT");
      expect(call[2].amount).toBe(500);
      expect(call[3].totalDebit).toBe(500);
      expect(call[3].totalCredit).toBe(500);
      expect(call[3].lines[0]?.accountId).toBe(20);
      expect(call[3].lines[1]?.accountId).toBe(70);
    });

    it("records DEBIT transaction and generates balanced GL entry when counter GL provided", async () => {
      const { service, transactionsRepository } = makeService();

      await service.recordTransaction({
        bankAccountId: 1,
        transactionDate: "2026-10-23",
        transactionType: "DEBIT",
        amount: 250,
        description: "Bank Fee",
        counterGlAccountId: 99, // EXPENSE
      });

      expect(
        transactionsRepository.recordTransactionWithBalance,
      ).toHaveBeenCalled();
      const call = transactionsRepository.recordTransactionWithBalance.mock
        .calls[0] as [
        unknown,
        number,
        { transactionType: string; amount: number },
        {
          totalDebit: number;
          totalCredit: number;
          lines: Array<{ accountId: number; debit: number; credit: number }>;
        },
      ];
      expect(call[0]).toEqual(SCOPE);
      expect(call[1]).toBe(1);
      expect(call[2].transactionType).toBe("DEBIT");
      expect(call[2].amount).toBe(250);
      expect(call[3].totalDebit).toBe(250);
      expect(call[3].totalCredit).toBe(250);
      expect(call[3].lines[0]?.accountId).toBe(99);
      expect(call[3].lines[1]?.accountId).toBe(20);
    });

    it("reconciles transaction when matched journal entry exists", async () => {
      const { service, transactionsRepository } = makeService();

      await service.reconcileTransaction(10, { matchedJournalEntryId: 50 });

      expect(transactionsRepository.reconcile).toHaveBeenCalledWith(
        SCOPE,
        10,
        50,
      );
    });

    it("unreconciles transaction", async () => {
      const { service, transactionsRepository } = makeService();

      await service.unreconcileTransaction(10);

      expect(transactionsRepository.unreconcile).toHaveBeenCalledWith(
        SCOPE,
        10,
      );
    });
  });
});
