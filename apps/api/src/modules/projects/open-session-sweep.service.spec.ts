import { describe, expect, it, vi } from "vitest";
import { OpenSessionSweepService } from "./open-session-sweep.service.js";

const at = (iso: string) => new Date(iso);

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    employeeId: 5,
    startedAt: at("2026-11-16T04:30:00Z"), // 10:00 IST
    task: { taskCode: "TSK-1", title: "Dashboard" },
    employee: { userId: 50 },
    ...overrides,
  };
}

function makeService(open: ReturnType<typeof session>[]) {
  const lifecycle = {
    organizationsWithOpenSessions: vi.fn().mockResolvedValue([1]),
    findOpenSessions: vi.fn().mockResolvedValue(open),
    closeSessionAt: vi.fn().mockResolvedValue({ id: 1 }),
  };
  const attendance = { firstCheckOutSince: vi.fn().mockResolvedValue(null) };
  const notifications = { notifyUser: vi.fn().mockResolvedValue(1) };
  const service = new OpenSessionSweepService(
    lifecycle as never,
    attendance as never,
    notifications as never,
  );
  return { service, lifecycle, attendance, notifications };
}

describe("OpenSessionSweepService", () => {
  it("closes a session at the employee's real check-out and rolls the hours up", async () => {
    const { service, lifecycle, attendance, notifications } = makeService([
      session(),
    ]);
    attendance.firstCheckOutSince.mockResolvedValue(at("2026-11-16T12:30:00Z")); // 18:00 IST

    const result = await service.runForOrganization(
      1,
      at("2026-11-16T14:00:00Z"),
    );

    expect(result).toMatchObject({
      closedAtCheckout: 1,
      closedStale: 0,
      kept: 0,
    });
    expect(attendance.firstCheckOutSince).toHaveBeenCalledWith(
      1,
      5,
      at("2026-11-16T04:30:00Z"),
    );
    expect(lifecycle.closeSessionAt).toHaveBeenCalledWith(
      { organizationId: 1 },
      expect.objectContaining({
        sessionId: 1,
        endedAt: at("2026-11-16T12:30:00Z"),
        closedReason: "ATTENDANCE_CHECKOUT",
        rollup: true,
      }),
    );
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it("no check-out and IST midnight crossed: closes with ZERO minutes (never a guessed end), flags it and tells the employee once", async () => {
    const { service, lifecycle, notifications } = makeService([
      session({ startedAt: at("2026-11-16T12:00:00Z") }), // 17:30 IST
    ]);

    const result = await service.runForOrganization(
      1,
      at("2026-11-16T19:00:00Z"),
    ); // 00:30 IST

    expect(result).toMatchObject({ closedStale: 1, closedAtCheckout: 0 });
    expect(lifecycle.closeSessionAt).toHaveBeenCalledWith(
      { organizationId: 1 },
      expect.objectContaining({
        endedAt: at("2026-11-16T12:00:00Z"), // its own start: nothing invented
        closedReason: "STALE",
        reviewState: "STALE_UNRESOLVED",
        rollup: false,
      }),
    );
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      { organizationId: 1 },
      50,
      expect.objectContaining({
        type: "timesheet.stale_session",
        dedupKey: "timesheet.stale:1",
      }),
    );
  });

  it("leaves a session that is simply still running alone", async () => {
    const { service, lifecycle } = makeService([session()]);
    const result = await service.runForOrganization(
      1,
      at("2026-11-16T08:30:00Z"),
    );
    expect(result).toMatchObject({
      kept: 1,
      closedAtCheckout: 0,
      closedStale: 0,
    });
    expect(lifecycle.closeSessionAt).not.toHaveBeenCalled();
  });

  it("does not notify when someone else closed the session first (idempotent)", async () => {
    const { service, lifecycle, notifications } = makeService([
      session({ startedAt: at("2026-11-16T12:00:00Z") }),
    ]);
    lifecycle.closeSessionAt.mockResolvedValue(null); // already closed
    const result = await service.runForOrganization(
      1,
      at("2026-11-16T19:00:00Z"),
    );
    expect(result.closedStale).toBe(0);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it("one failing session does not stop the others", async () => {
    const { service, lifecycle } = makeService([
      session({ id: 1 }),
      session({ id: 2, employeeId: 6, employee: { userId: 60 } }),
    ]);
    lifecycle.closeSessionAt
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: 2 });
    // both sessions are stale (started yesterday, no check-out)
    const result = await service.runForOrganization(
      1,
      at("2026-11-17T09:00:00Z"),
    );
    expect(result).toMatchObject({ failed: 1, closedStale: 1 });
    expect(lifecycle.closeSessionAt).toHaveBeenCalledTimes(2);
  });

  it("does not tell an employee who has no user account, but still closes the session", async () => {
    const { service, notifications } = makeService([
      session({
        startedAt: at("2026-11-16T12:00:00Z"),
        employee: { userId: null },
      }),
    ]);
    const result = await service.runForOrganization(
      1,
      at("2026-11-16T19:00:00Z"),
    );
    expect(result.closedStale).toBe(1);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it("the lazy per-employee path asks only for that employee's sessions", async () => {
    const { service, lifecycle } = makeService([]);
    await service.resolveEmployee(1, 5, at("2026-11-16T09:00:00Z"));
    expect(lifecycle.findOpenSessions).toHaveBeenCalledWith(
      { organizationId: 1 },
      5,
    );
  });

  it("the all-organizations run isolates a failing organization", async () => {
    const { service, lifecycle } = makeService([session()]);
    lifecycle.organizationsWithOpenSessions.mockResolvedValue([1, 2]);
    lifecycle.findOpenSessions
      .mockRejectedValueOnce(new Error("org 1 down"))
      .mockResolvedValueOnce([]);
    const result = await service.runForAllOrganizations(
      at("2026-11-16T09:00:00Z"),
    );
    expect(result.failed).toBe(1);
    expect(lifecycle.findOpenSessions).toHaveBeenCalledTimes(2);
  });
});
