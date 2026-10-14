import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import { assertReferences } from "./employee-references.js";

const LIVE = { organizationId: 1, deletedAt: null, isActive: true };

/** A tx where every lookup succeeds unless overridden. */
function makeTx() {
  return {
    team: { findFirst: vi.fn().mockResolvedValue({ departmentId: 30 }) },
    department: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    designation: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    employmentType: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    workLocation: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    employee: { findFirst: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

async function errorOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as BusinessRuleViolationException;
  }
  throw new Error("expected a rejection");
}

describe("assertReferences", () => {
  it("checks nothing and returns a null team department when no refs are present", async () => {
    const tx = makeTx();
    await expect(
      assertReferences(tx as never, 1, {
        departmentId: null,
        workLocationId: null,
        reportsToId: null,
        userId: null,
      }),
    ).resolves.toEqual({ teamDepartmentId: null });
    for (const m of [
      tx.team,
      tx.department,
      tx.designation,
      tx.employmentType,
      tx.workLocation,
      tx.user,
      tx.employee,
    ]) {
      expect(m.findFirst).not.toHaveBeenCalled();
    }
  });

  it("returns the team's department and scopes every lookup to the org + live rows", async () => {
    const tx = makeTx();
    const result = await assertReferences(tx as never, 1, {
      teamId: 2,
      departmentId: 3,
      designationId: 4,
      employmentTypeId: 5,
      workLocationId: 6,
    });
    expect(result).toEqual({ teamDepartmentId: 30 });
    expect(tx.team.findFirst).toHaveBeenCalledWith({
      where: { id: 2, ...LIVE },
      select: { departmentId: true },
    });
    const byId = (id: number) => ({
      where: { id, ...LIVE },
      select: { id: true },
    });
    expect(tx.department.findFirst).toHaveBeenCalledWith(byId(3));
    expect(tx.designation.findFirst).toHaveBeenCalledWith(byId(4));
    expect(tx.employmentType.findFirst).toHaveBeenCalledWith(byId(5));
    expect(tx.workLocation.findFirst).toHaveBeenCalledWith(byId(6));
  });

  it.each([
    ["team", { teamId: 2 }, "INVALID_TEAM", "Team 2"],
    ["department", { departmentId: 3 }, "INVALID_DEPARTMENT", "Department 3"],
    [
      "designation",
      { designationId: 4 },
      "INVALID_DESIGNATION",
      "Designation 4",
    ],
    [
      "employmentType",
      { employmentTypeId: 5 },
      "INVALID_EMPLOYMENT_TYPE",
      "Employment type 5",
    ],
    [
      "workLocation",
      { workLocationId: 6 },
      "INVALID_WORK_LOCATION",
      "Work location 6",
    ],
    ["user", { userId: 7 }, "INVALID_USER", "User 7"],
  ] as const)(
    "rejects an unknown/foreign/inactive %s with a 422 %s",
    async (model, refs, code, label) => {
      const tx = makeTx();
      tx[model].findFirst.mockResolvedValue(null);
      const err = await errorOf(assertReferences(tx as never, 1, refs));
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect(err.getStatus()).toBe(422);
      expect(err.errorCode).toBe(code);
      expect(err.message).toBe(
        `${label} does not exist in this organization or is inactive`,
      );
    },
  );

  describe("reportsToId", () => {
    it("rejects reporting to oneself without querying", async () => {
      const tx = makeTx();
      const err = await errorOf(
        assertReferences(tx as never, 1, { reportsToId: 5 }, 5),
      );
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect(err.errorCode).toBe("REPORTING_LINE_CYCLE");
      expect(tx.employee.findFirst).not.toHaveBeenCalled();
    });

    it("requires an ACTIVE manager in the same organization", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue(null);
      const err = await errorOf(
        assertReferences(tx as never, 1, { reportsToId: 8 }),
      );
      expect(err.errorCode).toBe("INVALID_MANAGER");
      expect(tx.employee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 8,
          organizationId: 1,
          deletedAt: null,
          status: "ACTIVE",
        },
        select: { id: true },
      });
    });

    it("skips the cycle check on create (no selfId)", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue({ id: 8 });
      await assertReferences(tx as never, 1, { reportsToId: 8 });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it("accepts an update whose manager chain does not reach the employee", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue({ id: 8 });
      tx.$queryRaw.mockResolvedValue([]);
      await expect(
        assertReferences(tx as never, 1, { reportsToId: 8 }, 5),
      ).resolves.toEqual({ teamDepartmentId: null });
      const [strings, ...values] = tx.$queryRaw.mock.calls[0]! as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join("?")).toContain("WITH RECURSIVE chain");
      expect(values).toEqual([8, 5]);
    });

    it("rejects an update whose manager chain leads back to the employee", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue({ id: 8 });
      tx.$queryRaw.mockResolvedValue([{ id: 5 }]);
      const err = await errorOf(
        assertReferences(tx as never, 1, { reportsToId: 8 }, 5),
      );
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect(err.errorCode).toBe("REPORTING_LINE_CYCLE");
    });
  });

  describe("userId", () => {
    it("accepts a live user not linked to anyone (create: no self exclusion)", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue(null);
      await assertReferences(tx as never, 1, { userId: 7 });
      expect(tx.user.findFirst).toHaveBeenCalledWith({
        where: { id: 7, ...LIVE },
        select: { id: true },
      });
      expect(tx.employee.findFirst).toHaveBeenCalledWith({
        where: { userId: 7 },
        select: { id: true },
      });
    });

    it("excludes the employee itself when re-validating on update", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue(null);
      await assertReferences(tx as never, 1, { userId: 7 }, 5);
      expect(tx.employee.findFirst).toHaveBeenCalledWith({
        where: { userId: 7, NOT: { id: 5 } },
        select: { id: true },
      });
    });

    it("409s when the user is already linked to another employee", async () => {
      const tx = makeTx();
      tx.employee.findFirst.mockResolvedValue({ id: 99 });
      await expect(
        assertReferences(tx as never, 1, { userId: 7 }, 5),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });
  });
});
