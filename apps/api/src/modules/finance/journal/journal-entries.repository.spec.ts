import { describe, expect, it, vi } from "vitest";
import { JournalEntriesRepository } from "./journal-entries.repository.js";
import type { QueryJournalEntriesDto } from "./dto/query-journal-entries.dto.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };
const USER_ID = 88;

function makeRepository() {
  const financeJournalEntry = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const financeJournalLine = {
    deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };

  const financeAccount = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const prisma = {
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      return cb({
        financeJournalEntry,
        financeJournalLine,
        financeAccount,
      });
    }),
  };

  const repository = new JournalEntriesRepository(prisma as never);
  return {
    repository,
    prisma,
    financeJournalEntry,
    financeJournalLine,
    financeAccount,
  };
}

describe("JournalEntriesRepository", () => {
  describe("@OrgScoped() validation", () => {
    it("throws synchronously if called without a valid OrgScope", () => {
      const { repository } = makeRepository();
      // @ts-expect-error Testing invalid runtime scope
      expect(() => repository.findById(null, 1)).toThrow(
        /called without a valid OrgScope/,
      );
      // @ts-expect-error Testing undefined runtime scope
      expect(() => repository.findById(undefined, 1)).toThrow(
        /called without a valid OrgScope/,
      );
      // @ts-expect-error Testing empty object scope
      expect(() => repository.findById({}, 1)).toThrow(
        /called without a valid OrgScope/,
      );
    });
  });

  describe("tenant isolation in queries", () => {
    it("findMany() enforces organizationId from scope and applies filters", async () => {
      const { repository, financeJournalEntry } = makeRepository();
      const query: QueryJournalEntriesDto = {
        page: 1,
        limit: 15,
        skip: 0,
        entryType: "MANUAL",
        status: "POSTED",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        search: "Rent",
      } as QueryJournalEntriesDto;

      await repository.findMany(SCOPE_A, query);

      expect(financeJournalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            entryType: "MANUAL",
            status: "POSTED",
            entryDate: {
              gte: new Date("2026-10-01"),
              lte: new Date("2026-10-31"),
            },
            OR: [
              { entryNumber: { contains: "Rent", mode: "insensitive" } },
              { narration: { contains: "Rent", mode: "insensitive" } },
              { referenceNumber: { contains: "Rent", mode: "insensitive" } },
            ],
          },
          skip: 0,
          take: 15,
        }),
      );
    });

    it("findById() enforces organizationId from scope", async () => {
      const { repository, financeJournalEntry } = makeRepository();

      await repository.findById(SCOPE_B, 55);

      expect(financeJournalEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 55,
            organizationId: 20,
          },
        }),
      );
    });

    it("findByEntryNumber() enforces organizationId from scope", async () => {
      const { repository, financeJournalEntry } = makeRepository();

      await repository.findByEntryNumber(SCOPE_A, "JV-202610-0001");

      expect(financeJournalEntry.findFirst).toHaveBeenCalledWith({
        where: {
          entryNumber: "JV-202610-0001",
          organizationId: 10,
        },
      });
    });

    it("generateNextEntryNumber() counts strictly within scope.organizationId", async () => {
      const { repository, financeJournalEntry } = makeRepository();
      financeJournalEntry.count.mockResolvedValue(4);

      const entryNumber = await repository.generateNextEntryNumber(
        SCOPE_A,
        "JV",
      );

      const [countArg] = financeJournalEntry.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(countArg.where.organizationId).toBe(10);
      expect(entryNumber).toMatch(/^JV-\d{6}-0005$/);
    });

    it("postEntry() atomically updates entry and adjusts account balances within scope.organizationId", async () => {
      const { repository, financeJournalEntry, financeAccount } =
        makeRepository();

      await repository.postEntry(
        SCOPE_A,
        100,
        [
          { accountId: 20, delta: 1500 },
          { accountId: 10, delta: -1500 },
        ],
        USER_ID,
      );

      // Verify status update scoped to org
      const [entryUpdateArg] = financeJournalEntry.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(entryUpdateArg.where).toEqual({
        id: 100,
        status: "DRAFT",
        organizationId: 10,
      });
      expect(entryUpdateArg.data.status).toBe("POSTED");
      expect(entryUpdateArg.data.postedBy).toBe(USER_ID);

      // Verify account increments scoped to org
      const [acc1UpdateArg] = financeAccount.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(acc1UpdateArg.where).toEqual({
        id: 20,
        organizationId: 10,
      });
      expect(acc1UpdateArg.data.currentBalance).toEqual({ increment: 1500 });
      expect(acc1UpdateArg.data.updatedBy).toBe(USER_ID);

      const [acc2UpdateArg] = financeAccount.updateMany.mock.calls[1] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(acc2UpdateArg.where).toEqual({
        id: 10,
        organizationId: 10,
      });
      expect(acc2UpdateArg.data.currentBalance).toEqual({ increment: -1500 });
      expect(acc2UpdateArg.data.updatedBy).toBe(USER_ID);
    });

    it("deleteDraft() deletes only DRAFT entries within scope.organizationId", async () => {
      const { repository, financeJournalEntry } = makeRepository();

      await repository.deleteDraft(SCOPE_B, 77);

      expect(financeJournalEntry.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 77,
          status: "DRAFT",
          organizationId: 20,
        },
      });
    });
  });
});
