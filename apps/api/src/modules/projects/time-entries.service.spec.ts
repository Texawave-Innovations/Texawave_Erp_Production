import { describe, expect, it, vi } from "vitest";
import { TimeEntriesService } from "./time-entries.service.js";

function makeService() {
  const repository = {
    findActiveTimer: vi.fn(),
    findTaskById: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    createManualTimeEntry: vi.fn(),
    incrementLoggedHours: vi.fn(),
    findTaskTimeEntries: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
  };
  const employeeQuery = {
    findCurrentEmployeeOrNull: vi
      .fn()
      .mockResolvedValue({ id: 5, fullName: "Alice Engineer" }),
  };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const attendance = {
    // Default: checked in (open session) so the stopwatch gate passes.
    findMine: vi.fn().mockResolvedValue({
      items: [
        {
          attendanceDate: today,
          hasOpenSession: true,
          sessions: [{ checkInAt: new Date(), checkOutAt: null }],
        },
      ],
    }),
  };
  const service = new TimeEntriesService(
    repository as never,
    tenantContext as never,
    employeeQuery as never,
    attendance as never,
  );
  return { service, repository, employeeQuery, attendance, today };
}

describe("TimeEntriesService", () => {
  it("rejects starting a new timer when one is already active", async () => {
    const { service, repository } = makeService();
    repository.findTaskById.mockResolvedValue({
      id: 2,
      taskCode: "TSK-000002",
    });
    repository.findActiveTimer.mockResolvedValue({
      id: 99,
      taskId: 1,
      task: { taskCode: "TSK-000001" },
    });

    await expect(service.startTimer(2)).rejects.toThrow(
      "Another timer is already running",
    );
  });

  it("starts a timer when no active timer exists", async () => {
    const { service, repository } = makeService();
    repository.findTaskById.mockResolvedValue({
      id: 2,
      taskCode: "TSK-000002",
    });
    repository.findActiveTimer.mockResolvedValue(null);
    repository.startTimer.mockResolvedValue({
      id: 100,
      taskId: 2,
      employeeId: 5,
    });

    const result = await service.startTimer(2);
    expect(result.id).toBe(100);
    expect(repository.startTimer).toHaveBeenCalledWith(
      { organizationId: 1 },
      2,
      5,
    );
  });

  it("stops a timer, records elapsed minutes, and increments logged hours", async () => {
    const { service, repository } = makeService();
    const startedAt = new Date(Date.now() - 90 * 60 * 1000); // 90 minutes ago
    repository.findTaskById.mockResolvedValue({
      id: 2,
      projectId: 10,
      taskCode: "TSK-000002",
    });
    repository.findActiveTimer.mockResolvedValue({
      id: 100,
      taskId: 2,
      startedAt,
    });
    repository.stopTimer.mockResolvedValue({
      id: 100,
      durationMinutes: 90,
    });

    const stopped = await service.stopTimer(2, "Completed component test");
    expect(stopped).toBeDefined();
    expect(repository.stopTimer).toHaveBeenCalledWith(
      { organizationId: 1 },
      100,
      expect.any(Number),
      "Completed component test",
      expect.any(Date),
    );
    expect(repository.incrementLoggedHours).toHaveBeenCalledWith(
      { organizationId: 1 },
      10, // projectId
      2, // taskId
      5, // employeeId
      expect.any(Number), // hours
    );
  });

  it("refuses to start a timer when the employee is not checked in", async () => {
    const { service, repository, attendance } = makeService();
    repository.findTaskById.mockResolvedValue({ id: 2, taskCode: "T" });
    attendance.findMine.mockResolvedValue({ items: [] });
    await expect(service.startTimer(2)).rejects.toThrow(
      "Check in for today before starting a timer",
    );
    expect(repository.startTimer).not.toHaveBeenCalled();
  });

  it("refuses to start a timer after the employee has checked out", async () => {
    const { service, repository, attendance, today } = makeService();
    repository.findTaskById.mockResolvedValue({ id: 2, taskCode: "T" });
    attendance.findMine.mockResolvedValue({
      items: [
        {
          attendanceDate: today,
          hasOpenSession: false,
          sessions: [{ checkInAt: new Date(), checkOutAt: new Date() }],
        },
      ],
    });
    await expect(service.startTimer(2)).rejects.toThrow("checked out");
  });

  it("auto-pauses a running timer at the check-out time", async () => {
    const { service, repository, attendance, today } = makeService();
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const checkOutAt = new Date(Date.now() - 30 * 60 * 1000);
    repository.findActiveTimer.mockResolvedValue({
      id: 7,
      taskId: 3,
      startedAt,
      task: { projectId: 11 },
    });
    attendance.findMine.mockResolvedValue({
      items: [
        {
          attendanceDate: today,
          hasOpenSession: false,
          sessions: [{ checkInAt: startedAt, checkOutAt }],
        },
      ],
    });

    const result = await service.getActiveTimer();

    expect(result).toBeNull();
    expect(repository.stopTimer).toHaveBeenCalledWith(
      { organizationId: 1 },
      7,
      90,
      "Auto-paused at attendance check-out",
      checkOutAt,
    );
    expect(repository.incrementLoggedHours).toHaveBeenCalledWith(
      { organizationId: 1 },
      11,
      3,
      5,
      1.5,
    );
  });

  it("keeps a running timer while the employee is still checked in", async () => {
    const { service, repository } = makeService();
    const active = {
      id: 8,
      taskId: 3,
      startedAt: new Date(),
      task: { projectId: 1 },
    };
    repository.findActiveTimer.mockResolvedValue(active);
    await expect(service.getActiveTimer()).resolves.toBe(active);
    expect(repository.stopTimer).not.toHaveBeenCalled();
  });
});
