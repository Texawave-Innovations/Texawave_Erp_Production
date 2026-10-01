import { describe, expect, it, vi } from "vitest";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { DepartmentsService } from "./departments.service.js";

const SCOPE = { organizationId: 1 };

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
    getUserId: vi.fn().mockReturnValue(42),
  };

  const service = new DepartmentsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("DepartmentsService", () => {
  it("create() rejects duplicate department name with ResourceConflictException", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 1, name: "Engineering" });

    await expect(
      service.create({ name: "Engineering" }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() creates the department when name is available", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 2, name: "Engineering" });

    const result = await service.create({ name: "Engineering" });
    expect(result).toEqual({ id: 2, name: "Engineering" });
    expect(repository.create).toHaveBeenCalledWith(
      SCOPE,
      { name: "Engineering" },
      42,
    );
  });

  it("findOne() throws ResourceNotFoundException when department does not exist", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("update() throws ResourceConflictException on renaming to existing name", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 2, name: "Finance" });

    await expect(service.update(1, { name: "Finance" })).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("remove() throws ResourceNotFoundException when department is not found", async () => {
    const { service, repository } = makeService();
    repository.softDelete.mockResolvedValue(false);

    await expect(service.remove(999)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
