import { describe, expect, it, vi } from "vitest";
import { AuthorizedSignatoryService } from "./authorized-signatory.service.js";
import type { UpsertAuthorizedSignatoryDto } from "./dto/upsert-authorized-signatory.dto.js";

/** Authorized Signatory is a singleton too (design decision #5) — same
 * null-not-404 / always-upsert shape as CompanyDetailService. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const SIGNATORY = { id: 1, organizationId: 1, name: "Jane Doe" };

function makeService() {
  const repository = {
    findOne: vi.fn(),
    upsert: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new AuthorizedSignatoryService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

describe("AuthorizedSignatoryService", () => {
  describe("findOne()", () => {
    it("passes the tenant scope to the repository", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(SIGNATORY);

      await expect(service.findOne()).resolves.toBe(SIGNATORY);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE);
    });

    it("returns null when the org has not saved a signatory yet", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne()).resolves.toBeNull();
    });
  });

  describe("upsert()", () => {
    it("upserts within the caller's org, recording the caller as updatedBy", async () => {
      const { service, repository } = makeService();
      repository.upsert.mockResolvedValue(SIGNATORY);
      const dto: UpsertAuthorizedSignatoryDto = { name: "Jane Doe" };

      await expect(service.upsert(dto)).resolves.toBe(SIGNATORY);
      expect(repository.upsert).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
    });
  });
});
