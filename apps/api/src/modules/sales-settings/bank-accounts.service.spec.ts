import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { BankAccountsService } from "./bank-accounts.service.js";
import type { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import type { QueryBankAccountDto } from "./dto/query-bank-account.dto.js";
import type { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const ACCOUNT = {
  id: 5,
  bankName: "HDFC",
  accountHolderName: "Texawave",
  accountNumber: "0001",
  ifscCode: "HDFC0000001",
};

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new BankAccountsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

function query(values: Partial<QueryBankAccountDto> = {}): QueryBankAccountDto {
  return { page: 1, limit: 20, ...values } as QueryBankAccountDto;
}

describe("BankAccountsService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope, search filter and pagination to the repository", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ACCOUNT], total: 1 });
      const dto = query({ page: 2, limit: 10, search: "hdfc" });

      await service.findAll(dto);

      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        { search: "hdfc" },
        dto,
      );
    });

    it("wraps the result in a PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ACCOUNT], total: 1 });

      const result = await service.findAll(query());

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([ACCOUNT]);
      expect(result.total).toBe(1);
    });
  });

  describe("findOne()", () => {
    it("returns the account found within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(ACCOUNT);

      await expect(service.findOne(5)).resolves.toBe(ACCOUNT);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE, 5);
    });

    it("throws ResourceNotFoundException when missing or foreign", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("create()", () => {
    it("creates within the caller's org with the caller as createdBy", async () => {
      const { service, repository } = makeService();
      repository.create.mockResolvedValue(ACCOUNT);
      const dto = { bankName: "HDFC" } as CreateBankAccountDto;

      await expect(service.create(dto)).resolves.toBe(ACCOUNT);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });
  });

  describe("update()", () => {
    it("updates within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...ACCOUNT, bankName: "ICICI" };
      repository.update.mockResolvedValue(updated);
      const dto: UpdateBankAccountDto = { bankName: "ICICI" };

      await expect(service.update(5, dto)).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(SCOPE, 5, dto, USER_ID);
    });

    it("throws ResourceNotFoundException when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(999, { bankName: "ICICI" }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("remove()", () => {
    it("soft-deletes within the caller's org, recording the caller", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(true);

      await expect(service.remove(5)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 5, USER_ID);
    });

    it("throws ResourceNotFoundException when already gone", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(false);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
