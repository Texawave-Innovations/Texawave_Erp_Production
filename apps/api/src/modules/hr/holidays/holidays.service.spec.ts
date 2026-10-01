import { BadRequestException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { HolidaysService } from "./holidays.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new HolidaysService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

const page = { page: 1, limit: 20 };

describe("HolidaysService", () => {
  it("findAll() rejects a `from` after `to` without querying", async () => {
    const { service, repository } = makeService();
    await expect(
      service.findAll({
        ...page,
        from: "2026-12-31",
        to: "2026-01-01",
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it("findAll() rejects `year` combined with `from`/`to`", async () => {
    const { service, repository } = makeService();
    await expect(
      service.findAll({ ...page, year: 2026, from: "2026-01-01" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it("findAll() rejects `organizationWide` combined with `workLocationId`", async () => {
    const { service, repository } = makeService();
    await expect(
      service.findAll({
        ...page,
        organizationWide: true,
        workLocationId: 3,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it("findAll() queries within the caller's organization scope", async () => {
    const { service, repository } = makeService();
    await service.findAll({ ...page, year: 2026 } as never);
    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ year: 2026 }),
      expect.anything(),
    );
  });

  it("findOne() throws not-found when the row is absent", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("create() passes the caller's scope and user id as actor", async () => {
    const { service, repository } = makeService();
    const dto = { name: "Diwali", date: "2026-11-08" };
    await service.create(dto as never);
    expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, 42);
  });

  it("update() and setActive() throw not-found when the repository returns null", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);
    repository.setActive.mockResolvedValue(null);
    await expect(service.update(9, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.setActive(9, false)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
