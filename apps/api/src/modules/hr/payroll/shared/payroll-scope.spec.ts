import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import {
  assertEmployeeInWriteScope,
  assertNotSelfApproval,
  requireOrgWideScope,
} from "./payroll-scope.js";

function scope(level: TeamScope["level"], teamIds: number[] = []): TeamScope {
  return { level, userId: 10, organizationId: 1, teamIds };
}

const EMPLOYEE = { id: 55, teamId: 3, userId: 10 };

describe("requireOrgWideScope", () => {
  it("allows an .all grant", () => {
    expect(() => requireOrgWideScope(scope("all"), "do it")).not.toThrow();
  });

  it.each(["team", "own"] as const)("rejects a .%s grant", (level) => {
    const act = () =>
      requireOrgWideScope(scope(level, [3]), "approve payroll runs");
    expect(act).toThrow(ForbiddenException);
    expect(act).toThrow(/You may not approve payroll runs/);
  });
});

describe("assertEmployeeInWriteScope", () => {
  it("allows any employee for .all", () => {
    expect(() =>
      assertEmployeeInWriteScope(scope("all"), EMPLOYEE),
    ).not.toThrow();
  });

  it("allows a .team holder for an employee in one of their teams", () => {
    expect(() =>
      assertEmployeeInWriteScope(scope("team", [1, 3]), EMPLOYEE),
    ).not.toThrow();
  });

  it("hides an employee outside the caller's teams as not found", () => {
    expect(() =>
      assertEmployeeInWriteScope(scope("team", [4]), EMPLOYEE),
    ).toThrow(ResourceNotFoundException);
  });

  it("denies .own write access even to the caller's own record", () => {
    expect(() =>
      assertEmployeeInWriteScope(scope("own", [3]), EMPLOYEE),
    ).toThrow(ResourceNotFoundException);
  });
});

describe("assertNotSelfApproval", () => {
  it("rejects the creator approving their own record", () => {
    const act = () => assertNotSelfApproval(7, 7, "payroll run");
    expect(act).toThrow(ForbiddenException);
    expect(act).toThrow(/cannot approve this payroll run yourself/);
  });

  it("allows a different approver", () => {
    expect(() => assertNotSelfApproval(7, 8, "payroll run")).not.toThrow();
  });

  it.each([null, undefined])(
    "allows approval when the creator is unknown (%s)",
    (createdById) => {
      expect(() =>
        assertNotSelfApproval(createdById, 8, "payroll run"),
      ).not.toThrow();
    },
  );
});
