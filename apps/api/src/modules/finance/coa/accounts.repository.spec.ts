import { describe, expect, it, vi } from "vitest";
import { AccountsRepository } from "./accounts.repository.js";
import type { CreateAccountDto } from "./dto/create-account.dto.js";
import type { QueryAccountsDto } from "./dto/query-accounts.dto.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };
const USER_ID = 99;

function makeRepository() {
  const financeAccount = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    count: vi.fn().mockResolvedValue(0),
  };
  const financeJournalLine = {
    count: vi.fn().mockResolvedValue(0),
  };
  const financeBankAccount = {
    count: vi.fn().mockResolvedValue(0),
  };
  const financeExpense = {
    count: vi.fn().mockResolvedValue(0),
  };

  const prisma = {
    financeAccount,
    financeJournalLine,
    financeBankAccount,
    financeExpense,
  };

  const repository = new AccountsRepository(prisma as never);
  return {
    repository,
    financeAccount,
    financeJournalLine,
    financeBankAccount,
    financeExpense,
  };
}

describe("AccountsRepository", () => {
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
    it("findMany() enforces organizationId from scope and applies query filters", async () => {
      const { repository, financeAccount } = makeRepository();
      const query: QueryAccountsDto = {
        page: 1,
        limit: 20,
        skip: 0,
        accountType: "ASSET",
        isActive: true,
        search: "Cash",
      } as QueryAccountsDto;

      await repository.findMany(SCOPE_A, query);

      expect(financeAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 10,
            deletedAt: null,
            accountType: "ASSET",
            isActive: true,
            OR: [
              { accountCode: { contains: "Cash", mode: "insensitive" } },
              { accountName: { contains: "Cash", mode: "insensitive" } },
            ],
          },
          skip: 0,
          take: 20,
        }),
      );
    });

    it("findAllRaw() enforces organizationId from scope", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.findAllRaw(SCOPE_B);

      expect(financeAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 20,
            deletedAt: null,
          },
        }),
      );
    });

    it("findById() isolates lookup to scope.organizationId", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.findById(SCOPE_A, 42);

      expect(financeAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 42,
            organizationId: 10,
            deletedAt: null,
          },
        }),
      );
    });

    it("findByCode() isolates lookup to scope.organizationId", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.findByCode(SCOPE_B, "1010");

      expect(financeAccount.findFirst).toHaveBeenCalledWith({
        where: {
          accountCode: "1010",
          organizationId: 20,
          deletedAt: null,
        },
      });
    });

    it("create() persists with scope.organizationId and createdBy/updatedBy audit fields", async () => {
      const { repository, financeAccount } = makeRepository();
      const dto: CreateAccountDto = {
        accountCode: "1050",
        accountName: "Bank Transit",
        accountType: "ASSET",
        currency: "INR",
      };

      await repository.create(SCOPE_A, dto, USER_ID);

      const [createArg] = financeAccount.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArg.data.organizationId).toBe(10);
      expect(createArg.data.accountCode).toBe("1050");
      expect(createArg.data.accountName).toBe("Bank Transit");
      expect(createArg.data.accountType).toBe("ASSET");
      expect(createArg.data.currency).toBe("INR");
      expect(createArg.data.createdBy).toBe(USER_ID);
      expect(createArg.data.updatedBy).toBe(USER_ID);
    });

    it("update() restricts mutation to scope.organizationId", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.update(
        SCOPE_B,
        7,
        { accountName: "Updated Name" },
        USER_ID,
      );

      const [updateArg] = financeAccount.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(updateArg.where).toEqual({
        id: 7,
        organizationId: 20,
        deletedAt: null,
      });
      expect(updateArg.data.accountName).toBe("Updated Name");
      expect(updateArg.data.updatedBy).toBe(USER_ID);
    });

    it("softDelete() marks deletedAt and deactivates only within scope.organizationId", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.softDelete(SCOPE_A, 15, USER_ID);

      const [deleteArg] = financeAccount.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(deleteArg.where).toEqual({
        id: 15,
        organizationId: 10,
        deletedAt: null,
      });
      expect(deleteArg.data.isActive).toBe(false);
      expect(deleteArg.data.updatedBy).toBe(USER_ID);
    });

    it("countSubAccounts() isolates count to parentAccountId within scope.organizationId", async () => {
      const { repository, financeAccount } = makeRepository();

      await repository.countSubAccounts(SCOPE_A, 5);

      expect(financeAccount.count).toHaveBeenCalledWith({
        where: {
          parentAccountId: 5,
          organizationId: 10,
          deletedAt: null,
        },
      });
    });

    it("countJournalLines() isolates count to accountId within scope.organizationId", async () => {
      const { repository, financeJournalLine } = makeRepository();

      await repository.countJournalLines(SCOPE_B, 12);

      expect(financeJournalLine.count).toHaveBeenCalledWith({
        where: {
          accountId: 12,
          organizationId: 20,
        },
      });
    });
  });
});
