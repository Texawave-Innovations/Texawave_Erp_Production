import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { PaginationDto } from "../../common/dto/pagination.dto.js";
import { AuditQueryService } from "./audit-query.service.js";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";

const SCOPE = { organizationId: 2 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1n }], total: 41 }),
  };
  const tenantContext = { getOrgScope: vi.fn().mockReturnValue(SCOPE) };
  const service = new AuditQueryService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

function query(fields: Partial<QueryAuditLogDto>): QueryAuditLogDto {
  return Object.assign(new QueryAuditLogDto(), fields);
}

describe("AuditQueryService.findAll", () => {
  it("passes all filters (dates parsed) with the org scope and wraps the page", async () => {
    const { service, repository } = makeService();
    const q = query({
      page: 3,
      limit: 20,
      entityType: "employee",
      entityId: 5,
      actorUserId: 9,
      action: "update",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    });

    const result = await service.findAll(q);

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      {
        entityType: "employee",
        entityId: 5,
        actorUserId: 9,
        action: "update",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-01T00:00:00.000Z"),
      },
      q,
    );
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.items).toEqual([{ id: 1n }]);
    expect(result.total).toBe(41);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  it("leaves from/to undefined when not provided", async () => {
    const { service, repository } = makeService();
    await service.findAll(query({}));

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ from: undefined, to: undefined }),
      expect.anything(),
    );
  });

  it("accepts an open-ended range with only `from`", async () => {
    const { service, repository } = makeService();
    await service.findAll(query({ from: "2026-03-01T00:00:00.000Z" }));

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({
        from: new Date("2026-03-01T00:00:00.000Z"),
        to: undefined,
      }),
      expect.anything(),
    );
  });

  it("rejects entityId without entityType", async () => {
    const { service, repository } = makeService();
    await expect(service.findAll(query({ entityId: 5 }))).rejects.toThrow(
      "entityId requires entityType",
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["equal", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
    ["reversed", "2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
  ])("rejects a %s from/to range", async (_l, from, to) => {
    const { service, repository } = makeService();
    await expect(service.findAll(query({ from, to }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it("does not query when there is no organization in context", async () => {
    const { service, repository, tenantContext } = makeService();
    tenantContext.getOrgScope.mockImplementation(() => {
      throw new Error("no organization in context");
    });
    await expect(service.findAll(query({}))).rejects.toThrow(
      /no organization in context/,
    );
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});

describe("AuditQueryService.history", () => {
  it("queries only by entity within the org scope and paginates", async () => {
    const { service, repository } = makeService();
    const pagination = Object.assign(new PaginationDto(), {
      page: 1,
      limit: 10,
    });

    const result = await service.history("leave_request", 77, pagination);

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      { entityType: "leave_request", entityId: 77 },
      pagination,
    );
    expect(result.total).toBe(41);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(5);
  });
});
