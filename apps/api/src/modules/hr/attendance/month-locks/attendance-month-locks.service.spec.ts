import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import {
  AttendanceMonthSelfDecisionException,
  AttendanceMonthSubmitterDecisionException,
} from "../attendance.exceptions.js";
import { AttendanceMonthLocksService } from "./attendance-month-locks.service.js";

const ME = 7;

function setup(level: "own" | "team" | "all" = "all") {
  const repository = {
    findPage: vi.fn(),
    findOne: vi.fn(),
    findCandidates: vi.fn().mockResolvedValue([]),
    finalizeOne: vi.fn().mockResolvedValue({ result: "submitted", id: 1 }),
    transition: vi
      .fn()
      .mockImplementation(
        (
          _s: unknown,
          id: number,
          change: { to: string; note: string | null },
        ) =>
          Promise.resolve({
            id,
            status: change.to,
            submittedBy: { id: 3, fullName: "HR" },
            employee: { fullName: "A", employeeCode: "E1" },
            month: "2026-09",
            decisionNote: change.note,
            decidedAt: new Date(),
          }),
      ),
  };
  const dayContext = {
    load: vi.fn().mockResolvedValue({
      holidays: [],
      weeklyOffRules: [],
      approvedLeaves: [],
      shiftAssignments: [],
    }),
  };
  const dayViews = { build: vi.fn().mockReturnValue([]) };
  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue({
      level,
      userId: ME,
      organizationId: 1,
      teamIds: level === "team" ? [10] : [],
    }),
  };
  const tenantContext = {
    getUserId: () => ME,
    getOrgScope: () => ({ organizationId: 1 }),
  };
  const notifications = {
    notify: vi
      .fn<(scope: unknown, items: { userId: number }[]) => Promise<number>>()
      .mockResolvedValue(1),
  };
  const service = new AttendanceMonthLocksService(
    repository as never,
    dayContext as never,
    dayViews as never,
    teamContext as never,
    tenantContext as never,
    notifications as never,
  );
  return { service, repository, notifications, teamContext };
}

const employee = (id: number, userId: number | null = null) => ({
  id,
  employeeCode: `E${id}`,
  fullName: `Emp ${id}`,
  teamId: 10,
  userId,
  workLocationId: null,
  reportsToId: null,
  dateOfJoining: new Date("2025-01-01T00:00:00Z"),
  dateOfExit: null,
});

const lockRow = (over: Record<string, unknown> = {}) => ({
  id: 5,
  status: "SUBMITTED",
  submittedBy: 3,
  employee: employee(1, 50),
  ...over,
});

describe("AttendanceMonthLocksService — finalize", () => {
  it("refuses .own scope: nobody closes their own month", async () => {
    const { service } = setup("own");
    await expect(service.finalize({ month: "2026-09" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses a month that has not ended", async () => {
    const { service } = setup();
    const future = new Date();
    future.setUTCMonth(future.getUTCMonth() + 1);
    await expect(
      service.finalize({ month: future.toISOString().slice(0, 7) }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it("skips the caller's own record and ids outside scope, submits the rest", async () => {
    const { service, repository } = setup();
    repository.findCandidates.mockResolvedValue([employee(1), employee(2, ME)]);
    const report = await service.finalize({
      month: "2026-01",
      employeeIds: [1, 2, 99],
    });
    expect(report.submitted).toEqual([{ employeeId: 1, id: 1 }]);
    expect(report.skipped.map((s) => [s.employeeId, s.code])).toEqual([
      [99, "NOT_FOUND"],
      [2, "SELF_APPROVAL_FORBIDDEN"],
    ]);
    expect(repository.finalizeOne).toHaveBeenCalledTimes(1);
  });

  it("reports a repository skip instead of failing the run", async () => {
    const { service, repository } = setup();
    repository.findCandidates.mockResolvedValue([employee(1)]);
    repository.finalizeOne.mockResolvedValue({
      result: "skipped",
      code: "OPEN_SESSION_IN_MONTH",
      message: "open",
    });
    const report = await service.finalize({ month: "2026-01" });
    expect(report.skipped).toEqual([
      { employeeId: 1, code: "OPEN_SESSION_IN_MONTH", message: "open" },
    ]);
  });
});

describe("AttendanceMonthLocksService — decisions", () => {
  it("404s a row outside the caller's scope", async () => {
    const { service, repository } = setup("team");
    repository.findOne.mockResolvedValue(null);
    await expect(service.approve(5, undefined)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("refuses .own scope", async () => {
    const { service } = setup("own");
    await expect(service.approve(5, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses deciding one's own attendance month", async () => {
    const { service, repository } = setup();
    repository.findOne.mockResolvedValue(
      lockRow({ employee: employee(1, ME) }),
    );
    await expect(service.approve(5, undefined)).rejects.toBeInstanceOf(
      AttendanceMonthSelfDecisionException,
    );
  });

  it("refuses the submitter approving or returning (maker-checker)", async () => {
    const { service, repository } = setup();
    repository.findOne.mockResolvedValue(lockRow({ submittedBy: ME }));
    await expect(service.approve(5, undefined)).rejects.toBeInstanceOf(
      AttendanceMonthSubmitterDecisionException,
    );
    await expect(service.returnMonth(5, "fix the 3rd")).rejects.toBeInstanceOf(
      AttendanceMonthSubmitterDecisionException,
    );
  });

  it("approves from SUBMITTED and returns with a note, telling the submitter", async () => {
    const { service, repository, notifications } = setup();
    repository.findOne.mockResolvedValue(lockRow());
    await service.approve(5, "");
    expect(repository.transition).toHaveBeenLastCalledWith(
      { organizationId: 1 },
      5,
      {
        from: "SUBMITTED",
        to: "APPROVED",
        action: "approve",
        note: null,
        userId: ME,
      },
    );
    await service.returnMonth(5, "fix the 3rd");
    expect(repository.transition).toHaveBeenLastCalledWith(
      { organizationId: 1 },
      5,
      {
        from: "SUBMITTED",
        to: "RETURNED",
        action: "return",
        note: "fix the 3rd",
        userId: ME,
      },
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0]![1][0]!.userId).toBe(3);
  });

  it("bulk approve reports each failure without stopping", async () => {
    const { service, repository } = setup();
    repository.findOne
      .mockResolvedValueOnce(lockRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(lockRow({ submittedBy: ME }));
    const report = await service.approveMany({ ids: [5, 6, 7] });
    expect(report.approved).toEqual([5]);
    expect(report.skipped.map((s) => [s.id, s.code])).toEqual([
      [6, "RESOURCE_NOT_FOUND"],
      [7, "SUBMITTER_CANNOT_DECIDE"],
    ]);
  });
});
