import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { LocationNotAllowedException } from "./location-privilege.exceptions.js";
import { LocationPrivilegeService } from "./location-privilege.service.js";

const ORG = 7;
const USER = 42;
const EMP = 101;
const OFFICE_IP = "115.96.5.24";

/** A repository double. Each test sets only what it needs. */
function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findEmployeeInOrg: vi.fn().mockResolvedValue({ id: EMP, userId: null }),
    // Default is an explicit OFFICE row, the case that enforces the gate.
    findPrivilege: vi
      .fn()
      .mockResolvedValue({ mode: "OFFICE", updatedAt: null }),
    listOfficeNetworks: vi.fn().mockResolvedValue([{ ipAddress: OFFICE_IP }]),
    setPrivilege: vi.fn().mockResolvedValue({ changed: true }),
    ...overrides,
  };
}

function build(
  opts: {
    repo?: ReturnType<typeof makeRepo>;
    clientIp?: string | undefined;
  } = {},
) {
  const repo = opts.repo ?? makeRepo();
  const orgScope = { organizationId: ORG };
  const service = new LocationPrivilegeService(
    repo as never,
    {
      getOrgScope: () => orgScope,
      getUserId: () => USER,
    } as never,
    {
      get: vi
        .fn<(key: string) => string | undefined>()
        .mockReturnValue(opts.clientIp),
    } as never,
  );
  return { service, repo };
}

describe("LocationPrivilegeService.assertPunchAllowed", () => {
  it("lets a REMOTE employee punch from any network and never reads the office list", async () => {
    const repo = makeRepo({
      findPrivilege: vi.fn().mockResolvedValue({ mode: "REMOTE" }),
    });
    const { service } = build({ repo, clientIp: "203.0.113.99" });

    await expect(service.assertPunchAllowed(EMP)).resolves.toBeUndefined();
    expect(repo.listOfficeNetworks).not.toHaveBeenCalled();
  });

  it("lets an OFFICE employee punch from an allowlisted address", async () => {
    const { service } = build({ clientIp: OFFICE_IP });
    await expect(service.assertPunchAllowed(EMP)).resolves.toBeUndefined();
  });

  it("does not restrict an employee who was never classified (opt-in gate)", async () => {
    const repo = makeRepo({ findPrivilege: vi.fn().mockResolvedValue(null) });
    const { service } = build({ repo, clientIp: "203.0.113.99" });

    await expect(service.assertPunchAllowed(EMP)).resolves.toBeUndefined();
    expect(repo.listOfficeNetworks).not.toHaveBeenCalled();
  });

  it("denies an OFFICE employee on a non-office network", async () => {
    const { service } = build({ clientIp: "203.0.113.99" });
    const denied = await service
      .assertPunchAllowed(EMP)
      .catch((err: unknown) => err);
    expect(denied).toBeInstanceOf(LocationNotAllowedException);
    expect((denied as LocationNotAllowedException).getStatus()).toBe(403);
    expect((denied as LocationNotAllowedException).message).toContain(
      "office network",
    );
  });

  it("denies an OFFICE employee when the client address is unknown", async () => {
    const { service } = build({ clientIp: undefined });
    await expect(service.assertPunchAllowed(EMP)).rejects.toBeInstanceOf(
      LocationNotAllowedException,
    );
  });

  it("denies an OFFICE employee when no office address is active", async () => {
    const repo = makeRepo({
      listOfficeNetworks: vi.fn().mockResolvedValue([]),
    });
    const { service } = build({ repo, clientIp: OFFICE_IP });
    await expect(service.assertPunchAllowed(EMP)).rejects.toBeInstanceOf(
      LocationNotAllowedException,
    );
  });

  it("asks only for active office addresses", async () => {
    const { service, repo } = build({ clientIp: OFFICE_IP });
    await service.assertPunchAllowed(EMP);
    expect(repo.listOfficeNetworks).toHaveBeenCalledWith(
      { organizationId: ORG },
      { activeOnly: true },
    );
  });
});

describe("LocationPrivilegeService.setEmployeePrivilege", () => {
  it("writes the mode in the caller's organization and reports the change", async () => {
    const { service, repo } = build();
    const out = await service.setEmployeePrivilege(EMP, { mode: "REMOTE" });
    expect(repo.setPrivilege).toHaveBeenCalledWith(
      { organizationId: ORG },
      EMP,
      "REMOTE",
      USER,
    );
    expect(out).toEqual({ employeeId: EMP, mode: "REMOTE", changed: true });
  });

  it("refuses a change to the caller's own employee record, whatever permissions they hold", async () => {
    const repo = makeRepo({
      findEmployeeInOrg: vi.fn().mockResolvedValue({ id: EMP, userId: USER }),
    });
    const { service } = build({ repo });
    await expect(
      service.setEmployeePrivilege(EMP, { mode: "REMOTE" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.setPrivilege).not.toHaveBeenCalled();
  });

  it("returns 404 for an employee outside the organization, without writing", async () => {
    const repo = makeRepo({
      findEmployeeInOrg: vi.fn().mockResolvedValue(null),
    });
    const { service } = build({ repo });
    await expect(
      service.setEmployeePrivilege(EMP, { mode: "REMOTE" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    expect(repo.setPrivilege).not.toHaveBeenCalled();
  });
});

describe("LocationPrivilegeService.getEmployeePrivilege", () => {
  it("reports mode null with source 'unset' when no row exists", async () => {
    const repo = makeRepo({ findPrivilege: vi.fn().mockResolvedValue(null) });
    const { service } = build({ repo });
    await expect(service.getEmployeePrivilege(EMP)).resolves.toMatchObject({
      mode: null,
      source: "unset",
    });
  });

  it("reports an explicit row as explicit", async () => {
    const repo = makeRepo({
      findPrivilege: vi
        .fn()
        .mockResolvedValue({ mode: "REMOTE", updatedAt: new Date(0) }),
    });
    const { service } = build({ repo });
    await expect(service.getEmployeePrivilege(EMP)).resolves.toMatchObject({
      mode: "REMOTE",
      source: "explicit",
    });
  });
});
