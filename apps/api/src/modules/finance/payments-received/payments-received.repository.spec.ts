import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@texawave-erp/database";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { QueryPaymentsReceivedDto } from "./dto/query-payments-received.dto.js";
import { PaymentsReceivedRepository } from "./payments-received.repository.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };
const USER_ID = 88;

function makeRepository() {
  const financePaymentReceived = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financePaymentReceivedAllocation = {
    create: vi.fn().mockResolvedValue({ id: 10 }),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    financePaymentReceived,
    financePaymentReceivedAllocation,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        financePaymentReceived,
        financePaymentReceivedAllocation,
        financeJournalEntry,
        financeJournalLine,
        financeAccount,
      }),
    ),
  };

  const repository = new PaymentsReceivedRepository(
    prisma as unknown as PrismaService,
  );
  return {
    repository,
    financePaymentReceived,
    financePaymentReceivedAllocation,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
  };
}

describe("PaymentsReceivedRepository", () => {
  describe("Tenant Isolation & Querying", () => {
    it("findMany() applies tenant filter and pagination", async () => {
      const { repository, financePaymentReceived } = makeRepository();
      const query = Object.assign(new QueryPaymentsReceivedDto(), {
        page: 2,
        limit: 15,
        status: "CONFIRMED" as const,
        search: "Globex",
      });

      await repository.findMany(SCOPE_A, query);

      const [findManyArg] = financePaymentReceived.findMany.mock.calls[0] as [
        {
          where: Record<string, unknown>;
          skip: number;
          take: number;
        },
      ];
      expect(findManyArg.where.organizationId).toBe(10);
      expect(findManyArg.where.status).toBe("CONFIRMED");
      expect(findManyArg.where.deletedAt).toBeNull();
      expect(findManyArg.skip).toBe(15);
      expect(findManyArg.take).toBe(15);
    });

    it("findById() restricts query to scope.organizationId", async () => {
      const { repository, financePaymentReceived } = makeRepository();

      await repository.findById(SCOPE_B, 42);

      const [findArg] = financePaymentReceived.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(findArg.where.id).toBe(42);
      expect(findArg.where.organizationId).toBe(20);
      expect(findArg.where.deletedAt).toBeNull();
    });

    it("findByPaymentNumber() restricts to scope.organizationId", async () => {
      const { repository, financePaymentReceived } = makeRepository();

      await repository.findByPaymentNumber(SCOPE_A, "REC-202610-0001");

      const [findArg] = financePaymentReceived.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(findArg.where.paymentNumber).toBe("REC-202610-0001");
      expect(findArg.where.organizationId).toBe(10);
    });

    it("generateNextPaymentNumber() formats sequence scoped to organizationId", async () => {
      const { repository, financePaymentReceived } = makeRepository();
      financePaymentReceived.count.mockResolvedValue(4);

      const paymentNumber = await repository.generateNextPaymentNumber(
        SCOPE_A,
        "REC",
      );

      const [countArg] = financePaymentReceived.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(countArg.where.organizationId).toBe(10);
      expect(paymentNumber).toMatch(/^REC-\d{6}-0005$/);
    });
  });

  describe("Mutations", () => {
    it("create() persists receipt and initial allocations under scope.organizationId", async () => {
      const {
        repository,
        financePaymentReceived,
        financePaymentReceivedAllocation,
      } = makeRepository();
      const data = {
        paymentNumber: "REC-202610-0001",
        paymentDate: new Date("2026-10-23"),
        customerName: "Acme Corp",
        amount: 10000,
        allocatedAmount: 6000,
        unallocatedAmount: 4000,
        paymentModeId: 2,
        status: "CONFIRMED",
      };

      await repository.create(
        SCOPE_A,
        data as unknown as Prisma.FinancePaymentReceivedUncheckedCreateInput,
        [
          {
            invoiceReference: "INV-001",
            allocatedAmount: 6000,
            notes: "Partial payment",
          },
        ],
      );

      const [createArg] = financePaymentReceived.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArg.data.organizationId).toBe(10);
      expect(createArg.data.paymentNumber).toBe("REC-202610-0001");
      expect(createArg.data.amount).toBe(10000);

      expect(financePaymentReceivedAllocation.createMany).toHaveBeenCalled();
    });

    it("update() restricts modification to scope.organizationId", async () => {
      const { repository, financePaymentReceived } = makeRepository();

      await repository.update(SCOPE_B, 55, { notes: "Updated receipt note" });

      const [updateArg] = financePaymentReceived.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(updateArg.where.id).toBe(55);
      expect(updateArg.where.organizationId).toBe(20);
      expect(updateArg.where.deletedAt).toBeNull();
      expect(updateArg.data.notes).toBe("Updated receipt note");
    });

    it("softDelete() marks deletedAt only for DRAFT or VOID within scope", async () => {
      const { repository, financePaymentReceived } = makeRepository();

      await repository.softDelete(SCOPE_A, 22, USER_ID);

      const [deleteArg] = financePaymentReceived.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(deleteArg.where.id).toBe(22);
      expect(deleteArg.where.organizationId).toBe(10);
      expect(deleteArg.where.status).toEqual({ in: ["DRAFT", "VOID"] });
      expect(deleteArg.data.updatedBy).toBe(USER_ID);
    });
  });

  describe("GL Accounting Operations", () => {
    it("postAndConfirmReceipt() creates journal voucher, updates GL balances and marks CONFIRMED", async () => {
      const {
        repository,
        financePaymentReceived,
        financeJournalEntry,
        financeAccount,
      } = makeRepository();

      await repository.postAndConfirmReceipt(
        SCOPE_A,
        15,
        {
          entryNumber: "JV-202610-0001",
          entryDate: new Date("2026-10-23"),
          entryType: "PAYMENT_RECEIVED",
          narration: "Payment REC-001",
          referenceNumber: "REC-001",
          totalDebit: 10000,
          totalCredit: 10000,
          lines: [
            { accountId: 10, lineOrder: 0, debit: 10000, credit: 0 },
            { accountId: 20, lineOrder: 1, debit: 0, credit: 10000 },
          ],
        },
        [
          { accountId: 10, delta: 10000 },
          { accountId: 20, delta: -10000 },
        ],
        USER_ID,
      );

      // Verify journal creation
      const [journalArg] = financeJournalEntry.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(journalArg.data.organizationId).toBe(10);
      expect(journalArg.data.entryType).toBe("PAYMENT_RECEIVED");
      expect(journalArg.data.status).toBe("POSTED");

      // Verify balance increments
      expect(financeAccount.updateMany).toHaveBeenCalledTimes(2);

      // Verify receipt status updated
      const [paymentUpdateArg] = financePaymentReceived.updateMany.mock
        .calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(paymentUpdateArg.where.id).toBe(15);
      expect(paymentUpdateArg.where.organizationId).toBe(10);
      expect(paymentUpdateArg.data.status).toBe("CONFIRMED");
      expect(paymentUpdateArg.data.journalEntryId).toBe(50);
    });

    it("voidAndReverseReceipt() creates reversal journal and inverts GL balances", async () => {
      const {
        repository,
        financePaymentReceived,
        financeJournalEntry,
        financeAccount,
      } = makeRepository();

      await repository.voidAndReverseReceipt(
        SCOPE_A,
        15,
        {
          originalJournalEntryId: 50,
          reversalEntryNumber: "REV-202610-0001",
          reversalDate: new Date("2026-10-23"),
          narration: "Reversal of JV-001",
          totalDebit: 10000,
          totalCredit: 10000,
          lines: [
            { accountId: 10, lineOrder: 0, debit: 0, credit: 10000 },
            { accountId: 20, lineOrder: 1, debit: 10000, credit: 0 },
          ],
        },
        [
          { accountId: 10, delta: -10000 },
          { accountId: 20, delta: 10000 },
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

      // Verify payment marked VOID
      const [voidArg] = financePaymentReceived.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(voidArg.where.id).toBe(15);
      expect(voidArg.data.status).toBe("VOID");

      // Verify GL balances inverted
      expect(financeAccount.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe("Invoice Allocations", () => {
    it("addAllocation() creates allocation and updates allocated/unallocated amounts", async () => {
      const {
        repository,
        financePaymentReceivedAllocation,
        financePaymentReceived,
      } = makeRepository();

      await repository.addAllocation(
        SCOPE_A,
        15,
        {
          invoiceReference: "INV-202610-005",
          allocatedAmount: 2500,
          notes: "Milestone payment",
        },
        USER_ID,
      );

      expect(financePaymentReceivedAllocation.create).toHaveBeenCalled();
      const [allocArg] = financePaymentReceivedAllocation.create.mock
        .calls[0] as [{ data: Record<string, unknown> }];
      expect(allocArg.data.paymentReceivedId).toBe(15);
      expect(allocArg.data.invoiceReference).toBe("INV-202610-005");
      expect(allocArg.data.allocatedAmount).toBe(2500);

      const [updateArg] = financePaymentReceived.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(updateArg.where.id).toBe(15);
      expect(updateArg.data.allocatedAmount).toEqual({ increment: 2500 });
      expect(updateArg.data.unallocatedAmount).toEqual({ decrement: 2500 });
    });

    it("removeAllocation() deletes allocation and restores unallocated balance", async () => {
      const {
        repository,
        financePaymentReceivedAllocation,
        financePaymentReceived,
      } = makeRepository();

      await repository.removeAllocation(SCOPE_A, 15, 10, 2500, USER_ID);

      expect(financePaymentReceivedAllocation.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 10,
          paymentReceivedId: 15,
          organizationId: 10,
        },
      });

      const [updateArg] = financePaymentReceived.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(updateArg.data.allocatedAmount).toEqual({ decrement: 2500 });
      expect(updateArg.data.unallocatedAmount).toEqual({ increment: 2500 });
    });
  });
});
