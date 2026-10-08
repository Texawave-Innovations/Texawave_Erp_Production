import { describe, expect, it, vi } from "vitest";
import { PermissionsService } from "./permissions.service.js";

function makeService(cached: string | null = null) {
  const repository = {
    findPermissionCodesForUser: vi.fn(),
    findRoleIdsForUser: vi.fn(),
  };
  const redis = {
    get: vi.fn().mockResolvedValue(cached),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
  const service = new PermissionsService(repository as never, redis as never);
  return { service, repository, redis };
}

describe("PermissionsService.getPermissionsForUser", () => {
  it("returns the cached set without hitting the database", async () => {
    const { service, repository, redis } = makeService(
      JSON.stringify(["hr.employee.read.all", "iam.user.write"]),
    );

    await expect(service.getPermissionsForUser(5)).resolves.toEqual([
      "hr.employee.read.all",
      "iam.user.write",
    ]);
    expect(redis.get).toHaveBeenCalledWith("permissions:5");
    expect(repository.findPermissionCodesForUser).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("on a cache miss loads from the repository and caches for 15 minutes under a per-user key", async () => {
    const { service, repository, redis } = makeService(null);
    repository.findPermissionCodesForUser.mockResolvedValue(["a.b.c"]);

    await expect(service.getPermissionsForUser(8)).resolves.toEqual(["a.b.c"]);
    expect(repository.findPermissionCodesForUser).toHaveBeenCalledWith(8);
    expect(redis.set).toHaveBeenCalledWith(
      "permissions:8",
      JSON.stringify(["a.b.c"]),
      "EX",
      900,
    );
  });

  it("caches an empty permission set too", async () => {
    const { service, repository, redis } = makeService(null);
    repository.findPermissionCodesForUser.mockResolvedValue([]);

    await expect(service.getPermissionsForUser(9)).resolves.toEqual([]);
    expect(redis.set).toHaveBeenCalledWith("permissions:9", "[]", "EX", 900);
  });

  it("serves a cached empty set ('[]') from cache rather than re-querying", async () => {
    const { service, repository } = makeService("[]");

    await expect(service.getPermissionsForUser(9)).resolves.toEqual([]);
    expect(repository.findPermissionCodesForUser).not.toHaveBeenCalled();
  });
});

describe("PermissionsService.invalidate", () => {
  it("deletes only that user's cache key", async () => {
    const { service, redis } = makeService();

    await expect(service.invalidate(12)).resolves.toBeUndefined();
    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith("permissions:12");
  });
});

describe("PermissionsService.getRoleIdsForUser", () => {
  it("reads role ids straight from the repository (not cached)", async () => {
    const { service, repository, redis } = makeService();
    repository.findRoleIdsForUser.mockResolvedValue([1, 4]);

    await expect(service.getRoleIdsForUser(3)).resolves.toEqual([1, 4]);
    expect(repository.findRoleIdsForUser).toHaveBeenCalledWith(3);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
