import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { BankAccountsRepository } from "./bank-accounts.repository.js";
import { QueryBankAccountsDto } from "./dto/query-bank-accounts.dto.js";

const SCOPE_A = { organizationId: 10 };
const SCOPE_B = { organizationId: 20 };
const USER_ID = 99;

function makeRepository() {
  const financeBankAccount = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const prisma = {
    financeBankAccount,
  };

  const repository = new BankAccountsRepository(
    prisma as unknown as PrismaService,
  );
  return { repository, financeBankAccount };
}

describe("BankAccountsRepository", () => {
  it("enforces tenant organization scoping on findMany", async () => {
    const { repository, financeBankAccount } = makeRepository();
    const query = new QueryBankAccountsDto();

    await repository.findMany(SCOPE_A, query);

    expect(financeBankAccount.findMany).toHaveBeenCalled();
    const callArgs = financeBankAccount.findMany.mock.calls[0]?.[0] as {
      where?: { organizationId?: number };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
  });

  it("applies search filters across accountName, bankName, and accountNumber", async () => {
    const { repository, financeBankAccount } = makeRepository();
    const query = new QueryBankAccountsDto();
    query.search = "HDFC";

    await repository.findMany(SCOPE_A, query);

    expect(financeBankAccount.findMany).toHaveBeenCalled();
    const callArgs = financeBankAccount.findMany.mock.calls[0]?.[0] as {
      where?: { organizationId?: number; OR?: Array<Record<string, unknown>> };
    };
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.where?.OR).toBeDefined();
    expect(callArgs?.where?.OR?.length).toBe(3);
  });

  it("scopes findById to the organization", async () => {
    const { repository, financeBankAccount } = makeRepository();

    await repository.findById(SCOPE_B, 5);

    expect(financeBankAccount.findFirst).toHaveBeenCalled();
    const callArgs = financeBankAccount.findFirst.mock.calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number; deletedAt?: unknown };
    };
    expect(callArgs?.where?.id).toBe(5);
    expect(callArgs?.where?.organizationId).toBe(SCOPE_B.organizationId);
    expect(callArgs?.where?.deletedAt).toBeNull();
  });

  it("scopes findByAccountNumber to the organization", async () => {
    const { repository, financeBankAccount } = makeRepository();

    await repository.findByAccountNumber(SCOPE_A, "1234567890");

    expect(financeBankAccount.findFirst).toHaveBeenCalled();
    const callArgs = financeBankAccount.findFirst.mock.calls[0]?.[0] as {
      where?: {
        accountNumber?: string;
        organizationId?: number;
        deletedAt?: unknown;
      };
    };
    expect(callArgs?.where?.accountNumber).toBe("1234567890");
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.where?.deletedAt).toBeNull();
  });

  it("injects organizationId on create", async () => {
    const { repository, financeBankAccount } = makeRepository();

    await repository.create(SCOPE_A, {
      organizationId: SCOPE_A.organizationId,
      accountName: "Main Ops Account",
      accountNumber: "ACC-001",
      bankName: "State Bank",
      ifscCode: "SBIN0001234",
      accountType: "CURRENT",
      openingBalance: 10000,
      currentBalance: 10000,
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    expect(financeBankAccount.create).toHaveBeenCalled();
    const callArgs = financeBankAccount.create.mock.calls[0]?.[0] as {
      data?: { organizationId?: number; accountName?: string };
    };
    expect(callArgs?.data?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.data?.accountName).toBe("Main Ops Account");
  });

  it("scopes update to tenant organization", async () => {
    const { repository, financeBankAccount } = makeRepository();

    await repository.update(SCOPE_A, 1, {
      accountName: "Updated Name",
      updatedBy: USER_ID,
    });

    expect(financeBankAccount.updateMany).toHaveBeenCalled();
    const callArgs = financeBankAccount.updateMany.mock.calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
    };
    expect(callArgs?.where?.id).toBe(1);
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
  });

  it("soft deletes bank account with timestamp and userId", async () => {
    const { repository, financeBankAccount } = makeRepository();

    const result = await repository.softDelete(SCOPE_A, 1, USER_ID);

    expect(result).toBe(true);
    expect(financeBankAccount.updateMany).toHaveBeenCalled();
    const callArgs = financeBankAccount.updateMany.mock.calls[0]?.[0] as {
      where?: { id?: number; organizationId?: number };
      data?: { deletedAt?: Date; updatedBy?: number };
    };
    expect(callArgs?.where?.id).toBe(1);
    expect(callArgs?.where?.organizationId).toBe(SCOPE_A.organizationId);
    expect(callArgs?.data?.deletedAt).toBeInstanceOf(Date);
    expect(callArgs?.data?.updatedBy).toBe(USER_ID);
  });
});
