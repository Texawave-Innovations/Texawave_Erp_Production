import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import {
  ExitRequestDecisionScopeException,
  ExitRequestsService,
} from "./exit-requests.service.js";

const ORG = { organizationId: 1 };

function makeService(decideLevel: "own" | "team" | "all" = "all") {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMineOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = {
    resolveScope: vi.fn(async (prefix: string) => ({
      level: prefix === "hr.exit_request.decide" ? decideLevel : "all",
      userId: 42,
      organizationId: 1,
      teamIds: [],
    })),
  };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
    findCurrentEmployeeOrNull: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new ExitRequestsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees };
}

/** A date that is always after today, so the past-date guard never fires. */
const FUTURE = "2999-12-31";

const validRequest = {
  reason: "Relocating to another city",
  preferredLastWorkingDate: FUTURE,
};

describe("ExitRequestsService", () => {
  describe("HR view", () => {
    it("findAll() resolves the hr.exit_request.read scope", async () => {
      const { service, repository, teamContext } = makeService();
      await service.findAll({ page: 1, limit: 20 } as never);
      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.exit_request.read",
      );
      expect(repository.findMany).toHaveBeenCalled();
    });

    it("findOne() returns 404 for a request outside scope", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("update (review and decision)", () => {
    it("refuses an update that changes nothing", async () => {
      const { service, repository } = makeService();
      await expect(service.update(5, {} as never)).rejects.toBeInstanceOf(
        BusinessRuleViolationException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("refuses an own-level holder before any row is read", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.update(5, { status: "APPROVED" }),
      ).rejects.toBeInstanceOf(ExitRequestDecisionScopeException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("passes the reviewer's employee id (from the JWT) and the actor", async () => {
      const { service, repository, employees } = makeService();
      repository.update.mockResolvedValue({ id: 5 });
      await service.update(5, { status: "APPROVED" });
      expect(employees.findCurrentEmployeeOrNull).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ level: "all" }),
        5,
        77,
        { status: "APPROVED" },
        42,
      );
    });

    it("passes a null reviewer id (not a 403) for a caller with no linked employee", async () => {
      const { service, repository, employees } = makeService();
      employees.findCurrentEmployeeOrNull.mockResolvedValue(null);
      repository.update.mockResolvedValue({ id: 5 });
      await service.update(5, { status: "APPROVED" });
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ level: "all" }),
        5,
        null,
        { status: "APPROVED" },
        42,
      );
    });

    it("returns 404 when the repository finds nothing in scope", async () => {
      const { service, repository } = makeService();
      repository.update.mockResolvedValue(null);
      await expect(
        service.update(5, { hrNote: "Noted" }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("self-service", () => {
    it("creates for the JWT-resolved employee, never a client-named one", async () => {
      const { service, repository } = makeService();
      await service.createForCurrentEmployee(validRequest as never);
      expect(repository.create).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ employeeId: 77 }),
        42,
      );
    });

    it("defaults the notice period to the legacy 30 days", async () => {
      const { service, repository } = makeService();
      await service.createForCurrentEmployee(validRequest as never);
      expect(repository.create).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ noticePeriodDays: 30 }),
        42,
      );
    });

    it("keeps an explicit notice period as entered", async () => {
      const { service, repository } = makeService();
      await service.createForCurrentEmployee({
        ...validRequest,
        noticePeriodDays: 60,
      } as never);
      expect(repository.create).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ noticePeriodDays: 60 }),
        42,
      );
    });

    it("refuses a preferred last working day in the past", async () => {
      const { service, repository } = makeService();
      await expect(
        service.createForCurrentEmployee({
          ...validRequest,
          preferredLastWorkingDate: "2000-01-01",
        } as never),
      ).rejects.toMatchObject({ errorCode: "PAST_LAST_WORKING_DATE" });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("accepts today as the preferred last working day (legacy min = today)", async () => {
      const { service, repository } = makeService();
      const today = new Date().toISOString().slice(0, 10);
      await service.createForCurrentEmployee({
        ...validRequest,
        preferredLastWorkingDate: today,
      } as never);
      expect(repository.create).toHaveBeenCalled();
    });

    it("findMineOne() returns 404 for another employee's request", async () => {
      const { service, repository } = makeService();
      repository.findMineOne.mockResolvedValue(null);
      await expect(service.findMineOne(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
