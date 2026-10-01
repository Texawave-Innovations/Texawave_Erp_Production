import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { EmployeeLifecycleService } from "./employee-lifecycle.service.js";

const ORG = { organizationId: 1 };
const employee = () => ({
  id: 5,
  employeeCode: "EMP-000005",
  fullName: "A",
  status: "RESIGNED",
  dateOfJoining: new Date("2026-01-01T00:00:00Z"),
  dateOfExit: new Date("2026-06-30T00:00:00Z"),
  team: { id: 1, name: "T" },
  designation: { id: 1, name: "D" },
  employmentType: { id: 1, name: "E" },
  department: null,
  workLocation: null,
  reportsTo: null,
  reportsToId: null,
  userId: 42,
  workEmail: null,
  phone: null,
  exitReason: "moved abroad",
  isActive: false,
  version: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeService(repoResult: unknown) {
  const repository = {
    changeStatus: vi.fn().mockResolvedValue(repoResult),
    linkUser: vi.fn(),
    unlinkUser: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(9),
  };
  const auth = { logout: vi.fn().mockResolvedValue(undefined) };
  const service = new EmployeeLifecycleService(
    repository as never,
    tenantContext as never,
    auth as never,
  );
  return { service, repository, auth };
}

const dto = {
  status: "RESIGNED",
  effectiveDate: "2026-06-30",
  reason: "moved abroad",
} as const;

describe("EmployeeLifecycleService", () => {
  it("changeStatus() is a normal transition and correctStatus() is a correction", async () => {
    const { service, repository } = makeService({
      employee: employee(),
      disabledUserId: null,
      enabledUserId: null,
    });
    await service.changeStatus(5, dto as never);
    await service.correctStatus(5, dto as never);
    expect(repository.changeStatus.mock.calls[0]?.[2]).toMatchObject({
      correction: false,
    });
    expect(repository.changeStatus.mock.calls[1]?.[2]).toMatchObject({
      correction: true,
    });
    expect(repository.changeStatus.mock.calls[0]?.[3]).toBe(9);
  });

  it("revokes the sessions of a login that was disabled by an exit — after the change", async () => {
    const { service, auth } = makeService({
      employee: employee(),
      disabledUserId: 42,
      enabledUserId: null,
    });
    await service.changeStatus(5, dto as never);
    expect(auth.logout).toHaveBeenCalledWith(42);
  });

  it("also flushes sessions/permission cache for a re-enabled login", async () => {
    const { service, auth } = makeService({
      employee: employee(),
      disabledUserId: null,
      enabledUserId: 42,
    });
    await service.correctStatus(5, { ...dto, status: "ACTIVE" } as never);
    expect(auth.logout).toHaveBeenCalledWith(42);
  });

  it("does not touch sessions when no login was affected", async () => {
    const { service, auth } = makeService({
      employee: employee(),
      disabledUserId: null,
      enabledUserId: null,
    });
    await service.changeStatus(5, dto as never);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("does not report a committed status change as failed if revoking sessions fails", async () => {
    const { service, auth } = makeService({
      employee: employee(),
      disabledUserId: 42,
      enabledUserId: null,
    });
    auth.logout.mockRejectedValue(new Error("redis down"));
    await expect(service.changeStatus(5, dto as never)).resolves.toMatchObject({
      status: "RESIGNED",
    });
  });

  it("404 when the employee is not in this organization", async () => {
    const { service } = makeService(null);
    await expect(service.changeStatus(5, dto as never)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("link/unlink pass the caller as actor and 404 for an unknown employee", async () => {
    const { service, repository } = makeService(null);
    repository.linkUser.mockResolvedValue(null);
    repository.unlinkUser.mockResolvedValue(null);
    await expect(service.linkUser(5, { userId: 3 })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.unlinkUser(5, {})).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.linkUser).toHaveBeenCalledWith(ORG, 5, 3, undefined, 9);
  });
});
