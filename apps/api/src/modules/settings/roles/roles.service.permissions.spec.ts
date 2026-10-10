import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { QueryRoleDto } from "./dto/query-role.dto.js";
import { RolesService } from "./roles.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOneWithPermissions: vi.fn(),
    findPermissionCatalog: vi.fn(),
    resolvePermissionCodes: vi.fn().mockResolvedValue([]),
    attachPermissions: vi.fn(),
    findUserIdsForRole: vi.fn().mockResolvedValue([]),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const permissions = { invalidate: vi.fn().mockResolvedValue(undefined) };

  const service = new RolesService(
    repository as never,
    tenantContext as never,
    permissions as never,
  );
  return { service, repository, permissions };
}

describe("RolesService reads", () => {
  it("findAll() passes scope, search and pagination and returns a PaginatedResponseDto", async () => {
    const { service, repository } = makeService();
    const rows = [{ id: 1, name: "Admin" }];
    repository.findMany.mockResolvedValue({ items: rows, total: 11 });
    const query = Object.assign(new QueryRoleDto(), {
      page: 2,
      limit: 5,
      search: "adm",
    });

    const result = await service.findAll(query);

    expect(repository.findMany).toHaveBeenCalledWith(
      SCOPE,
      { search: "adm" },
      query,
    );
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result).toMatchObject({ items: rows, total: 11, page: 2, limit: 5 });
    expect(result.totalPages).toBe(3);
  });

  it("findOne() returns the role with its permissions, scoped to the org", async () => {
    const { service, repository } = makeService();
    const role = { id: 3, name: "HR", permissions: [{ code: "hr.x.read" }] };
    repository.findOneWithPermissions.mockResolvedValue(role);

    await expect(service.findOne(3)).resolves.toBe(role);
    expect(repository.findOneWithPermissions).toHaveBeenCalledWith(SCOPE, 3);
  });

  it("findOne() throws ResourceNotFoundException for a missing role", async () => {
    const { service, repository } = makeService();
    repository.findOneWithPermissions.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow("Role not found: 999");
  });

  it("listPermissionCatalog() returns the repository's catalog unchanged", async () => {
    const { service, repository } = makeService();
    const catalog = [{ id: 1, code: "settings.role.read" }];
    repository.findPermissionCatalog.mockResolvedValue(catalog);

    await expect(service.listPermissionCatalog()).resolves.toBe(catalog);
  });
});

describe("RolesService.attachPermissions()", () => {
  it("resolves codes from both `permissions` and `permissionCodes`, merges with ids and de-duplicates", async () => {
    const { service, repository } = makeService();
    repository.resolvePermissionCodes.mockResolvedValue([2, 3]);
    repository.attachPermissions.mockResolvedValue(true);

    await service.attachPermissions(1, {
      permissions: ["settings.role.read"],
      permissionCodes: ["settings.role.write"],
      permissionIds: [1, 2],
    });

    expect(repository.resolvePermissionCodes).toHaveBeenCalledWith([
      "settings.role.read",
      "settings.role.write",
    ]);
    expect(repository.attachPermissions).toHaveBeenCalledWith(
      SCOPE,
      1,
      [1, 2, 3],
      USER_ID,
    );
  });

  it("treats every list as optional", async () => {
    const { service, repository } = makeService();
    repository.attachPermissions.mockResolvedValue(true);

    await service.attachPermissions(1, {});

    expect(repository.resolvePermissionCodes).toHaveBeenCalledWith([]);
    expect(repository.attachPermissions).toHaveBeenCalledWith(
      SCOPE,
      1,
      [],
      USER_ID,
    );
  });

  it("invalidates every holder's cache and returns the refreshed role", async () => {
    const { service, repository, permissions } = makeService();
    repository.attachPermissions.mockResolvedValue(true);
    repository.findUserIdsForRole.mockResolvedValue([7, 8]);
    const refreshed = { id: 1, permissions: [{ id: 4 }] };
    repository.findOneWithPermissions.mockResolvedValue(refreshed);

    await expect(
      service.attachPermissions(1, { permissionIds: [4] }),
    ).resolves.toBe(refreshed);
    expect(repository.findUserIdsForRole).toHaveBeenCalledWith(SCOPE, 1);
    expect(permissions.invalidate).toHaveBeenCalledTimes(2);
    expect(permissions.invalidate).toHaveBeenCalledWith(7);
    expect(permissions.invalidate).toHaveBeenCalledWith(8);
    expect(repository.findOneWithPermissions).toHaveBeenCalledWith(SCOPE, 1);
  });

  it("throws ResourceNotFoundException for a role outside the org without invalidating anything", async () => {
    const { service, repository, permissions } = makeService();
    repository.attachPermissions.mockResolvedValue(false);

    await expect(
      service.attachPermissions(999, { permissionIds: [1] }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(repository.findUserIdsForRole).not.toHaveBeenCalled();
    expect(permissions.invalidate).not.toHaveBeenCalled();
  });
});
