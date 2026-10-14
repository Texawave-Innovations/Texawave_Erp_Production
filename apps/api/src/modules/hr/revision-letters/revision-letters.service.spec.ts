import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { RevisionLettersService } from "./revision-letters.service.js";

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
  };
  const tenantContext = { getUserId: vi.fn().mockReturnValue(42) };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const service = new RevisionLettersService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );
  return { service, repository, teamContext, teamScope };
}

describe("RevisionLettersService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 5 Oct 2026, 10:00 UTC — "today" for the legacy defaults.
    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("reads", () => {
    it("findAll() resolves the read scope and filters by employee when asked", async () => {
      const { service, repository, teamContext, teamScope } =
        makeService("team");
      const page = await service.findAll({
        page: 1,
        limit: 20,
        employeeId: 7,
      } as never);

      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.revision_letter.read",
      );
      expect(repository.findMany).toHaveBeenCalledWith(
        teamScope,
        { employeeId: 7 },
        expect.objectContaining({ page: 1, limit: 20, employeeId: 7 }),
      );
      expect(page).toBeInstanceOf(PaginatedResponseDto);
    });

    it("findOne() answers not-found, not forbidden, outside the caller's scope", async () => {
      const { service, repository } = makeService("team");
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("create (issuing a letter)", () => {
    it("refuses an `.own`-level holder before anything is written", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.create({ employeeId: 3, designation: "Engineer" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("applies the legacy defaults when the request omits them", async () => {
      const { service, repository, teamScope } = makeService("team");
      await service.create({
        employeeId: 3,
        designation: "Senior Software Engineer",
      } as never);

      expect(repository.create).toHaveBeenCalledWith(
        teamScope,
        {
          employeeId: 3,
          designation: "Senior Software Engineer",
          location: "Chennai",
          letterDate: "2026-10-05",
          effectiveDate: "2026-11-01",
          basic: "0.00",
          da: "0.00",
          hra: "0.00",
          ca: "0.00",
          signatoryName: "Amanullah Khan",
          signatoryDesignation: "Co-Founder",
          issuedOn: new Date("2026-10-05T10:00:00.000Z"),
        },
        42,
      );
    });

    it("uses the values the request supplies in place of the defaults", async () => {
      const { service, repository, teamScope } = makeService("all");
      await service.create({
        employeeId: 3,
        designation: "Lead",
        location: "Bengaluru",
        letterDate: "2026-09-30",
        effectiveDate: "2026-10-15",
        basic: 35000,
        da: 15000.5,
        hra: 30000,
        ca: 20000,
        signatoryName: "Someone Else",
        signatoryDesignation: "Director",
      } as never);

      const [scopeArg, input] = repository.create.mock.calls[0] as [
        unknown,
        unknown,
      ];
      expect(scopeArg).toBe(teamScope);
      expect(input).toMatchObject({
        location: "Bengaluru",
        letterDate: "2026-09-30",
        effectiveDate: "2026-10-15",
        basic: "35000.00",
        da: "15000.50",
        hra: "30000.00",
        ca: "20000.00",
        signatoryName: "Someone Else",
        signatoryDesignation: "Director",
      });
    });
  });

  describe("update (editing a letter)", () => {
    it("refuses an `.own`-level holder before anything is written", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.update(1, { ca: 5 } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("sends only the fields the request names, so omitted terms keep their stored value", async () => {
      const { service, repository, teamScope } = makeService("team");
      repository.update.mockResolvedValue({ id: 1 });
      await service.update(1, {
        designation: "Principal Engineer",
        ca: 1234.5,
      } as never);

      expect(repository.update).toHaveBeenCalledWith(
        teamScope,
        1,
        { designation: "Principal Engineer", ca: "1234.50" },
        42,
      );
    });

    it("answers not-found when the letter is not in the caller's scope", async () => {
      const { service, repository } = makeService("team");
      repository.update.mockResolvedValue(null);
      await expect(
        service.update(99, { ca: 1 } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });
});
