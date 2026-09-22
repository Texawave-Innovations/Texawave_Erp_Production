import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { RolesService } from "./roles.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findOneWithPermissions: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setPermissions: vi.fn(),
    findPermissionCatalog: vi.fn(),
    findUserIdsForRole: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const permissions = { invalidate: vi.fn() };

  const service = new RolesService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );
  return { service, repository, permissions };
}

describe("RolesService", () => {
  it("create() rejects a duplicate role name without touching the repository's create()", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue({ id: 1, name: "HR Manager" });

    await expect(service.create({ name: "HR Manager" })).rejects.toBeInstanceOf(
      ResourceConflictException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() creates the role with the caller's userId as createdBy when the name is free", async () => {
    const { service, repository } = makeService();
    repository.findByName.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 5, name: "HR Manager" });

    await service.create({ name: "HR Manager" });

    expect(repository.create).toHaveBeenCalledWith(
      SCOPE,
      { name: "HR Manager" },
      42,
    );
  });

  it("update() invalidates every current holder's cached permissions when deactivating a role", async () => {
    const { service, repository, permissions } = makeService();
    repository.update.mockResolvedValue({ id: 1, isActive: false });
    repository.findUserIdsForRole.mockResolvedValue([7, 8]);

    await service.update(1, { isActive: false });

    expect(repository.findUserIdsForRole).toHaveBeenCalledWith(SCOPE, 1);
    expect(permissions.invalidate).toHaveBeenCalledWith(7);
    expect(permissions.invalidate).toHaveBeenCalledWith(8);
  });

  it("update() does NOT invalidate anyone's cache for a plain rename", async () => {
    const { service, repository, permissions } = makeService();
    repository.update.mockResolvedValue({ id: 1, name: "Renamed" });

    await service.update(1, { name: "Renamed" });

    expect(repository.findUserIdsForRole).not.toHaveBeenCalled();
    expect(permissions.invalidate).not.toHaveBeenCalled();
  });

  it("update() on a role outside the org throws ResourceNotFoundException", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);

    await expect(service.update(999, { name: "X" })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("setPermissions() invalidates every current holder's cache after a successful grant change", async () => {
    const { service, repository, permissions } = makeService();
    repository.setPermissions.mockResolvedValue(true);
    repository.findUserIdsForRole.mockResolvedValue([3]);
    repository.findOneWithPermissions.mockResolvedValue({
      id: 1,
      permissions: [],
    });

    await service.setPermissions(1, { permissionIds: [10, 11] });

    expect(repository.setPermissions).toHaveBeenCalledWith(
      SCOPE,
      1,
      [10, 11],
      42,
    );
    expect(permissions.invalidate).toHaveBeenCalledWith(3);
  });

  it("setPermissions() on a role outside the org throws without invalidating anything", async () => {
    const { service, repository, permissions } = makeService();
    repository.setPermissions.mockResolvedValue(false);

    await expect(
      service.setPermissions(999, { permissionIds: [] }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(permissions.invalidate).not.toHaveBeenCalled();
  });
});
