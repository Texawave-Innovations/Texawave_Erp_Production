import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { QueryTagDto } from "./dto/query-tag.dto.js";
import { TagsService } from "./tags.service.js";

/** Reference unit test for a module service (Docs/CODING_STANDARDS.md §14):
 * construct the class directly with `vi.fn()` doubles for its collaborators —
 * no Nest testing module, no database. The repository is the only thing that
 * talks to Prisma, so mocking it isolates the business rules this service
 * owns: tenant scope is always taken from `TenantContextService`, never from
 * the caller; duplicates are a 409; a missing/foreign row is a 404. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const TAG = { id: 5, name: "High priority", colorToken: "error" };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new TagsService(repository as never, tenantContext as never);
  return { service, repository, tenantContext };
}

function query(values: Partial<QueryTagDto> = {}): QueryTagDto {
  return Object.assign(new QueryTagDto(), values);
}

describe("TagsService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope, search filter and pagination to the repository", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [TAG], total: 1 });
      const dto = query({ page: 2, limit: 10, search: "prio" });

      await service.findAll(dto);

      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        { search: "prio" },
        dto,
      );
    });

    it("wraps the result in a PaginatedResponseDto carrying page, limit and total", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [TAG], total: 21 });

      const result = await service.findAll(query({ page: 2, limit: 10 }));

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([TAG]);
      expect(result.total).toBe(21);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
    });

    it("uses the PaginationDto defaults when the query omits page/limit", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const result = await service.findAll(query());

      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        { search: undefined },
        expect.anything(),
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });
  });

  describe("findOne()", () => {
    it("returns the tag found within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(TAG);

      await expect(service.findOne(5)).resolves.toBe(TAG);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE, 5);
    });

    it("throws ResourceNotFoundException when the tag is missing or belongs to another org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      await expect(service.findOne(999)).rejects.toThrow("Tag not found: 999");
    });
  });

  describe("create()", () => {
    it("rejects a duplicate name with ResourceConflictException and never writes", async () => {
      const { service, repository } = makeService();
      repository.findByName.mockResolvedValue(TAG);

      await expect(
        service.create({ name: "High priority" }),
      ).rejects.toBeInstanceOf(ResourceConflictException);
      expect(repository.findByName).toHaveBeenCalledWith(
        SCOPE,
        "High priority",
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("creates the tag in the caller's org with the caller as createdBy", async () => {
      const { service, repository } = makeService();
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(TAG);
      const dto = { name: "High priority", colorToken: "error" as const };

      await expect(service.create(dto)).resolves.toBe(TAG);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });
  });

  describe("update()", () => {
    it("updates within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...TAG, name: "Urgent" };
      repository.update.mockResolvedValue(updated);

      await expect(service.update(5, { name: "Urgent" })).resolves.toBe(
        updated,
      );
      expect(repository.update).toHaveBeenCalledWith(
        SCOPE,
        5,
        { name: "Urgent" },
        USER_ID,
      );
    });

    it("throws ResourceNotFoundException when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(999, { name: "Urgent" }),
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

    it("throws ResourceNotFoundException when the tag is already gone", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(false);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
