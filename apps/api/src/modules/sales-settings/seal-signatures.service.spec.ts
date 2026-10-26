import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import type { CreateSealSignatureDto } from "./dto/create-seal-signature.dto.js";
import type { QueryPaginationDto } from "./dto/query-pagination.dto.js";
import type { UpdateSealSignatureDto } from "./dto/update-seal-signature.dto.js";
import { SealSignaturesService } from "./seal-signatures.service.js";

/** `SealSignaturesService` is instantiated once per `kind` by
 * `CompanySealsService`/`AuthorizedSignaturesService` — the tests construct
 * it directly with `kind = "seal"` to prove the base class threads `kind`
 * and `noun` into every repository call and error message, which both
 * subclasses rely on. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const ROW = { id: 3, kind: "seal", title: "Official Round Seal" };

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

  const service = new SealSignaturesService(
    repository as never,
    tenantContext as never,
    "seal",
    "Company seal",
  );
  return { service, repository, tenantContext };
}

function query(values: Partial<QueryPaginationDto> = {}): QueryPaginationDto {
  return { page: 1, limit: 20, ...values } as QueryPaginationDto;
}

describe("SealSignaturesService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope, fixed kind and pagination to the repository", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ROW], total: 1 });
      const dto = query({ page: 1, limit: 20 });

      await service.findAll(dto);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, "seal", dto);
    });

    it("wraps the result in a PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({ items: [ROW], total: 1 });

      const result = await service.findAll(query());

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([ROW]);
    });
  });

  describe("findOne()", () => {
    it("returns the row found within the caller's org and kind", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(ROW);

      await expect(service.findOne(3)).resolves.toBe(ROW);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE, "seal", 3);
    });

    it("throws ResourceNotFoundException(noun) when missing or foreign", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      await expect(service.findOne(999)).rejects.toThrow(
        "Company seal not found: 999",
      );
    });
  });

  describe("create()", () => {
    it("creates with the fixed kind, within the caller's org, as createdBy", async () => {
      const { service, repository } = makeService();
      repository.create.mockResolvedValue(ROW);
      const dto = { title: "Official Round Seal" } as CreateSealSignatureDto;

      await expect(service.create(dto)).resolves.toBe(ROW);
      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        "seal",
        dto,
        USER_ID,
      );
    });
  });

  describe("update()", () => {
    it("updates with the fixed kind, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      const updated = { ...ROW, title: "New Seal" };
      repository.update.mockResolvedValue(updated);
      const dto: UpdateSealSignatureDto = { title: "New Seal" };

      await expect(service.update(3, dto)).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(
        SCOPE,
        "seal",
        3,
        dto,
        USER_ID,
      );
    });

    it("throws ResourceNotFoundException(noun) when nothing was updated", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);

      await expect(service.update(999, { title: "X" })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("remove()", () => {
    it("soft-deletes with the fixed kind, recording the caller", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(true);

      await expect(service.remove(3)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(
        SCOPE,
        "seal",
        3,
        USER_ID,
      );
    });

    it("throws ResourceNotFoundException(noun) when already gone", async () => {
      const { service, repository } = makeService();
      repository.softDelete.mockResolvedValue(false);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
