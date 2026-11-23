import { ForbiddenException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { EmployeesService } from "./employees.service.js";

/** HR's new hire (POST /hr/employees/new-hire): who may, and which roles. */
const ORG = { organizationId: 1 };
const ACCOUNT = "hr.employee_account.write";
const ROLES = [
  { id: 30, name: "Employee" },
  { id: 31, name: "Team Lead" },
];

function makeService(
  level: TeamScope["level"],
  granted: string[],
  roles = ROLES,
  teamIds: number[] = [],
) {
  const repository = {
    findRolesByName: vi.fn((_scope: unknown, names: string[]) =>
      Promise.resolve(roles.filter((r) => names.includes(r.name))),
    ),
    createWithLogin: vi.fn().mockResolvedValue({
      id: 5,
      employeeCode: "EMP-000005",
      fullName: "New Person",
      status: "ACTIVE",
      dateOfJoining: new Date("2026-10-01T00:00:00Z"),
      team: { id: 2, name: "T2" },
      userId: 77,
    }),
  };
  const service = new EmployeesService(
    repository as never,
    {
      getOrgScope: vi.fn().mockReturnValue(ORG),
      getUserId: vi.fn().mockReturnValue(9),
    } as never,
    {
      resolveScope: vi.fn().mockResolvedValue({
        level,
        userId: 9,
        organizationId: 1,
        teamIds,
      }),
    } as never,
    { getPermissionsForUser: vi.fn().mockResolvedValue(granted) } as never,
  );
  return { service, repository };
}

interface LoginArg {
  roleIds: number[];
  passwordHash: string;
}
type CreateCall = [unknown, Record<string, unknown>, number, LoginArg];
/** The arguments of the n-th `createWithLogin` call, typed. */
const callOf = (
  repository: { createWithLogin: { mock: { calls: unknown[] } } },
  n = 0,
) => repository.createWithLogin.mock.calls[n] as CreateCall;

const dto = {
  fullName: "New Person",
  email: "new.person@example.com",
  tempPassword: "Welcome@2026",
  phone: "9876543210",
  teamId: 2,
  designationId: 1,
  employmentTypeId: 1,
  dateOfJoining: "2026-10-01",
};

describe("EmployeesService.createNewHire", () => {
  it("creates the login with the Employee role only, hashed and linked in one call", async () => {
    const { service, repository } = makeService("all", [ACCOUNT]);
    await service.createNewHire(dto);
    expect(repository.createWithLogin).toHaveBeenCalledTimes(1);
    const [scope, employee, actorId, login] = callOf(repository);
    expect(scope).toEqual(ORG);
    expect(actorId).toBe(9);
    // The login e-mail is also the work e-mail; no credential on the record.
    expect(employee).toMatchObject({
      fullName: "New Person",
      workEmail: "new.person@example.com",
      teamId: 2,
    });
    expect(employee).not.toHaveProperty("tempPassword");
    expect(employee).not.toHaveProperty("additionalRole");
    expect(login.roleIds).toEqual([30]);
    expect(login.passwordHash).not.toBe(dto.tempPassword);
    expect(await bcrypt.compare(dto.tempPassword, login.passwordHash)).toBe(
      true,
    );
  });

  it("adds Team Lead only when asked", async () => {
    const { service, repository } = makeService("all", [ACCOUNT]);
    await service.createNewHire({ ...dto, additionalRole: "TEAM_LEAD" });
    expect(callOf(repository)[3].roleIds).toEqual([30, 31]);
  });

  it("never hands out another role, even if one is smuggled into the body", async () => {
    const { service, repository } = makeService(
      "all",
      [ACCOUNT],
      [...ROLES, { id: 1, name: "Super Admin" }],
    );
    await service.createNewHire({
      ...dto,
      roleIds: [1],
      additionalRole: "SUPER_ADMIN",
    } as never);
    expect(repository.findRolesByName.mock.calls[0]![1]).toEqual(["Employee"]);
    expect(callOf(repository)[3].roleIds).toEqual([30]);
  });

  it("is refused without hr.employee_account.write, before anything is written", async () => {
    const { service, repository } = makeService("all", []);
    await expect(service.createNewHire(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.createWithLogin).not.toHaveBeenCalled();
  });

  it("is refused for an .own writer, and for a .team writer outside their team", async () => {
    const own = makeService("own", [ACCOUNT]);
    await expect(own.service.createNewHire(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const team = makeService("team", [ACCOUNT], ROLES, [7]);
    await expect(team.service.createNewHire(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(own.repository.createWithLogin).not.toHaveBeenCalled();
    expect(team.repository.createWithLogin).not.toHaveBeenCalled();
  });

  it("is a clear 422 when the Employee (or Team Lead) role is missing, and writes nothing", async () => {
    const { service, repository } = makeService(
      "all",
      [ACCOUNT],
      [{ id: 30, name: "Employee" }],
    );
    await expect(
      service.createNewHire({ ...dto, additionalRole: "TEAM_LEAD" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    const none = makeService("all", [ACCOUNT], []);
    await expect(none.service.createNewHire(dto)).rejects.toMatchObject({
      errorCode: "NEW_HIRE_ROLE_MISSING",
    });
    expect(repository.createWithLogin).not.toHaveBeenCalled();
  });
});
