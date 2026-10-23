import { describe, expect, it, vi } from "vitest";
import type { LeaveNotificationFacts } from "./leave-requests.repository.js";
import { LeaveNotificationsService } from "./leave-notifications.service.js";

const facts: LeaveNotificationFacts = {
  id: 7,
  employeeId: 1,
  employeeName: "Asha",
  employeeCode: "E1",
  employeeUserId: 20,
  teamId: 3,
  managerUserId: 30,
  leaveTypeName: "Casual",
  startDate: "2026-10-05",
  endDate: "2026-10-06",
  leaveDays: 2,
  status: "PENDING",
  requestedBy: 20,
  firstDecidedBy: null,
  decidedBy: null,
  decisionNote: null,
  cancellationNote: null,
};

function make(over: Partial<LeaveNotificationFacts> = {}, actorId = 20) {
  const repository = {
    notificationFacts: vi.fn().mockResolvedValue({ ...facts, ...over }),
    activeDelegatesOf: vi.fn().mockResolvedValue([31]),
    usersWithApprove: vi.fn().mockResolvedValue([40, 41]),
  };
  const notifications = { notify: vi.fn().mockResolvedValue(1) };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(actorId),
  };
  const service = new LeaveNotificationsService(
    repository as never,
    notifications as never,
    tenantContext as never,
  );
  const sent = () =>
    (notifications.notify.mock.calls[0]?.[1] ?? []) as {
      userId: number;
      type: string;
    }[];
  return { service, repository, notifications, sent };
}

describe("LeaveNotificationsService", () => {
  it("tells the reporting manager and their delegates about a new request, not the employee who acted", async () => {
    const { service, sent } = make();
    await service.leaveChanged(7, {
      kind: "submitted",
      onBehalf: false,
      resubmitted: false,
    });
    expect(sent().map((n) => [n.userId, n.type])).toEqual([
      [30, "leave.submitted"],
      [31, "leave.submitted"],
    ]);
  });

  it("falls back to the team's approvers when there is no reporting manager", async () => {
    const { service, repository, sent } = make({ managerUserId: null });
    await service.leaveChanged(7, {
      kind: "submitted",
      onBehalf: false,
      resubmitted: false,
    });
    expect(repository.usersWithApprove).toHaveBeenCalledWith(
      { organizationId: 1 },
      ["team", "all"],
      3,
    );
    expect(sent().map((n) => n.userId)).toEqual([40, 41]);
  });

  it("on behalf: tells the approvers and the employee, never HR who applied", async () => {
    const { service, sent } = make(
      { requestedBy: 40, managerUserId: null },
      40,
    );
    await service.leaveChanged(7, {
      kind: "submitted",
      onBehalf: true,
      resubmitted: false,
    });
    expect(sent().map((n) => [n.userId, n.type])).toEqual([
      [41, "leave.submitted"],
      [20, "leave.submitted_on_behalf"],
    ]);
  });

  it("first approval: the employee and HR, except the first approver", async () => {
    const { service, sent } = make({ firstDecidedBy: 41 }, 41);
    await service.leaveChanged(7, { kind: "first_approved" });
    expect(sent().map((n) => [n.userId, n.type])).toEqual([
      [20, "leave.first_approved"],
      [40, "leave.awaiting_hr"],
    ]);
  });

  it("a decision goes to the employee only", async () => {
    const { service, sent } = make(
      { decidedBy: 30, decisionNote: "no cover" },
      30,
    );
    await service.leaveChanged(7, { kind: "rejected" });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: 20,
        type: "leave.rejected",
        body: expect.stringContaining("no cover") as unknown,
        link: "/portal/leave?id=7",
      }),
    ]);
  });

  it("withdrawal of approved leave tells whoever approved it; withdrawal of pending leave tells nobody", async () => {
    const approved = make({ decidedBy: 40, firstDecidedBy: 30 });
    await approved.service.leaveChanged(7, {
      kind: "cancelled",
      byHr: false,
      wasApproved: true,
    });
    expect(approved.sent().map((n) => n.userId)).toEqual([40, 30]);

    const pending = make();
    await pending.service.leaveChanged(7, {
      kind: "cancelled",
      byHr: false,
      wasApproved: false,
    });
    expect(pending.sent()).toEqual([]);
  });

  it("never throws: a failure is logged and swallowed", async () => {
    const { service, notifications } = make();
    notifications.notify.mockRejectedValue(new Error("db down"));
    await expect(
      service.leaveChanged(7, { kind: "approved" }),
    ).resolves.toBeUndefined();
  });
});
