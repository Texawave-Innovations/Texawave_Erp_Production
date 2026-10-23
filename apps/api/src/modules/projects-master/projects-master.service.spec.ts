import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import type { CreateProjectsMasterDto } from "./dto/create-projects-master.dto.js";
import type { QueryProjectsMasterDto } from "./dto/query-projects-master.dto.js";
import { ProjectsMasterService } from "./projects-master.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const PROJECT = { id: 11, code: "ME", name: "Mechanical Engineering" };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new ProjectsMasterService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

function query(
  values: Partial<QueryProjectsMasterDto> = {},
): QueryProjectsMasterDto {
  return { page: 1, limit: 20, ...values } as QueryProjectsMasterDto;
}

describe("ProjectsMasterService", () => {
  describe("findAll()", () => {
    it("wraps the result in a PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [PROJECT], total: 1 });

      const result = await service.findAll(query());

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([PROJECT]);
      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        { search: undefined },
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  describe("findOne()", () => {
    it("returns the project found within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(PROJECT);

      await expect(service.findOne(11)).resolves.toBe(PROJECT);
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
    it("creates with the user-supplied code", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(PROJECT);
      const dto = {
        code: "ME",
        name: "Mechanical Engineering",
      } as CreateProjectsMasterDto;

      await expect(service.create(dto)).resolves.toBe(PROJECT);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });

    it("rejects a duplicate code within the org", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(PROJECT);
      const dto = {
        code: "ME",
        name: "Mechanical Engineering (dup)",
      } as CreateProjectsMasterDto;

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    it("throws ResourceNotFoundException when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(service.update(999, { name: "X" })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("updates within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...PROJECT, name: "Renamed" };
      repository.update.mockResolvedValue(updated);

      await expect(service.update(11, { name: "Renamed" })).resolves.toBe(
        updated,
      );
      expect(repository.update).toHaveBeenCalledWith(
        SCOPE,
        11,
        { name: "Renamed" },
        USER_ID,
      );
    });

    it("rejects renaming the code to one already used by another project", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue({ ...PROJECT, id: 22 });

      await expect(service.update(11, { code: "ME" })).rejects.toBeInstanceOf(
        ResourceConflictException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("remove()", () => {
    it("throws ResourceNotFoundException when already gone", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(false);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("soft-deletes within the caller's org, recording the caller", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(true);

      await expect(service.remove(11)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 11, USER_ID);
    });
  });
});
