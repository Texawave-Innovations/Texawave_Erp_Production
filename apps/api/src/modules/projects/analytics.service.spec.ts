import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsAnalyticsService } from "./analytics.service.js";

/** 2026-03-10 at noon IST: the business date is 2026-03-10. */
const NOW = new Date("2026-03-10T06:30:00.000Z");

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function milestone(
  id: number,
  title: string,
  target: string,
  status = "pending",
) {
  return { id, title, targetDate: day(target), actualDate: null, status };
}

function project(id: number, milestones: ReturnType<typeof milestone>[]) {
  return {
    id,
    projectCode: `PRJ-00${id}`,
    name: `Project ${id}`,
    status: "active",
    departments: [],
    projectPrice: 0,
    actualCost: 0,
    expectedHours: 0,
    members: [],
    milestones,
    tasks: [],
  };
}

function makeService(projects: ReturnType<typeof project>[]) {
  const repository = {
    findAllForAnalytics: vi.fn().mockResolvedValue(projects),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
  };
  return new ProjectsAnalyticsService(
    repository as never,
    tenantContext as never,
  );
}

describe("ProjectsAnalyticsService.getDashboardMetrics upcomingMilestones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("lists open milestones due within 7 days, soonest first, with their project", async () => {
    const service = makeService([
      project(1, [
        milestone(11, "Design sign-off", "2026-03-15"),
        milestone(12, "Kick-off", "2026-03-10"),
        milestone(13, "Past due", "2026-03-09"),
        milestone(14, "Too far out", "2026-03-18"),
        milestone(15, "Already done", "2026-03-11", "completed"),
      ]),
      project(2, [milestone(21, "Prototype", "2026-03-12")]),
    ]);

    const metrics = await service.getDashboardMetrics();

    expect(metrics.upcomingMilestonesCount).toBe(3);
    expect(metrics.upcomingMilestones).toEqual([
      {
        id: 12,
        title: "Kick-off",
        targetDate: "2026-03-10",
        projectId: 1,
        projectCode: "PRJ-001",
        projectName: "Project 1",
      },
      {
        id: 21,
        title: "Prototype",
        targetDate: "2026-03-12",
        projectId: 2,
        projectCode: "PRJ-002",
        projectName: "Project 2",
      },
      {
        id: 11,
        title: "Design sign-off",
        targetDate: "2026-03-15",
        projectId: 1,
        projectCode: "PRJ-001",
        projectName: "Project 1",
      },
    ]);
  });

  it("caps the list at 5 while the count stays complete", async () => {
    const service = makeService([
      project(
        1,
        Array.from({ length: 7 }, (_, i) =>
          milestone(100 + i, `M${i}`, `2026-03-1${i % 7}`),
        ),
      ),
    ]);

    const metrics = await service.getDashboardMetrics();

    expect(metrics.upcomingMilestonesCount).toBe(7);
    expect(metrics.upcomingMilestones).toHaveLength(5);
    expect(metrics.upcomingMilestones.map((m) => m.targetDate)).toEqual([
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ]);
  });
});
