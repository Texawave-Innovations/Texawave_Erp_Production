import { describe, expect, it } from "vitest";
import {
  approvalVerdict,
  dayWorkflowStatus,
  reviewStage,
  type ApprovalFacts,
  type ApprovalVerdict,
} from "./timesheet-approval.js";

const base: ApprovalFacts = {
  approvalLevels: 2,
  firstDecidedAt: null,
  firstDecidedBy: null,
  actorUserId: 10,
  employeeUserId: 20,
  submittedByUserId: 20,
  isManager: false,
  inScope: false,
  scopeLevel: "own",
};
const v = (over: Partial<ApprovalFacts>): ApprovalVerdict =>
  approvalVerdict({ ...base, ...over });
const FIRST_DONE = { firstDecidedAt: new Date(), firstDecidedBy: 11 };

describe("approvalVerdict", () => {
  it("someone with no authority over the employee does not see the day (404)", () => {
    expect(v({})).toEqual({ ok: false, reason: "NOT_VISIBLE" });
    // team/all scope that does not cover this employee
    expect(v({ scopeLevel: "team", inScope: false })).toEqual({
      ok: false,
      reason: "NOT_VISIBLE",
    });
  });

  it("nobody decides their own day or one they submitted", () => {
    expect(v({ isManager: true, employeeUserId: 10 })).toEqual({
      ok: false,
      reason: "SELF",
    });
    expect(v({ isManager: true, submittedByUserId: 10 })).toEqual({
      ok: false,
      reason: "SUBMITTER",
    });
  });

  describe("two levels", () => {
    it("the reporting manager gives the first approval, which is not final", () => {
      expect(v({ isManager: true })).toEqual({
        ok: true,
        stage: 1,
        final: false,
        override: false,
      });
    });

    it("a team approver covering the employee gives the first approval too", () => {
      expect(v({ inScope: true, scopeLevel: "team" })).toEqual({
        ok: true,
        stage: 1,
        final: false,
        override: false,
      });
    });

    it("HR may decide a day with no first approval directly — an override", () => {
      expect(v({ inScope: true, scopeLevel: "all" })).toEqual({
        ok: true,
        stage: 1,
        final: true,
        override: true,
      });
    });

    it("an HR approver who is also the employee's manager gives only the first approval", () => {
      expect(v({ inScope: true, scopeLevel: "all", isManager: true })).toEqual({
        ok: true,
        stage: 1,
        final: false,
        override: false,
      });
    });

    it("after the first approval only HR may continue; the manager must wait", () => {
      expect(v({ ...FIRST_DONE, isManager: true })).toEqual({
        ok: false,
        reason: "AWAITING_HR",
      });
      expect(v({ ...FIRST_DONE, inScope: true, scopeLevel: "team" })).toEqual({
        ok: false,
        reason: "AWAITING_HR",
      });
      expect(v({ ...FIRST_DONE, inScope: true, scopeLevel: "all" })).toEqual({
        ok: true,
        stage: 2,
        final: true,
        override: false,
      });
    });

    it("the person who gave the first approval cannot also give the second", () => {
      expect(
        v({
          ...FIRST_DONE,
          actorUserId: 11,
          inScope: true,
          scopeLevel: "all",
        }),
      ).toEqual({ ok: false, reason: "SAME_APPROVER" });
    });
  });

  describe("one level (no reporting manager)", () => {
    it("only HR decides, and it is final", () => {
      expect(
        v({ approvalLevels: 1, inScope: true, scopeLevel: "all" }),
      ).toEqual({ ok: true, stage: 1, final: true, override: false });
      expect(
        v({ approvalLevels: 1, inScope: true, scopeLevel: "team" }),
      ).toEqual({ ok: false, reason: "HR_ONLY" });
    });
  });
});

describe("dayWorkflowStatus", () => {
  it("is null for no rows and follows the rows otherwise", () => {
    expect(dayWorkflowStatus([])).toBeNull();
    expect(dayWorkflowStatus(["DRAFT", "DRAFT"])).toBe("DRAFT");
    expect(dayWorkflowStatus(["SUBMITTED", "SUBMITTED"])).toBe("SUBMITTED");
    expect(dayWorkflowStatus(["APPROVED", "APPROVED"])).toBe("APPROVED");
    expect(dayWorkflowStatus(["REJECTED"])).toBe("REJECTED");
  });

  it("a returned day that gained a draft row is still returned", () => {
    expect(dayWorkflowStatus(["REJECTED", "DRAFT"])).toBe("REJECTED");
  });
});

describe("reviewStage", () => {
  it("says who a submitted day is waiting for", () => {
    const at = new Date();
    expect(
      reviewStage({
        status: "SUBMITTED",
        approvalLevels: 2,
        firstDecidedAt: null,
      }),
    ).toBe("MANAGER");
    expect(
      reviewStage({
        status: "SUBMITTED",
        approvalLevels: 2,
        firstDecidedAt: at,
      }),
    ).toBe("HR");
    expect(
      reviewStage({
        status: "SUBMITTED",
        approvalLevels: 1,
        firstDecidedAt: null,
      }),
    ).toBe("HR");
    expect(
      reviewStage({
        status: "APPROVED",
        approvalLevels: 2,
        firstDecidedAt: at,
      }),
    ).toBeNull();
    expect(
      reviewStage({ status: null, approvalLevels: 1, firstDecidedAt: null }),
    ).toBeNull();
  });
});
