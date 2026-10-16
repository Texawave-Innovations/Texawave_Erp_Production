import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import type { CreateSalespersonDto } from "./dto/create-salesperson.dto.js";
import type { QuerySalespersonDto } from "./dto/query-salesperson.dto.js";
import type { UpdateSalespersonDto } from "./dto/update-salesperson.dto.js";
import { SalespersonsService } from "./salespersons.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const SALESPERSON = { id: 7, name: "Rahul Sharma" };

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

  const service = new SalespersonsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

function query(values: Partial<QuerySalespersonDto> = {}): QuerySalespersonDto {
  return { page: 1, limit: 20, ...values } as QuerySalespersonDto;
}

describe("SalespersonsService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope, search filter and pagination to the repository", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [SALESPERSON], total: 1 });
      const dto = query({ page: 1, limit: 20, search: "rahul" });

      await service.findAll(dto);

      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        { search: "rahul" },
        dto,
      );
    });

    it("wraps the result in a PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [SALESPERSON], total: 1 });

      const result = await service.findAll(query());

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([SALESPERSON]);
    });
  });

  describe("findOne()", () => {
    it("returns the salesperson found within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(SALESPERSON);

      await expect(service.findOne(7)).resolves.toBe(SALESPERSON);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE, 7);
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
      repository.create.mockResolvedValue(SALESPERSON);
      const dto = { name: "Rahul Sharma" } as CreateSalespersonDto;

      await expect(service.create(dto)).resolves.toBe(SALESPERSON);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });
  });

  describe("update()", () => {
    it("updates within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...SALESPERSON, name: "Rahul S." };
      repository.update.mockResolvedValue(updated);
      const dto: UpdateSalespersonDto = { name: "Rahul S." };

      await expect(service.update(7, dto)).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(SCOPE, 7, dto, USER_ID);
    });

    it("throws ResourceNotFoundException when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(service.update(999, { name: "X" })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("remove()", () => {
    it("soft-deletes within the caller's org, recording the caller", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(true);

      await expect(service.remove(7)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 7, USER_ID);
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
