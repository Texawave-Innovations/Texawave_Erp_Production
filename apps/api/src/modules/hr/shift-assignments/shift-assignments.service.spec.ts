import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { ShiftAssignmentsService } from "./shift-assignments.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    employeeVisible: vi.fn().mockResolvedValue(true),
    resolve: vi.fn(),
    create: vi.fn(),
    end: vi.fn(),
    voidOne: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const service = new ShiftAssignmentsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );
  return { service, repository, teamContext, teamScope };
}

describe("ShiftAssignmentsService", () => {
  it("findAll() resolves the read scope and queries with it", async () => {
    const { service, repository, teamContext, teamScope } = makeService("team");
    await service.findAll({ page: 1, limit: 20, teamId: 3 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.shift_assignment.read",
    );
    expect(repository.findMany).toHaveBeenCalledWith(
      teamScope,
      expect.objectContaining({ teamId: 3 }),
      expect.anything(),
    );
  });

  it("findOne() throws not-found outside the caller's scope", async () => {
    const { service, repository } = makeService("team");
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("resolve() hides an employee the caller may not read, without resolving", async () => {
    const { service, repository } = makeService("team");
    repository.employeeVisible.mockResolvedValue(false);
    await expect(
      service.resolve({ employeeId: 5, date: "2026-10-02" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(repository.resolve).not.toHaveBeenCalled();
  });

  it("resolve() passes the date as UTC midnight", async () => {
    const { service, repository } = makeService();
    repository.resolve.mockResolvedValue(null);
    await service.resolve({ employeeId: 5, date: "2026-10-02" });
    expect(repository.resolve).toHaveBeenCalledWith(
      ORG,
      5,
      new Date("2026-10-02T00:00:00.000Z"),
    );
  });

  it("create(), end() and void() refuse an `.own` holder without writing", async () => {
    const { service, repository } = makeService("own");
    await expect(service.create({} as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.end(1, {} as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.void(1, { reason: "x" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.end).not.toHaveBeenCalled();
    expect(repository.voidOne).not.toHaveBeenCalled();
  });

  it("create() writes under the resolved write scope with the caller as actor", async () => {
    const { service, repository, teamContext, teamScope } = makeService("team");
    const dto = { employeeId: 5, shiftId: 2 };
    await service.create(dto as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith(
      "hr.shift_assignment.write",
    );
    expect(repository.create).toHaveBeenCalledWith(teamScope, dto, 42);
  });

  it("end() and void() throw not-found when the repository returns null", async () => {
    const { service, repository } = makeService("all");
    repository.end.mockResolvedValue(null);
    repository.voidOne.mockResolvedValue(null);
    await expect(service.end(9, {} as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.void(9, { reason: "x" })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
