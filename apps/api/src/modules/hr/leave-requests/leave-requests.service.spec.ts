import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    decide: vi.fn(),
    create: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new LeaveRequestsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees, teamScope };
}

describe("LeaveRequestsService", () => {
  it("findAll() resolves the read scope and queries with it", async () => {
    const { service, repository, teamContext, teamScope } = makeService("team");
    await service.findAll({ page: 1, limit: 20 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.leave_request.read",
    );
    expect(repository.findMany).toHaveBeenCalledWith(
      teamScope,
      expect.anything(),
      expect.anything(),
    );
  });

  it("findOne() answers not-found, not forbidden, outside the caller's scope", async () => {
    const { service, repository } = makeService("team");
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("approve() and reject() refuse an `.own` holder without touching the repository", async () => {
    const { service, repository } = makeService("own");
    await expect(service.approve(1, {} as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.reject(1, {} as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.decide).not.toHaveBeenCalled();
  });

  it("approve() records APPROVED with the note, decided by the caller", async () => {
    const { service, repository, teamScope } = makeService("all");
    repository.decide.mockResolvedValue({ id: 1 });
    await service.approve(1, { note: "ok" } as never);
    expect(repository.decide).toHaveBeenCalledWith(
      teamScope,
      1,
      { status: "APPROVED", note: "ok" },
      42,
    );
  });

  it("reject() records REJECTED and throws not-found when out of scope", async () => {
    const { service, repository } = makeService("team");
    repository.decide.mockResolvedValue(null);
    await expect(service.reject(1, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.decide).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { status: "REJECTED", note: undefined },
      42,
    );
  });

  it("createForCurrentEmployee() takes the employee from the login, never the body", async () => {
    const { service, repository } = makeService();
    repository.create.mockResolvedValue({ id: 3 });
    await service.createForCurrentEmployee({
      employeeId: 999,
      leaveTypeId: 2,
    } as never);
    expect(repository.create).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ employeeId: 77, leaveTypeId: 2 }),
      42,
    );
  });

  it("findMine() lists only the current employee's requests", async () => {
    const { service, repository } = makeService();
    await service.findMine({ page: 1, limit: 20 } as never);
    expect(repository.findMine).toHaveBeenCalledWith(
      ORG,
      77,
      expect.anything(),
      expect.anything(),
    );
  });
});
