import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { BankTransactionsRepository } from "./bank-transactions.repository.js";
import { QueryBankTransactionsDto } from "./dto/query-bank-transactions.dto.js";

const SCOPE_A = { organizationId: 10 };
const USER_ID = 55;

function makeRepository() {
  const financeBankTransaction = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi
      .fn()
      .mockResolvedValue({ id: 101, amount: 500, balanceAfter: 10500 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeBankAccount = {
    findFirst: vi.fn().mockResolvedValue({ id: 1, currentBalance: 10000 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeJournalEntry = {
    create: vi.fn().mockResolvedValue({ id: 501 }),
  };

  const financeJournalLine = {
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };

  const financeAccount = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const txMock = {
    financeBankTransaction,
    financeBankAccount,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
  };

  const prisma = {
    financeBankTransaction,
    financeBankAccount,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) =>
      cb(txMock),
    ),
  };

  const repository = new BankTransactionsRepository(
    prisma as unknown as PrismaService,
  );
  return { repository, txMock };
}

describe("BankTransactionsRepository", () => {
  it("scopes findMany to tenant organization", async () => {
    const { repository, txMock } = makeRepository();
    const query = new QueryBankTransactionsDto();

    await repository.findMany(SCOPE_A, query);

    expect(txMock.financeBankTransaction.findMany).toHaveBeenCalled();
    const callArgs = txMock.financeBankTransaction.findMany.mock
      .calls[0]?.[0] as {
      where?: { organizationId?: number };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
  });

  it("filters transactions by bankAccountId, transactionType, and reconciliation status", async () => {
    const { repository, txMock } = makeRepository();
    const query = new QueryBankTransactionsDto();
    query.bankAccountId = 1;
    query.transactionType = "DEBIT";
    query.isReconciled = true;

    await repository.findMany(SCOPE_A, query);

    expect(txMock.financeBankTransaction.findMany).toHaveBeenCalled();
    const callArgs = txMock.financeBankTransaction.findMany.mock
      .calls[0]?.[0] as {
      where?: {
        organizationId?: number;
        bankAccountId?: number;
        transactionType?: string;
        isReconciled?: boolean;
      };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.where?.bankAccountId).toBe(1);
    expect(callArgs?.where?.transactionType).toBe("DEBIT");
    expect(callArgs?.where?.isReconciled).toBe(true);
  });

  it("atomically records CREDIT transaction, increments bank balance, and posts GL journal", async () => {
    const { repository, txMock } = makeRepository();

    const result = await repository.recordTransactionWithBalance(
      SCOPE_A,
      1,
      {
        transactionDate: new Date("2026-10-23"),
        transactionType: "CREDIT",
        amount: 500,
        description: "Interest credited",
        referenceNumber: "INT-001",
        createdBy: USER_ID,
      },
      {
        entryNumber: "JV-202610-0010",
        entryDate: new Date("2026-10-23"),
        entryType: "BANK_TRANSFER",
        narration: "Bank interest credit",
        totalDebit: 500,
        totalCredit: 500,
        lines: [
          { accountId: 20, lineOrder: 0, debit: 500, credit: 0 },
          { accountId: 80, lineOrder: 1, debit: 0, credit: 500 },
        ],
        balanceDeltas: [
          { accountId: 20, delta: 500 },
          { accountId: 80, delta: 500 },
        ],
      },
    );

    expect(result).toBeDefined();
    // Bank account updated to 10000 + 500 = 10500
    expect(txMock.financeBankAccount.updateMany).toHaveBeenCalled();
    const updateCall = txMock.financeBankAccount.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { currentBalance?: number };
    };
    expect(updateCall?.where?.id).toBe(1);
    expect(updateCall?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(updateCall?.data?.currentBalance).toBe(10500);

    // Journal entry created
    expect(txMock.financeJournalEntry.create).toHaveBeenCalled();
    // Bank transaction created
    expect(txMock.financeBankTransaction.create).toHaveBeenCalled();
    const txCreateCall = txMock.financeBankTransaction.create.mock
      .calls[0]?.[0] as {
      data?: {
        bankAccountId?: number;
        transactionType?: string;
        amount?: number;
        balanceAfter?: number;
        matchedJournalEntryId?: number;
        isReconciled?: boolean;
      };
    };
    expect(txCreateCall?.data?.bankAccountId).toBe(1);
    expect(txCreateCall?.data?.transactionType).toBe("CREDIT");
    expect(txCreateCall?.data?.amount).toBe(500);
    expect(txCreateCall?.data?.balanceAfter).toBe(10500);
    expect(txCreateCall?.data?.matchedJournalEntryId).toBe(501);
    expect(txCreateCall?.data?.isReconciled).toBe(true);
  });

  it("atomically records DEBIT transaction and decrements bank balance", async () => {
    const { repository, txMock } = makeRepository();

    await repository.recordTransactionWithBalance(
      SCOPE_A,
      1,
      {
        transactionDate: new Date("2026-10-23"),
        transactionType: "DEBIT",
        amount: 200,
        description: "Bank service charges",
        createdBy: USER_ID,
      },
      null,
    );

    // Bank account updated to 10000 - 200 = 9800
    expect(txMock.financeBankAccount.updateMany).toHaveBeenCalled();
    const updateCall = txMock.financeBankAccount.updateMany.mock
      .calls[0]?.[0] as {
      data?: { currentBalance?: number };
    };
    expect(updateCall?.data?.currentBalance).toBe(9800);

    // Unreconciled transaction created
    expect(txMock.financeBankTransaction.create).toHaveBeenCalled();
    const createCall = txMock.financeBankTransaction.create.mock
      .calls[0]?.[0] as {
      data?: {
        bankAccountId?: number;
        transactionType?: string;
        amount?: number;
        balanceAfter?: number;
        isReconciled?: boolean;
      };
    };
    expect(createCall?.data?.bankAccountId).toBe(1);
    expect(createCall?.data?.transactionType).toBe("DEBIT");
    expect(createCall?.data?.amount).toBe(200);
    expect(createCall?.data?.balanceAfter).toBe(9800);
    expect(createCall?.data?.isReconciled).toBe(false);
  });

  it("reconciles transaction and marks timestamp", async () => {
    const { repository, txMock } = makeRepository();

    await repository.reconcile(SCOPE_A, 101, 501);

    expect(txMock.financeBankTransaction.updateMany).toHaveBeenCalled();
    const callArgs = txMock.financeBankTransaction.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: {
        isReconciled?: boolean;
        matchedJournalEntryId?: number;
        reconciledAt?: Date;
      };
    };
    expect(callArgs?.where?.id).toBe(101);
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.data?.isReconciled).toBe(true);
    expect(callArgs?.data?.reconciledAt).toBeInstanceOf(Date);
    expect(callArgs?.data?.matchedJournalEntryId).toBe(501);
  });

  it("unreconciles transaction and clears reconciledAt", async () => {
    const { repository, txMock } = makeRepository();

    await repository.unreconcile(SCOPE_A, 101);

    expect(txMock.financeBankTransaction.updateMany).toHaveBeenCalled();
    const callArgs = txMock.financeBankTransaction.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { isReconciled?: boolean; reconciledAt?: unknown };
    };
    expect(callArgs?.where?.id).toBe(101);
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.data?.isReconciled).toBe(false);
    expect(callArgs?.data?.reconciledAt).toBeNull();
  });
});
