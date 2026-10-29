import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@texawave-erp/database";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { ExpensesRepository } from "./expenses.repository.js";
import { QueryExpensesDto } from "./dto/query-expenses.dto.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };
const USER_ID = 88;

function makeRepository() {
  const financeExpense = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeJournalEntry = {
    create: vi.fn().mockResolvedValue({ id: 50 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeJournalLine = {
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };

  const financeAccount = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const prisma = {
    financeExpense,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        financeExpense,
        financeJournalEntry,
        financeJournalLine,
        financeAccount,
      }),
    ),
  };

  const repository = new ExpensesRepository(prisma as unknown as PrismaService);
  return {
    repository,
    financeExpense,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
  };
}

describe("ExpensesRepository", () => {
  describe("Tenant Isolation & Querying", () => {
    it("findMany() applies tenant filter and pagination", async () => {
      const { repository, financeExpense } = makeRepository();
      const query = Object.assign(new QueryExpensesDto(), {
        page: 2,
        limit: 15,
        status: "APPROVED" as const,
        search: "Acme",
      });

      await repository.findMany(SCOPE_A, query);

      const [findManyArg] = financeExpense.findMany.mock.calls[0] as [
        {
          where: Record<string, unknown>;
          skip: number;
          take: number;
        },
      ];
      expect(findManyArg.where.organizationId).toBe(10);
      expect(findManyArg.where.status).toBe("APPROVED");
      expect(findManyArg.where.deletedAt).toBeNull();
      expect(findManyArg.skip).toBe(15);
      expect(findManyArg.take).toBe(15);
    });

    it("findById() restricts query to scope.organizationId", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.findById(SCOPE_B, 42);

      const [findArg] = financeExpense.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(findArg.where.id).toBe(42);
      expect(findArg.where.organizationId).toBe(20);
      expect(findArg.where.deletedAt).toBeNull();
    });

    it("findByExpenseNumber() restricts to scope.organizationId", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.findByExpenseNumber(SCOPE_A, "EXP-202610-0001");

      const [findArg] = financeExpense.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(findArg.where.expenseNumber).toBe("EXP-202610-0001");
      expect(findArg.where.organizationId).toBe(10);
    });

    it("findByHrExpenseClaimId() restricts to scope.organizationId", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.findByHrExpenseClaimId(SCOPE_A, 99);

      const [findArg] = financeExpense.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(findArg.where.hrExpenseClaimId).toBe(99);
      expect(findArg.where.organizationId).toBe(10);
    });

    it("generateNextExpenseNumber() formats sequence scoped to organizationId", async () => {
      const { repository, financeExpense } = makeRepository();
      financeExpense.count.mockResolvedValue(4);

      const expenseNumber = await repository.generateNextExpenseNumber(
        SCOPE_A,
        "EXP",
      );

      const [countArg] = financeExpense.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(countArg.where.organizationId).toBe(10);
      expect(expenseNumber).toMatch(/^EXP-\d{6}-0005$/);
    });
  });

  describe("Mutations", () => {
    it("create() persists expense under scope.organizationId", async () => {
      const { repository, financeExpense } = makeRepository();
      const data = {
        expenseNumber: "EXP-202610-0001",
        expenseTypeId: 1,
        expenseDate: new Date("2026-10-23"),
        amount: 1000,
        taxAmount: 180,
        netAmount: 1180,
        status: "DRAFT",
      };

      await repository.create(
        SCOPE_A,
        data as unknown as Prisma.FinanceExpenseUncheckedCreateInput,
      );

      const [createArg] = financeExpense.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArg.data.organizationId).toBe(10);
      expect(createArg.data.expenseNumber).toBe("EXP-202610-0001");
      expect(createArg.data.netAmount).toBe(1180);
    });

    it("update() restricts modification to scope.organizationId", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.update(SCOPE_B, 55, { notes: "Updated note" });

      const [updateArg] = financeExpense.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(updateArg.where.id).toBe(55);
      expect(updateArg.where.organizationId).toBe(20);
      expect(updateArg.where.deletedAt).toBeNull();
      expect(updateArg.data.notes).toBe("Updated note");
    });

    it("updateStatus() updates status only when matching fromStatuses and org", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.updateStatus(
        SCOPE_A,
        12,
        ["DRAFT"],
        "PENDING_APPROVAL",
        USER_ID,
      );

      const [statusArg] = financeExpense.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(statusArg.where.id).toBe(12);
      expect(statusArg.where.organizationId).toBe(10);
      expect(statusArg.where.status).toEqual({ in: ["DRAFT"] });
      expect(statusArg.data.status).toBe("PENDING_APPROVAL");
      expect(statusArg.data.updatedBy).toBe(USER_ID);
    });

    it("softDelete() marks deletedAt only for DRAFT or CANCELLED within scope", async () => {
      const { repository, financeExpense } = makeRepository();

      await repository.softDelete(SCOPE_A, 22, USER_ID);

      const [deleteArg] = financeExpense.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(deleteArg.where.id).toBe(22);
      expect(deleteArg.where.organizationId).toBe(10);
      expect(deleteArg.where.status).toEqual({ in: ["DRAFT", "CANCELLED"] });
      expect(deleteArg.data.updatedBy).toBe(USER_ID);
    });
  });

  describe("GL Accounting Atomic Operations", () => {
    it("payAndPostExpense() creates journal voucher, updates GL balances and marks expense PAID", async () => {
      const {
        repository,
        financeExpense,
        financeJournalEntry,
        financeAccount,
      } = makeRepository();

      await repository.payAndPostExpense(
        SCOPE_A,
        15,
        {
          entryNumber: "JV-202610-0001",
          entryDate: new Date("2026-10-23"),
          entryType: "EXPENSE",
          narration: "Expense EXP-001",
          referenceNumber: "EXP-001",
          totalDebit: 500,
          totalCredit: 500,
          lines: [
            { accountId: 10, lineOrder: 0, debit: 500, credit: 0 },
            { accountId: 20, lineOrder: 1, debit: 0, credit: 500 },
          ],
        },
        [
          { accountId: 10, delta: 500 },
          { accountId: 20, delta: -500 },
        ],
        { paymentModeId: 2, bankAccountId: 1, glAccountId: 10 },
        USER_ID,
      );

      // Verify journal creation
      const [journalArg] = financeJournalEntry.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(journalArg.data.organizationId).toBe(10);
      expect(journalArg.data.entryNumber).toBe("JV-202610-0001");
      expect(journalArg.data.entryType).toBe("EXPENSE");
      expect(journalArg.data.status).toBe("POSTED");

      // Verify balance increments
      expect(financeAccount.updateMany).toHaveBeenCalledTimes(2);

      // Verify expense updated to PAID
      const [expenseUpdateArg] = financeExpense.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(expenseUpdateArg.where.id).toBe(15);
      expect(expenseUpdateArg.where.organizationId).toBe(10);
      expect(expenseUpdateArg.data.status).toBe("PAID");
      expect(expenseUpdateArg.data.journalEntryId).toBe(50);
      expect(expenseUpdateArg.data.paymentModeId).toBe(2);
      expect(expenseUpdateArg.data.bankAccountId).toBe(1);
    });

    it("cancelAndReverseExpense() creates reversal journal and inverts GL balances", async () => {
      const { repository, financeExpense, financeJournalEntry } =
        makeRepository();

      await repository.cancelAndReverseExpense(
        SCOPE_A,
        15,
        {
          originalJournalEntryId: 50,
          reversalEntryNumber: "REV-202610-0001",
          reversalDate: new Date("2026-10-23"),
          narration: "Reversal of JV-001",
          totalDebit: 500,
          totalCredit: 500,
          lines: [
            { accountId: 10, lineOrder: 0, debit: 0, credit: 500 },
            { accountId: 20, lineOrder: 1, debit: 500, credit: 0 },
          ],
        },
        [
          { accountId: 10, delta: -500 },
          { accountId: 20, delta: 500 },
        ],
        USER_ID,
      );

      // Verify original marked REVERSED
      const [origUpdateArg] = financeJournalEntry.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(origUpdateArg.where.id).toBe(50);
      expect(origUpdateArg.where.organizationId).toBe(10);
      expect(origUpdateArg.data.status).toBe("REVERSED");

      // Verify reversal voucher created
      const [revArg] = financeJournalEntry.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(revArg.data.entryType).toBe("REVERSAL");
      expect(revArg.data.reversedEntryId).toBe(50);

      // Verify expense marked CANCELLED
      const [cancelArg] = financeExpense.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(cancelArg.where.id).toBe(15);
      expect(cancelArg.data.status).toBe("CANCELLED");
    });
  });
});
