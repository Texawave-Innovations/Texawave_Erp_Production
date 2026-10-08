import { describe, expect, it, vi } from "vitest";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { UserLoginStateService } from "./user-login-state.service.js";

const SCOPE = { organizationId: 3 };

function makeService(user: unknown) {
  const repository = { findById: vi.fn().mockResolvedValue(user) };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(17),
  };
  const service = new UserLoginStateService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

describe("UserLoginStateService.currentUserMustChangePassword", () => {
  it.each([true, false])(
    "returns mustChangePassword=%s for the authenticated user, looked up within their org",
    async (flag) => {
      const { service, repository } = makeService({
        id: 17,
        mustChangePassword: flag,
      });

      await expect(service.currentUserMustChangePassword()).resolves.toBe(flag);
      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 17);
    },
  );

  it("throws ResourceNotFoundException when the user no longer exists in the org", async () => {
    const { service } = makeService(null);

    await expect(
      service.currentUserMustChangePassword(),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("fails without querying when there is no user in context", async () => {
    const { service, repository, tenantContext } = makeService({
      id: 17,
      mustChangePassword: false,
    });
    tenantContext.getUserId.mockImplementation(() => {
      throw new Error("no user in context");
    });

    await expect(service.currentUserMustChangePassword()).rejects.toThrow(
      /no user in context/,
    );
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
