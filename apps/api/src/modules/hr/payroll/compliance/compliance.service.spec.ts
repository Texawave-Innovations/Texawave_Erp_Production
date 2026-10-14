import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { ComplianceService } from "./compliance.service.js";
import { QueryContributionDto } from "./dto/compliance.dto.js";

const TEAM_SCOPE = {
  level: "all",
  userId: 42,
  organizationId: 1,
  teamIds: [],
};

function makeService(overrides?: {
  pfProfile?: unknown;
  esiProfile?: unknown;
  pfContribution?: unknown;
  esiContribution?: unknown;
  employee?: { id: number; teamId: number; userId: number | null } | null;
  scope?: { level: string; teamIds: number[] };
}) {
  const repository = {
    findEmployeeForWrite: vi
      .fn()
      .mockResolvedValue(
        overrides?.employee === undefined
          ? { id: 7, teamId: 3, userId: 99 }
          : overrides.employee,
      ),
    getPfProfile: vi.fn().mockResolvedValue(overrides?.pfProfile ?? null),
    upsertPfProfile: vi.fn().mockResolvedValue({ id: 1, pfApplicable: true }),
    findPfContributions: vi
      .fn()
      .mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 2 }),
    findPfContributionById: vi
      .fn()
      .mockResolvedValue(overrides?.pfContribution ?? null),
    getEsiProfile: vi.fn().mockResolvedValue(overrides?.esiProfile ?? null),
    upsertEsiProfile: vi
      .fn()
      .mockResolvedValue({ id: 2, esiApplicable: false }),
    findEsiContributions: vi
      .fn()
      .mockResolvedValue({ items: [{ id: 3 }], total: 45 }),
    findEsiContributionById: vi
      .fn()
      .mockResolvedValue(overrides?.esiContribution ?? null),
  };

  const teamContext = {
    resolveScope: vi
      .fn()
      .mockResolvedValue({ ...TEAM_SCOPE, ...(overrides?.scope ?? {}) }),
  };

  const service = new ComplianceService(
    repository as never,
    teamContext as never,
  );

  return { service, repository, teamContext };
}

describe("ComplianceService", () => {
  describe("PF", () => {
    it("returns the PF profile under the PF read scope", async () => {
      const { service, repository, teamContext } = makeService({
        pfProfile: { employeeId: 7, uan: "100200300400" },
      });

      await expect(service.getPfProfile(7)).resolves.toEqual({
        employeeId: 7,
        uan: "100200300400",
      });
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.pf.read");
      expect(repository.getPfProfile).toHaveBeenCalledWith(TEAM_SCOPE, 7);
    });

    it("reports a missing PF profile as not found", async () => {
      const { service } = makeService();

      await expect(service.getPfProfile(7)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("upserts a PF profile with effective dates parsed as UTC dates", async () => {
      const { service, repository, teamContext } = makeService();
      const dto = {
        pfApplicable: true,
        uan: "100200300400",
        effectiveFrom: "2026-04-01",
        effectiveTo: "2027-03-31",
      };

      const result = await service.updatePfProfile(7, dto);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.pf.write");
      expect(repository.upsertPfProfile).toHaveBeenCalledWith(
        TEAM_SCOPE,
        7,
        dto,
        new Date("2026-04-01T00:00:00.000Z"),
        new Date("2027-03-31T00:00:00.000Z"),
      );
      expect(result).toEqual({ id: 1, pfApplicable: true });
    });

    it("passes undefined effective dates when none are given", async () => {
      const { service, repository } = makeService();

      await service.updatePfProfile(7, { pfApplicable: false });

      expect(repository.upsertPfProfile).toHaveBeenCalledWith(
        TEAM_SCOPE,
        7,
        { pfApplicable: false },
        undefined,
        undefined,
      );
    });

    it("rejects a malformed PF effective date before writing", async () => {
      const { service, repository } = makeService();

      await expect(
        service.updatePfProfile(7, {
          pfApplicable: true,
          effectiveFrom: "2026-02-30",
        }),
      ).rejects.toThrow("Not a valid YYYY-MM-DD date");
      expect(repository.upsertPfProfile).not.toHaveBeenCalled();
    });

    it("lists PF contributions as a paginated response", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryContributionDto(), {
        page: 1,
        limit: 20,
        payrollPeriodId: 5,
      });

      const result = await service.findPfContributions(query);

      expect(repository.findPfContributions).toHaveBeenCalledWith(
        TEAM_SCOPE,
        query,
        query,
      );
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it("returns a PF contribution by id", async () => {
      const { service, repository } = makeService({
        pfContribution: { id: 11, employeeShare: 1800 },
      });

      await expect(service.findPfContributionById(11)).resolves.toEqual({
        id: 11,
        employeeShare: 1800,
      });
      expect(repository.findPfContributionById).toHaveBeenCalledWith(
        TEAM_SCOPE,
        11,
      );
    });

    it("reports a missing PF contribution as not found", async () => {
      const { service } = makeService();

      await expect(service.findPfContributionById(11)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("ESI", () => {
    it("returns the ESI profile under the ESI read scope", async () => {
      const { service, teamContext } = makeService({
        esiProfile: { employeeId: 7, insuranceNumber: "ESI-1" },
      });

      await expect(service.getEsiProfile(7)).resolves.toEqual({
        employeeId: 7,
        insuranceNumber: "ESI-1",
      });
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.esi.read");
    });

    it("reports a missing ESI profile as not found", async () => {
      const { service } = makeService();

      await expect(service.getEsiProfile(7)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("upserts an ESI profile with parsed effective dates", async () => {
      const { service, repository, teamContext } = makeService();
      const dto = {
        esiApplicable: false,
        effectiveFrom: "2026-10-01",
        effectiveTo: "2026-12-31",
      };

      const result = await service.updateEsiProfile(7, dto);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.esi.write");
      expect(repository.upsertEsiProfile).toHaveBeenCalledWith(
        TEAM_SCOPE,
        7,
        dto,
        new Date("2026-10-01T00:00:00.000Z"),
        new Date("2026-12-31T00:00:00.000Z"),
      );
      expect(result).toEqual({ id: 2, esiApplicable: false });
    });

    it("passes undefined ESI effective dates when none are given", async () => {
      const { service, repository } = makeService();

      await service.updateEsiProfile(7, { esiApplicable: true });

      expect(repository.upsertEsiProfile).toHaveBeenCalledWith(
        TEAM_SCOPE,
        7,
        { esiApplicable: true },
        undefined,
        undefined,
      );
    });

    it("lists ESI contributions as a paginated response", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryContributionDto(), {
        page: 3,
        limit: 10,
      });

      const result = await service.findEsiContributions(query);

      expect(repository.findEsiContributions).toHaveBeenCalledWith(
        TEAM_SCOPE,
        query,
        query,
      );
      expect(result.total).toBe(45);
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);
    });

    it("returns an ESI contribution by id", async () => {
      const { service, repository } = makeService({
        esiContribution: { id: 12 },
      });

      await expect(service.findEsiContributionById(12)).resolves.toEqual({
        id: 12,
      });
      expect(repository.findEsiContributionById).toHaveBeenCalledWith(
        TEAM_SCOPE,
        12,
      );
    });

    it("reports a missing ESI contribution as not found", async () => {
      const { service } = makeService();

      await expect(service.findEsiContributionById(12)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  // A profile write is a single-employee write: it must stay inside the
  // caller's organization and team scope (404 otherwise, never 403).
  describe("profile write scope", () => {
    const PF = { pfApplicable: true };
    const ESI = { esiApplicable: true };

    it("writes for an employee in one of the caller's teams", async () => {
      const { service, repository } = makeService({
        scope: { level: "team", teamIds: [3] },
      });
      await service.updatePfProfile(7, PF);
      await service.updateEsiProfile(7, ESI);
      expect(repository.findEmployeeForWrite).toHaveBeenCalledWith(
        expect.objectContaining({ level: "team" }),
        7,
      );
      expect(repository.upsertPfProfile).toHaveBeenCalled();
      expect(repository.upsertEsiProfile).toHaveBeenCalled();
    });

    it("refuses an employee outside the caller's teams", async () => {
      const { service, repository } = makeService({
        scope: { level: "team", teamIds: [4] },
      });
      await expect(service.updatePfProfile(7, PF)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      await expect(service.updateEsiProfile(7, ESI)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.upsertPfProfile).not.toHaveBeenCalled();
      expect(repository.upsertEsiProfile).not.toHaveBeenCalled();
    });

    it("refuses an employee of another organization (not found in this one)", async () => {
      const { service, repository } = makeService({ employee: null });
      await expect(service.updatePfProfile(7, PF)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      await expect(service.updateEsiProfile(7, ESI)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.upsertPfProfile).not.toHaveBeenCalled();
      expect(repository.upsertEsiProfile).not.toHaveBeenCalled();
    });

    it("gives an .own grant no write access, not even to oneself", async () => {
      const { service, repository } = makeService({
        scope: { level: "own", teamIds: [] },
      });
      await expect(service.updatePfProfile(7, PF)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.upsertPfProfile).not.toHaveBeenCalled();
    });
  });
});
