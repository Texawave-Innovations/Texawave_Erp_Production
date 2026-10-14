import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TasksService } from "./tasks.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMineOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    createForEmployee: vi.fn().mockResolvedValue({ id: 2 }),
    reassign: vi.fn(),
    setStatus: vi.fn(),
    approve: vi.fn(),
    reopen: vi.fn(),
    setOwnStatus: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new TasksService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees, teamScope };
}

const future = "2099-12-31";
const past = "2000-01-01";

describe("TasksService", () => {
  it("findAll() resolves the hr.task.read scope and passes it to the repository", async () => {
    const { service, repository, teamContext, teamScope } = makeService("team");
    await service.findAll({ page: 1, limit: 20 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.task.read");
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

  it("create() rejects a past due date before touching the repository", async () => {
    const { service, repository } = makeService("all");
    await expect(
      service.create({ title: "x", assigneeId: 5, dueDate: past } as never),
    ).rejects.toMatchObject({ errorCode: "DUE_DATE_IN_PAST" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() records the JWT user as assigner and defaults priority to MEDIUM", async () => {
    const { service, repository, teamScope } = makeService("all");
    await service.create({
      title: "Audit",
      assigneeId: 5,
      dueDate: future,
    } as never);
    expect(repository.create).toHaveBeenCalledWith(
      teamScope,
      expect.objectContaining({
        title: "Audit",
        assigneeId: 5,
        priority: "MEDIUM",
      }),
      42,
      expect.any(String),
    );
  });

  it("write scope: `.own` is reserved and refused for every admin write", async () => {
    const { service, repository } = makeService("own");
    await expect(
      service.create({ title: "x", assigneeId: 5, dueDate: future } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reassign(1, { assigneeId: 2 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.setStatus(1, { status: "DONE" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.approve(1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reopen(1)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

  it("admin writes answer not-found for a task outside the caller's scope", async () => {
    const { service, repository } = makeService("team");
    repository.approve.mockResolvedValue(null);
    repository.reassign.mockResolvedValue(null);
    repository.setStatus.mockResolvedValue(null);
    repository.reopen.mockResolvedValue(null);
    await expect(service.approve(3)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.reopen(3)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(
      service.reassign(3, { assigneeId: 2 } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(
      service.setStatus(3, { status: "DONE" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("self-service create takes the employee from the JWT, never the body", async () => {
    const { service, repository } = makeService();
    await service.createForCurrentEmployee({
      title: "Mine",
      dueDate: future,
      assigneeId: 999,
    } as never);
    expect(repository.createForEmployee).toHaveBeenCalledWith(
      ORG,
      77,
      expect.objectContaining({ requestToAdmin: false, priority: "MEDIUM" }),
      42,
      expect.any(String),
    );
    expect(repository.createForEmployee.mock.calls[0]?.[2]).not.toHaveProperty(
      "assigneeId",
    );
  });

  it("self-service create rejects a past due date", async () => {
    const { service, repository } = makeService();
    await expect(
      service.createForCurrentEmployee({ title: "x", dueDate: past } as never),
    ).rejects.toMatchObject({ errorCode: "DUE_DATE_IN_PAST" });
    expect(repository.createForEmployee).not.toHaveBeenCalled();
  });

  it("self-service list and status change are always the caller's own employee", async () => {
    const { service, repository } = makeService();
    repository.setOwnStatus.mockResolvedValue({ id: 4 });
    await service.findMine({ page: 1, limit: 20 } as never);
    expect(repository.findMine).toHaveBeenCalledWith(
      ORG,
      77,
      expect.anything(),
      expect.anything(),
    );
    await service.updateMyStatus(4, { status: "DONE" } as never);
    expect(repository.setOwnStatus).toHaveBeenCalledWith(
      ORG,
      77,
      4,
      "DONE",
      42,
      expect.any(String),
    );
  });

  it("self-service status change answers not-found for a task that is not the caller's", async () => {
    const { service, repository } = makeService();
    repository.setOwnStatus.mockResolvedValue(null);
    await expect(
      service.updateMyStatus(4, { status: "DONE" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });
});
