import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { WorkLogsService } from "./work-logs.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findDirectReports: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn(),
    decide: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
    findCurrentEmployeeOrNull: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new WorkLogsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees, teamScope };
}

describe("WorkLogsService", () => {
  it("findAll() resolves the hr.work_log.read scope and queries with it", async () => {
    const { service, repository, teamContext, teamScope } = makeService("team");
    await service.findAll({ page: 1, limit: 20 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.work_log.read");
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

  it("approvals queue defaults to PENDING and is limited to the caller's direct reports", async () => {
    const { service, repository, employees } = makeService();
    await service.findApprovals({ page: 1, limit: 20 } as never);
    expect(employees.findCurrentEmployeeOrNull).toHaveBeenCalled();
    expect(repository.findDirectReports).toHaveBeenCalledWith(
      ORG,
      77,
      expect.objectContaining({ status: "PENDING" }),
      expect.anything(),
    );
  });

  it("approvals queue is empty, not a 403, for a caller with no linked employee", async () => {
    const { service, repository, employees } = makeService();
    employees.findCurrentEmployeeOrNull.mockResolvedValue(null);
    const result = await service.findApprovals({
      page: 1,
      limit: 20,
    } as never);
    expect(repository.findDirectReports).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("approvals queue honours an explicit status filter", async () => {
    const { service, repository } = makeService();
    await service.findApprovals({
      page: 1,
      limit: 20,
      status: "REJECTED",
    } as never);
    expect(repository.findDirectReports).toHaveBeenCalledWith(
      ORG,
      77,
      expect.objectContaining({ status: "REJECTED" }),
      expect.anything(),
    );
  });

  it("approve() decides as the caller's employee, not a client-supplied id", async () => {
    const { service, repository } = makeService();
    repository.decide.mockResolvedValue({ id: 5, status: "APPROVED" });
    await service.approve(5, { note: "ok" } as never);
    expect(repository.decide).toHaveBeenCalledWith(
      ORG,
      5,
      77,
      { status: "APPROVED", note: "ok" },
      42,
    );
  });

  it("approve() answers not-found when the log is not a direct report's", async () => {
    const { service, repository } = makeService();
    repository.decide.mockResolvedValue(null);
    await expect(service.approve(5, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("approve() answers not-found (not forbidden) for a caller with no linked employee", async () => {
    const { service, repository, employees } = makeService();
    employees.findCurrentEmployeeOrNull.mockResolvedValue(null);
    await expect(service.approve(5, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.decide).not.toHaveBeenCalled();
  });

  it("createForCurrentEmployee() takes the employee from the JWT, never the body", async () => {
    const { service, repository } = makeService();
    repository.create.mockResolvedValue({ id: 1 });
    await service.createForCurrentEmployee({
      workDate: "2026-10-05",
      hoursWorked: 7.5,
      taskDescription: "Fixed reports",
      employeeId: 999,
    } as never);
    expect(repository.create).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ employeeId: 77 }),
      42,
    );
  });

  it("findMine() queries only the caller's own employee", async () => {
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
