import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { PromotionLettersService } from "./promotion-letters.service.js";

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    salaryHistory: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
  };
  const tenantContext = { getUserId: vi.fn().mockReturnValue(42) };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const service = new PromotionLettersService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );
  return { service, repository, teamContext, teamScope };
}

describe("PromotionLettersService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("reads", () => {
    it("findAll() resolves the promotion read scope and filters by employee", async () => {
      const { service, repository, teamContext, teamScope } =
        makeService("team");
      const page = await service.findAll({
        page: 1,
        limit: 20,
        employeeId: 7,
      } as never);

      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.promotion_letter.read",
      );
      expect(repository.findMany).toHaveBeenCalledWith(
        teamScope,
        { employeeId: 7 },
        expect.objectContaining({ employeeId: 7 }),
      );
      expect(page).toBeInstanceOf(PaginatedResponseDto);
    });

    it("findOne() answers not-found outside the caller's scope", async () => {
      const { service, repository } = makeService("team");
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("salaryHistory", () => {
    it("passes the revision read scope when the caller holds it", async () => {
      const { service, repository, teamContext, teamScope } = makeService();
      repository.salaryHistory.mockResolvedValue({ entries: [] });
      await service.salaryHistory(5);

      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.revision_letter.read",
      );
      expect(repository.salaryHistory).toHaveBeenCalledWith(
        teamScope,
        teamScope,
        5,
      );
    });

    it("leaves revisions out (null scope) without the revision read permission", async () => {
      const { service, repository, teamContext, teamScope } = makeService();
      teamContext.resolveScope.mockImplementation((prefix: string) =>
        prefix === "hr.revision_letter.read"
          ? Promise.reject(new ForbiddenException())
          : Promise.resolve(teamScope),
      );
      repository.salaryHistory.mockResolvedValue({ entries: [] });
      await service.salaryHistory(5);

      expect(repository.salaryHistory).toHaveBeenCalledWith(teamScope, null, 5);
    });

    it("is a 404 for an employee outside scope", async () => {
      const { service, repository } = makeService();
      repository.salaryHistory.mockResolvedValue(null);
      await expect(service.salaryHistory(5)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("does not swallow errors other than a missing permission", async () => {
      const { service, teamContext, teamScope } = makeService();
      teamContext.resolveScope.mockImplementation((prefix: string) =>
        prefix === "hr.revision_letter.read"
          ? Promise.reject(new Error("redis down"))
          : Promise.resolve(teamScope),
      );
      await expect(service.salaryHistory(5)).rejects.toThrow("redis down");
    });
  });

  describe("writes", () => {
    it("refuses an `.own`-level holder before anything is written", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.create({ employeeId: 3, designationId: 2 } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("applies the revision-letter defaults when the request omits them", async () => {
      const { service, repository, teamScope } = makeService("team");
      await service.create({ employeeId: 3, designationId: 2 } as never);

      expect(repository.create).toHaveBeenCalledWith(
        teamScope,
        expect.objectContaining({
          employeeId: 3,
          designationId: 2,
          location: "Chennai",
          letterDate: "2026-10-05",
          effectiveDate: "2026-11-01",
          basic: "0.00",
          da: "0.00",
          hra: "0.00",
          ca: "0.00",
          signatoryName: "Amanullah Khan",
          signatoryDesignation: "Co-Founder",
        }),
        42,
      );
    });

    it("update() forwards only the fields sent, and 404s outside scope", async () => {
      const { service, repository, teamScope } = makeService("all");
      repository.update.mockResolvedValue(null);
      await expect(
        service.update(4, { designationId: 9, basic: 100 } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.update).toHaveBeenCalledWith(
        teamScope,
        4,
        { designationId: 9, basic: "100.00" },
        42,
      );
    });
  });
});
