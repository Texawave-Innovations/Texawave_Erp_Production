import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { WorkLocationsService } from "./work-locations.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findByCode: vi.fn().mockResolvedValue(null),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new WorkLocationsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

const dto = { code: "HQ", name: "Head office" };

describe("WorkLocationsService", () => {
  it("create() rejects a duplicate code without writing", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue({ id: 1 });
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() rejects a duplicate name (case-insensitive lookup) without writing", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 2 });
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() passes the caller's organization scope and user id as actor", async () => {
    const { service, repository } = makeService();
    repository.create.mockResolvedValue({ id: 5, ...dto });
    await service.create(dto);
    expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, 42);
  });

  it("update() allows keeping the row's own name", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 7 });
    repository.update.mockResolvedValue({ id: 7 });
    await expect(service.update(7, { name: "Same" })).resolves.toEqual({
      id: 7,
    });
  });

  it("update() rejects a name that belongs to a different row", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 8 });
    await expect(service.update(7, { name: "Taken" })).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("update() / setActive() / findOne() throw 404 when the row is not in this organization", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);
    repository.setActive.mockResolvedValue(null);
    repository.findOne.mockResolvedValue(null);
    await expect(service.update(9, { name: "x" })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.setActive(9, false)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("setActive() forwards the requested state and the actor", async () => {
    const { service, repository } = makeService();
    repository.setActive.mockResolvedValue({ id: 3, isActive: false });
    await service.setActive(3, false);
    expect(repository.setActive).toHaveBeenCalledWith(SCOPE, 3, false, 42);
  });

  it("findAll() wraps the page in the standard paginated response", async () => {
    const { service, repository } = makeService();
    repository.findMany.mockResolvedValue({ items: [{ id: 1 }], total: 41 });
    const result = await service.findAll({
      page: 2,
      limit: 20,
      skip: 20,
    } as never);
    expect(result.total).toBe(41);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
  });
});
