import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { QueryPaymentsMadeDto } from "./dto/query-payments-made.dto.js";
import { PaymentsMadeRepository } from "./payments-made.repository.js";

const SCOPE_A = { organizationId: 10 };
const USER_ID = 88;

function makeRepository() {
  const financePaymentMade = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi
      .fn()
      .mockResolvedValue({ id: 1, paymentNumber: "PM-202610-0001" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeBankAccount = {
    findFirst: vi.fn().mockResolvedValue({ id: 2, currentBalance: 50000 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeBankTransaction = {
    create: vi.fn().mockResolvedValue({ id: 101 }),
  };

  const financeJournalEntry = {
    create: vi.fn().mockResolvedValue({ id: 201 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeJournalLine = {
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };

  const financeAccount = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const txMock = {
    financePaymentMade,
    financeBankAccount,
    financeBankTransaction,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
  };

  const prisma = {
    financePaymentMade,
    financeBankAccount,
    financeBankTransaction,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) =>
      cb(txMock),
    ),
  };

  const repository = new PaymentsMadeRepository(
    prisma as unknown as PrismaService,
  );
  return { repository, txMock };
}

describe("PaymentsMadeRepository", () => {
  it("enforces tenant organization scoping on findMany", async () => {
    const { repository, txMock } = makeRepository();
    const query = new QueryPaymentsMadeDto();

    await repository.findMany(SCOPE_A, query);

    expect(txMock.financePaymentMade.findMany).toHaveBeenCalled();
    const callArgs = txMock.financePaymentMade.findMany.mock.calls[0]?.[0] as {
      where?: { organizationId?: number };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
  });

  it("applies filters by vendorName search, paymentModeId, and status", async () => {
    const { repository, txMock } = makeRepository();
    const query = new QueryPaymentsMadeDto();
    query.paymentModeId = 3;
    query.status = "CONFIRMED";
    query.search = "Supplier Corp";

    await repository.findMany(SCOPE_A, query);

    expect(txMock.financePaymentMade.findMany).toHaveBeenCalled();
    const callArgs = txMock.financePaymentMade.findMany.mock.calls[0]?.[0] as {
      where?: {
        organizationId?: number;
        paymentModeId?: number;
        status?: string;
        OR?: Array<Record<string, unknown>>;
      };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.where?.paymentModeId).toBe(3);
    expect(callArgs?.where?.status).toBe("CONFIRMED");
    expect(callArgs?.where?.OR).toBeDefined();
  });

  it("generates sequential payment number formatted PM-YYYYMM-0001", async () => {
    const { repository, txMock } = makeRepository();
    txMock.financePaymentMade.findFirst.mockResolvedValue(null);

    const num = await repository.generateNextPaymentNumber(SCOPE_A);

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(num).toBe(`PM-${ym}-0001`);
  });

  it("increments sequence number when previous payment exists", async () => {
    const { repository, txMock } = makeRepository();
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    txMock.financePaymentMade.findFirst.mockResolvedValue({
      paymentNumber: `PM-${ym}-0042`,
    });

    const num = await repository.generateNextPaymentNumber(SCOPE_A);
    expect(num).toBe(`PM-${ym}-0043`);
  });

  it("atomically confirms payment, posts GL journal, and deducts bank balance", async () => {
    const { repository, txMock } = makeRepository();

    await repository.postAndConfirmPayment(
      SCOPE_A,
      1,
      {
        entryNumber: "JV-202610-0005",
        entryDate: new Date("2026-10-23"),
        entryType: "PAYMENT_MADE",
        narration: "Vendor disbursement",
        totalDebit: 1500,
        totalCredit: 1500,
        lines: [
          { accountId: 50, lineOrder: 0, debit: 1500, credit: 0 },
          { accountId: 20, lineOrder: 1, debit: 0, credit: 1500 },
        ],
      },
      [
        { accountId: 50, delta: -1500 },
        { accountId: 20, delta: -1500 },
      ],
      {
        id: 2,
        delta: -1500,
        paymentNumber: "PM-202610-0001",
        vendorName: "Steel Suppliers Ltd",
      },
      USER_ID,
    );

    // Creates journal entry
    expect(txMock.financeJournalEntry.create).toHaveBeenCalled();
    // Updates GL accounts
    expect(txMock.financeAccount.updateMany).toHaveBeenCalledTimes(2);
    // Deducts bank balance (50000 - 1500 = 48500)
    expect(txMock.financeBankAccount.updateMany).toHaveBeenCalled();
    const bankUpdate = txMock.financeBankAccount.updateMany.mock
      .calls[0]?.[0] as {
      data?: { currentBalance?: number };
    };
    expect(bankUpdate?.data?.currentBalance).toBe(48500);

    // Creates DEBIT bank transaction
    expect(txMock.financeBankTransaction.create).toHaveBeenCalled();
    const txCreate = txMock.financeBankTransaction.create.mock
      .calls[0]?.[0] as {
      data?: {
        transactionType?: string;
        amount?: number;
        balanceAfter?: number;
      };
    };
    expect(txCreate?.data?.transactionType).toBe("DEBIT");
    expect(txCreate?.data?.amount).toBe(1500);
    expect(txCreate?.data?.balanceAfter).toBe(48500);

    // Marks payment status as CONFIRMED
    expect(txMock.financePaymentMade.updateMany).toHaveBeenCalled();
    const paymentUpdate = txMock.financePaymentMade.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { status?: string };
    };
    expect(paymentUpdate?.where?.id).toBe(1);
    expect(paymentUpdate?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(paymentUpdate?.data?.status).toBe("CONFIRMED");
  });

  it("atomically voids payment, reverses journal voucher, and restores bank balance", async () => {
    const { repository, txMock } = makeRepository();

    await repository.voidAndReversePayment(
      SCOPE_A,
      1,
      {
        originalJournalEntryId: 201,
        reversalEntryNumber: "REV-202610-0001",
        reversalDate: new Date("2026-10-23"),
        narration: "Void reversal",
        totalDebit: 1500,
        totalCredit: 1500,
        lines: [
          { accountId: 20, lineOrder: 0, debit: 1500, credit: 0 },
          { accountId: 50, lineOrder: 1, debit: 0, credit: 1500 },
        ],
      },
      [
        { accountId: 20, delta: 1500 },
        { accountId: 50, delta: 1500 },
      ],
      {
        id: 2,
        delta: 1500,
        paymentNumber: "PM-202610-0001",
        vendorName: "Steel Suppliers Ltd",
      },
      USER_ID,
    );

    // Original journal marked as REVERSED
    expect(txMock.financeJournalEntry.updateMany).toHaveBeenCalled();
    const journalUpdate = txMock.financeJournalEntry.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { status?: string };
    };
    expect(journalUpdate?.where?.id).toBe(201);
    expect(journalUpdate?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(journalUpdate?.data?.status).toBe("REVERSED");

    // Restores bank balance (50000 + 1500 = 51500)
    expect(txMock.financeBankAccount.updateMany).toHaveBeenCalled();
    const bankUpdate = txMock.financeBankAccount.updateMany.mock
      .calls[0]?.[0] as {
      data?: { currentBalance?: number };
    };
    expect(bankUpdate?.data?.currentBalance).toBe(51500);

    // Creates offsetting CREDIT bank transaction
    expect(txMock.financeBankTransaction.create).toHaveBeenCalled();
    const txCreate = txMock.financeBankTransaction.create.mock
      .calls[0]?.[0] as {
      data?: {
        transactionType?: string;
        amount?: number;
        balanceAfter?: number;
      };
    };
    expect(txCreate?.data?.transactionType).toBe("CREDIT");
    expect(txCreate?.data?.amount).toBe(1500);
    expect(txCreate?.data?.balanceAfter).toBe(51500);

    // Marks payment status as VOID
    expect(txMock.financePaymentMade.updateMany).toHaveBeenCalled();
    const paymentUpdate = txMock.financePaymentMade.updateMany.mock
      .calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { status?: string };
    };
    expect(paymentUpdate?.where?.id).toBe(1);
    expect(paymentUpdate?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(paymentUpdate?.data?.status).toBe("VOID");
  });

  it("soft deletes draft or void payment", async () => {
    const { repository, txMock } = makeRepository();

    const ok = await repository.softDelete(SCOPE_A, 1, USER_ID);

    expect(ok).toBe(true);
    expect(txMock.financePaymentMade.updateMany).toHaveBeenCalled();
    const callArgs = txMock.financePaymentMade.updateMany.mock
      .calls[0]?.[0] as {
      data?: { deletedAt?: Date; updatedBy?: number };
    };
    expect(callArgs?.data?.deletedAt).toBeInstanceOf(Date);
    expect(callArgs?.data?.updatedBy).toBe(USER_ID);
  });
});
