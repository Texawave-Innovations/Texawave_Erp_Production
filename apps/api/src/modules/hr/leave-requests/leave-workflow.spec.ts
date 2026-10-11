import { describe, expect, it } from "vitest";
import {
  mapEntitlementHeader,
  parseEntitlementRows,
  requestExportRow,
} from "./leave-csv.js";
import {
  type ApprovalFacts,
  approvalVerdict,
  awaitingStage,
  monthsTouched,
} from "./leave-domain.js";

const base: ApprovalFacts = {
  approvalLevels: 1,
  firstDecidedAt: null,
  firstDecidedBy: null,
  actorId: 10,
  employeeUserId: 20,
  requestedBy: 20,
  isManager: false,
  inScope: true,
  scopeLevel: "team",
};
const firstDone = {
  approvalLevels: 2,
  firstDecidedAt: new Date(),
  firstDecidedBy: 11,
};

describe("approvalVerdict", () => {
  it("hides a request from someone outside the reporting line and the scope", () => {
    expect(
      approvalVerdict({ ...base, inScope: false, isManager: false }),
    ).toEqual({ ok: false, reason: "NOT_VISIBLE" });
  });

  it("lets the reporting manager decide with no scope over the employee", () => {
    expect(
      approvalVerdict({
        ...base,
        scopeLevel: "own",
        inScope: false,
        isManager: true,
      }),
    ).toEqual({ ok: true, stage: 1, final: true });
  });

  it("refuses the employee's own request even with .all and as their own manager", () => {
    expect(
      approvalVerdict({
        ...base,
        actorId: 20,
        scopeLevel: "all",
        isManager: true,
      }),
    ).toEqual({ ok: false, reason: "SELF" });
  });

  it("refuses the person who submitted it on the employee's behalf", () => {
    expect(approvalVerdict({ ...base, requestedBy: 10 })).toEqual({
      ok: false,
      reason: "REQUESTER",
    });
  });

  it("makes the first approval of a two-level request non-final", () => {
    expect(approvalVerdict({ ...base, approvalLevels: 2 })).toEqual({
      ok: true,
      stage: 1,
      final: false,
    });
  });

  it("reserves the second approval for an .all approver in scope", () => {
    expect(
      approvalVerdict({ ...base, ...firstDone, scopeLevel: "team" }),
    ).toEqual({ ok: false, reason: "AWAITING_HR" });
    expect(
      approvalVerdict({
        ...base,
        ...firstDone,
        scopeLevel: "own",
        inScope: false,
        isManager: true,
      }),
    ).toEqual({ ok: false, reason: "AWAITING_HR" });
    expect(
      approvalVerdict({ ...base, ...firstDone, scopeLevel: "all" }),
    ).toEqual({ ok: true, stage: 2, final: true });
  });

  it("refuses the same person giving both approvals", () => {
    expect(
      approvalVerdict({
        ...base,
        ...firstDone,
        firstDecidedBy: 10,
        scopeLevel: "all",
      }),
    ).toEqual({ ok: false, reason: "SAME_APPROVER" });
  });

  it("ignores a stale first approval on a one-level request", () => {
    expect(
      approvalVerdict({
        ...base,
        firstDecidedAt: new Date(),
        firstDecidedBy: 11,
      }),
    ).toEqual({ ok: true, stage: 1, final: true });
  });
});

describe("awaitingStage", () => {
  it("is FIRST, then HR after the first of two approvals, and null once decided", () => {
    const pending = {
      status: "PENDING",
      approvalLevels: 2,
      firstDecidedAt: null,
    };
    expect(awaitingStage(pending)).toBe("FIRST");
    expect(awaitingStage({ ...pending, firstDecidedAt: new Date() })).toBe(
      "HR",
    );
    expect(awaitingStage({ ...pending, status: "APPROVED" })).toBeNull();
    expect(
      awaitingStage({
        status: "PENDING",
        approvalLevels: 1,
        firstDecidedAt: null,
      }),
    ).toBe("FIRST");
  });
});

describe("monthsTouched", () => {
  it("lists the first day of every month in the inclusive range", () => {
    expect(monthsTouched("2026-10-05", "2026-10-07")).toEqual(["2026-10-01"]);
    expect(monthsTouched("2026-11-28", "2027-02-02")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });
});

describe("entitlement import parsing", () => {
  const header = [
    "employee code",
    "Leave Type Code",
    "YEAR",
    "Annual Entitlement",
  ];

  it("maps headers in any case and reports missing ones", () => {
    expect(mapEntitlementHeader(header).ok).toBe(true);
    expect(mapEntitlementHeader(["Employee Code", "Year"])).toEqual({
      ok: false,
      missing: ["Leave Type Code", "Annual Entitlement"],
    });
  });

  it("parses values, treats a blank entitlement as clearing the override, and numbers lines from 2", () => {
    const mapped = mapEntitlementHeader(header);
    if (!mapped.ok) throw new Error("header");
    const { parsed, errors } = parseEntitlementRows(
      [
        ["emp-1", "casual", "2026", "12"],
        ["EMP-2", "SICK", "2026", ""],
        ["EMP-3", "SICK", "26", "1.25"],
        ["EMP-1", "CASUAL", "2026", "5"],
        ["", "SICK", "2026", "400"],
      ],
      mapped.index,
    );
    expect(parsed).toEqual([
      {
        row: 2,
        employeeCode: "EMP-1",
        leaveTypeCode: "CASUAL",
        year: 2026,
        annualEntitlement: 12,
      },
      {
        row: 3,
        employeeCode: "EMP-2",
        leaveTypeCode: "SICK",
        year: 2026,
        annualEntitlement: null,
      },
    ]);
    expect(errors.map((e) => e.row)).toEqual([4, 5, 6]);
    expect(errors[0]?.message).toMatch(/Year/);
    expect(errors[0]?.message).toMatch(/at most one decimal/);
    expect(errors[1]?.message).toMatch(/Repeats line 2/);
    expect(errors[2]?.message).toMatch(/Employee Code is empty/);
  });
});

describe("request export row", () => {
  it("names the people involved and leaves blanks for missing steps", () => {
    const row = requestExportRow({
      id: 1,
      employee: { id: 1, employeeCode: "E1", fullName: "Asha" },
      leaveType: { id: 1, code: "CL", name: "Casual" },
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      dayPortion: "FIRST_HALF",
      leaveDays: 0.5,
      calendarDays: 1,
      reason: "=cmd",
      status: "PENDING",
      approvalLevels: 2,
      awaiting: "FIRST",
      requestedBy: { id: 9, fullName: "HR One" },
      firstDecidedBy: null,
      firstDecidedAt: null,
      firstDecisionNote: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationNote: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    expect(row.slice(0, 10)).toEqual([
      "E1",
      "Asha",
      "Casual",
      "2026-10-05",
      "2026-10-05",
      "FIRST_HALF",
      0.5,
      "=cmd",
      "PENDING",
      "HR One",
    ]);
    expect(row[10]).toBe("");
  });
});
