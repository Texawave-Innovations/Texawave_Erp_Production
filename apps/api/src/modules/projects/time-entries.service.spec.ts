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
  const service = new TimeEntriesService(
    repository as never,
    tenantContext as never,
    employeeQuery as never,
  );
  return { service, repository, employeeQuery };
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
    );
    expect(repository.incrementLoggedHours).toHaveBeenCalledWith(
      { organizationId: 1 },
      10, // projectId
      2, // taskId
      5, // employeeId
      expect.any(Number), // hours
    );
  });
});
