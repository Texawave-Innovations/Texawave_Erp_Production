import { describe, expect, it, vi } from "vitest";
import { TasksService } from "./tasks.service.js";

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findTasks: vi.fn(),
    findTaskById: vi.fn(),
    findMyTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getPointsConfig: vi.fn(),
    awardPoints: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(10),
  };
  const employeeQuery = {
    getCurrentEmployee: vi.fn(),
    findCurrentEmployeeOrNull: vi.fn(),
  };
  const taskNumberMaster = {
    findOne: vi.fn().mockResolvedValue({
      taskPrefix: "T",
      separator: "-",
      sequenceDigits: 2,
    }),
  };
  const service = new TasksService(
    repository as never,
    tenantContext as never,
    employeeQuery as never,
    taskNumberMaster as never,
  );
  return { service, repository, tenantContext, employeeQuery };
}

describe("TasksService", () => {
  it("throws an error if task end date is before start date", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ id: 1, name: "Test Project" });

    await expect(
      service.createTask(1, {
        title: "Bad Dates Task",
        startDate: "2026-10-15",
        endDate: "2026-10-10",
      }),
    ).rejects.toThrow("Task end date cannot be earlier than start date");
  });

  it("detects and rejects circular task dependencies", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ id: 1, name: "Test Project" });

    // Existing tasks: Task 1 depends on Task 2
    repository.findTasks.mockResolvedValue([
      { id: 1, dependencyTaskId: 2 },
      { id: 2, dependencyTaskId: null },
    ]);

    // Attempting to update Task 2 to depend on Task 1 would create 2 -> 1 -> 2
    repository.findTaskById.mockResolvedValue({
      id: 2,
      projectId: 1,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-10"),
      status: "in_progress",
    });

    await expect(
      service.updateTask(2, {
        dependencyTaskId: 1,
      }),
    ).rejects.toThrow("Circular dependency detected");
  });

  it("calculates default business hours and points on task creation", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      id: 1,
      name: "Test Project",
      projectCode: "TXW/PRJ/ME/26-27/001",
    });
    repository.getPointsConfig.mockResolvedValue({
      low: 5,
      medium: 10,
      high: 20,
      urgent: 30,
    });
    repository.createTask.mockResolvedValue({
      id: 101,
      taskCode: "TSK-000001",
      title: "Design DB Schema",
      hoursToComplete: 16,
      points: 20,
    });

    // 2 days from Monday 2026-10-05 to Tuesday 2026-10-06 = 2 working days * 8h = 16h
    const created = await service.createTask(1, {
      title: "Design DB Schema",
      startDate: "2026-10-05",
      endDate: "2026-10-06",
      priority: "high",
    });

    expect(created.taskCode).toBe("TSK-000001");
    expect(repository.createTask).toHaveBeenCalledWith(
      { organizationId: 1 },
      1,
      expect.objectContaining({ title: "Design DB Schema", priority: "high" }),
      16, // 2 business days * 8 hours
      20, // high priority config points
      10, // userId
      { id: 1, projectCode: "TXW/PRJ/ME/26-27/001" },
      { taskPrefix: "T", separator: "-", sequenceDigits: 2 },
    );
  });

  it("awards gamification points when a task status transitions to completed", async () => {
    const { service, repository } = makeService();
    repository.findTaskById.mockResolvedValue({
      id: 50,
      taskCode: "TSK-000050",
      priority: "high",
      projectId: 1,
      title: "API Implementation",
      assignedToId: 7,
      status: "in_progress",
      points: 25,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-10"),
    });

    repository.updateTask.mockResolvedValue({
      id: 50,
      taskCode: "TSK-000050",
      priority: "high",
      projectId: 1,
      title: "API Implementation",
      assignedToId: 7,
      status: "completed",
      points: 25,
    });

    await service.updateTask(50, { status: "completed" });

    // Verify points were awarded to employee 7
    expect(repository.awardPoints).toHaveBeenCalledWith(
      { organizationId: 1 },
      7,
      50,
      "API Implementation",
      25,
      "Completed TSK-000050 (high priority)",
    );
  });
});
