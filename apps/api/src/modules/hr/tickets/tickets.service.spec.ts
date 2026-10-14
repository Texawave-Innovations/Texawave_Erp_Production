import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TicketsService } from "./tickets.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    setStatus: vi.fn(),
    addHrComment: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMineOne: vi.fn(),
    createForEmployee: vi.fn().mockResolvedValue({ id: 2 }),
    updateOwn: vi.fn(),
    addEmployeeComment: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new TicketsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees, teamScope };
}

const adminInput = {
  employeeId: 5,
  category: "Notice" as const,
  subject: "Office closed Friday",
  description: "The office is closed this Friday.",
};

const selfInput = {
  category: "HR Query" as const,
  subject: "Payslip question",
  description: "Which month is missing?",
};

describe("TicketsService: HR view", () => {
  it("reads through the hr.ticket.read scope and passes the filter on", async () => {
    const { service, repository, teamContext } = makeService("team");
    await service.findAll({ page: 1, limit: 20, status: "OPEN" } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.ticket.read");
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ level: "team" }),
      expect.objectContaining({ status: "OPEN" }),
      expect.anything(),
    );
  });

  it("answers 404 — not 403 — for a ticket outside the caller's scope", async () => {
    const { service, repository } = makeService("team");
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});

describe("TicketsService: admin writes", () => {
  it("refuses writes at the own scope before touching the repository", async () => {
    const level = "own" as const;
    const { service, repository } = makeService(level);
    await expect(service.create(adminInput as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.setStatus(1, { status: "RESOLVED" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.addHrComment(1, { body: "hi" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.setStatus).not.toHaveBeenCalled();
    expect(repository.addHrComment).not.toHaveBeenCalled();
  });

  it("takes the actor from the JWT, not from the body", async () => {
    const { service, repository } = makeService("all");
    await service.create({ ...adminInput, actorId: 999 } as never);
    expect(repository.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ employeeId: 5, category: "Notice" }),
      42,
    );
  });

  it("returns 404 when the status target is outside scope", async () => {
    const { service, repository } = makeService("team");
    repository.setStatus.mockResolvedValue(null);
    await expect(
      service.setStatus(9, { status: "CLOSED" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("returns 404 when the reply target is outside scope", async () => {
    const { service, repository } = makeService("team");
    repository.addHrComment.mockResolvedValue(null);
    await expect(
      service.addHrComment(9, { body: "hi" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });
});

describe("TicketsService: self-service", () => {
  it("resolves the requester from the JWT and never reads an employee from the body", async () => {
    const { service, repository, employees } = makeService();
    await service.createForCurrentEmployee({
      ...selfInput,
      employeeId: 1000,
    } as never);
    expect(employees.getCurrentEmployee).toHaveBeenCalled();
    expect(repository.createForEmployee).toHaveBeenCalledWith(
      ORG,
      77,
      expect.objectContaining({ category: "HR Query" }),
      42,
    );
  });

  it("rejects an HR-only category before any write", async () => {
    const { service, repository } = makeService();
    await expect(
      service.createForCurrentEmployee({
        ...selfInput,
        category: "Warning",
      } as never),
    ).rejects.toMatchObject({ errorCode: "CATEGORY_NOT_ALLOWED" });
    expect(repository.createForEmployee).not.toHaveBeenCalled();
  });

  it("rejects an HR-only category on edit before any write", async () => {
    const { service, repository } = makeService();
    await expect(
      service.updateMine(3, { ...selfInput, category: "Notice" } as never),
    ).rejects.toMatchObject({ errorCode: "CATEGORY_NOT_ALLOWED" });
    expect(repository.updateOwn).not.toHaveBeenCalled();
  });

  it("answers 404 for another employee's ticket", async () => {
    const { service, repository } = makeService();
    repository.findMineOne.mockResolvedValue(null);
    await expect(service.findMineOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("scopes the self list to the requester", async () => {
    const { service, repository } = makeService();
    await service.findMine({ page: 1, limit: 20 } as never);
    const args = repository.findMine.mock.calls[0] as unknown[];
    expect(args[0]).toEqual(ORG);
    expect(args[1]).toBe(77);
    const filter = args[2] as Record<string, unknown>;
    expect(filter).not.toHaveProperty("category");
    expect(filter).not.toHaveProperty("employeeId");
  });

  it("does not let the self list filter by employee", async () => {
    const { service, repository } = makeService();
    await service.findMine({ page: 1, limit: 20, employeeId: 5 } as never);
    const args = repository.findMine.mock.calls[0] as unknown[];
    const filter = args[2] as Record<string, unknown>;
    expect(filter.employeeId).toBeUndefined();
  });

  it("posts an employee reply as the requester", async () => {
    const { service, repository } = makeService();
    repository.addEmployeeComment.mockResolvedValue({ id: 1 });
    await service.addMyComment(3, { body: "Thanks" } as never);
    expect(repository.addEmployeeComment).toHaveBeenCalledWith(
      ORG,
      77,
      3,
      "Thanks",
    );
  });
});
