import { describe, expect, it, vi } from "vitest";
import { ProjectsService } from "./projects.service.js";

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(10),
  };
  const service = new ProjectsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

describe("ProjectsService", () => {
  it("creates a new project and calls repository.create", async () => {
    const { service, repository } = makeService();
    const createdProject = {
      id: 1,
      projectCode: "PRJ-000001",
      name: "ERP Overhaul",
      expectedHours: 120,
      projectPrice: 50000,
      actualCost: 0,
      status: "active",
      startDate: new Date("2026-10-01"),
      plannedEndDate: new Date("2026-12-31"),
      members: [],
      milestones: [],
      tasks: [],
    };
    repository.create.mockResolvedValue(createdProject);
    repository.findOne.mockResolvedValue(createdProject);

    const dto = {
      name: "ERP Overhaul",
      startDate: "2026-10-01",
      plannedEndDate: "2026-12-31",
      expectedHours: 120,
      projectPrice: 50000,
    };

    const result = await service.create(dto);
    expect(result).toBeDefined();
    expect(result.projectCode).toBe("PRJ-000001");
    expect(repository.create).toHaveBeenCalledWith(
      { organizationId: 1 },
      dto,
      10,
    );
  });

  it("finds a project by id and enriches it with calculated metrics", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      id: 1,
      projectCode: "PRJ-000001",
      name: "ERP Overhaul",
      expectedHours: "100.00",
      projectPrice: "50000.00",
      actualCost: "15000.00",
      status: "active",
      startDate: new Date("2026-10-01"),
      plannedEndDate: new Date("2026-12-31"),
      tasks: [
        { id: 10, status: "completed", hoursToComplete: "40.00" },
        { id: 11, status: "in_progress", hoursToComplete: "60.00" },
      ],
      members: [{ id: 100, employeeId: 5, loggedHours: "35.00" }],
      milestones: [],
    });

    const project = await service.findOne(1);
    expect(project).toBeDefined();
    expect(project.progressPercent).toBe(50); // 1 out of 2 tasks completed = 50%
    expect(project.totalLoggedHours).toBe(35);
    expect(project.earnedAmount).toBe(17500); // 35h / 100h * 50000 = 17500
    expect(project.budgetVariance).toBe(35000); // 50000 - 15000
  });

  it("updates a project and returns updated record", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      id: 1,
      projectCode: "PRJ-000001",
      name: "ERP NextGen",
      expectedHours: "100.00",
      projectPrice: "50000.00",
      actualCost: "0.00",
      tasks: [],
      members: [],
      milestones: [],
    });
    repository.update.mockResolvedValue({
      id: 1,
      projectCode: "PRJ-000001",
      name: "ERP NextGen",
    });

    const result = await service.update(1, { name: "ERP NextGen" });
    expect(result.name).toBe("ERP NextGen");
    expect(repository.update).toHaveBeenCalledWith(
      { organizationId: 1 },
      1,
      { name: "ERP NextGen" },
      10,
    );
  });

  it("soft deletes a project", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      id: 1,
      tasks: [],
      members: [],
      milestones: [],
    });
    repository.softDelete.mockResolvedValue(true);

    const deleted = await service.softDelete(1);
    expect(deleted.success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(
      { organizationId: 1 },
      1,
      10,
    );
  });
});
