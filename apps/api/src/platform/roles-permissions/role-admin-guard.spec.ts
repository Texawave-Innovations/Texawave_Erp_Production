import { describe, expect, it, vi } from "vitest";
import {
  AccessLockoutException,
  withRoleAdminGuard,
} from "./role-admin-guard.js";

/** A transaction stub whose role-admin query returns `before`, then `after`. */
function tx(before: number[], after: number[]) {
  const findMany = vi
    .fn()
    .mockResolvedValueOnce(before.map((id) => ({ id })))
    .mockResolvedValueOnce(after.map((id) => ({ id })));
  return { user: { findMany } } as never;
}

describe("withRoleAdminGuard", () => {
  it("lets a change through when someone, including the caller, still manages roles", async () => {
    const change = vi.fn().mockResolvedValue("done");
    await expect(
      withRoleAdminGuard(tx([1, 2], [1]), 9, 1, change),
    ).resolves.toBe("done");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("refuses a change that leaves nobody able to manage roles", async () => {
    await expect(
      withRoleAdminGuard(tx([1], []), 9, 5, async () => undefined),
    ).rejects.toThrow(/nobody able to manage roles/);
  });

  it("refuses a change that removes Manage roles from the caller", async () => {
    await expect(
      withRoleAdminGuard(tx([1, 2], [2]), 9, 1, async () => undefined),
    ).rejects.toBeInstanceOf(AccessLockoutException);
  });

  it("does not hold a caller who never managed roles to the self rule", async () => {
    // A users-only admin (id 7) editing someone else, with an admin left.
    await expect(
      withRoleAdminGuard(tx([1, 2], [2]), 9, 7, async () => "ok"),
    ).resolves.toBe("ok");
  });

  it("does not block an organization that had no role admins to begin with", async () => {
    await expect(
      withRoleAdminGuard(tx([], []), 9, 7, async () => "ok"),
    ).resolves.toBe("ok");
  });
});
