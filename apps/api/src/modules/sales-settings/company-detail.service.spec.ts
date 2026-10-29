import { describe, expect, it, vi } from "vitest";
import { CompanyDetailService } from "./company-detail.service.js";
import type { UpsertCompanyDetailDto } from "./dto/upsert-company-detail.dto.js";

/** Company Detail is a singleton settings form (Docs/SALES_SETTINGS_FOUNDATION.md
 * design decision #4/#5): `findOne()` returns `null` when unsaved rather than
 * throwing, and `upsert()` always writes — there is no separate create/delete. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;
const DETAIL = { id: 1, organizationId: 1, name: "Texawave" };

function makeService() {
  const repository = {
    findOne: vi.fn(),
    upsert: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new CompanyDetailService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

describe("CompanyDetailService", () => {
  describe("findOne()", () => {
    it("passes the tenant scope to the repository", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(DETAIL);

      await expect(service.findOne()).resolves.toBe(DETAIL);
      expect(repository.findOne).toHaveBeenCalledWith(SCOPE);
    });

    it("returns null (not an error) when nothing has been saved yet", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne()).resolves.toBeNull();
    });
  });

  describe("upsert()", () => {
    it("upserts within the caller's org", async () => {
      const { service, repository } = makeService();
      repository.upsert.mockResolvedValue(DETAIL);
      const dto: UpsertCompanyDetailDto = { name: "Texawave" };

      await expect(service.upsert(dto)).resolves.toBe(DETAIL);
      expect(repository.upsert).toHaveBeenCalledWith(SCOPE, dto);
    });
  });
});
