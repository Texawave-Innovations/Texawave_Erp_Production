import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import type { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import type { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import type { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";
import { MasterListItemsService } from "./master-list-items.service.js";

/** One generic resource behind `?category=` for all four SCM Master cards.
 * `category` is immutable after create (enforced by
 * `UpdateMasterListItemDto` omitting the field at the type level — see
 * dto/update-master-list-item.dto.ts) so there is no service-level branch to
 * test for that. Mirrors
 * apps/api/src/modules/finance-settings/master-list-items.service.spec.ts. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const ITEM = { id: 11, category: "warehouse_type", value: "Main" };

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

  const service = new MasterListItemsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

function query(
  values: Partial<QueryMasterListItemDto> = {},
): QueryMasterListItemDto {
  return {
    page: 1,
    limit: 20,
    category: "warehouse_type",
    ...values,
  } as QueryMasterListItemDto;
}

describe("MasterListItemsService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope and query (including category) straight through", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ITEM], total: 1 });
      const dto = query({ category: "supplier_type" });

      await service.findAll(dto);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, dto);
    });

    it("wraps the result in a PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ITEM], total: 1 });

      const result = await service.findAll(query());

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([ITEM]);
    });
  });

  describe("findOne()", () => {
    it("returns the item found within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(ITEM);

      await expect(service.findOne(11)).resolves.toBe(ITEM);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE, 11);
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
      repository.create.mockResolvedValue(ITEM);
      const dto = {
        category: "warehouse_type",
        value: "Main",
      } as CreateMasterListItemDto;

      await expect(service.create(dto)).resolves.toBe(ITEM);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });
  });

  describe("update()", () => {
    it("updates within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...ITEM, value: "Regional" };
      repository.update.mockResolvedValue(updated);
      const dto: UpdateMasterListItemDto = { value: "Regional" };

      await expect(service.update(11, dto)).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(SCOPE, 11, dto, USER_ID);
    });

    it("throws ResourceNotFoundException when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(service.update(999, { value: "X" })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("remove()", () => {
    it("soft-deletes within the caller's org, recording the caller", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(true);

      await expect(service.remove(11)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 11, USER_ID);
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
