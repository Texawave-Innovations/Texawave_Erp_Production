import { describe, expect, it } from "vitest";
import {
  calculateBudgetUtilization,
  calculateBusinessHours,
  calculateEarnedAmount,
  calculateProjectHealth,
  calculateResourceUtilization,
  hasCircularDependency,
  isMilestoneUpcoming,
} from "./project-calculations.js";

describe("Project Calculations", () => {
  describe("calculateBusinessHours", () => {
    it("returns 0 when dates are missing or invalid", () => {
      expect(calculateBusinessHours(undefined, undefined)).toBe(0);
      expect(calculateBusinessHours("2026-08-01", "invalid-date")).toBe(0);
    });

    it("returns 0 if end date is earlier than start date", () => {
      expect(calculateBusinessHours("2026-08-10", "2026-08-05")).toBe(0);
    });

    it("calculates 8 hours for a single business day (Monday)", () => {
      // 2026-08-03 is Monday
      expect(calculateBusinessHours("2026-08-03", "2026-08-03")).toBe(8);
    });

    it("calculates 0 hours for a weekend day (Saturday or Sunday)", () => {
      // 2026-08-01 is Saturday, 2026-08-02 is Sunday
      expect(calculateBusinessHours("2026-08-01", "2026-08-02")).toBe(0);
    });

    it("calculates exactly 40 hours for a 5-day work week (Monday to Friday)", () => {
      // 2026-08-03 (Mon) to 2026-08-07 (Fri) = 5 days * 8 = 40 hours
      expect(calculateBusinessHours("2026-08-03", "2026-08-07")).toBe(40);
    });

    it("correctly excludes weekend days across multiple weeks", () => {
      // 2026-08-03 (Mon) to 2026-08-14 (Fri) = 10 business days * 8 = 80 hours
      expect(calculateBusinessHours("2026-08-03", "2026-08-14")).toBe(80);
    });
  });

  describe("calculateProjectHealth", () => {
    const today = new Date("2026-08-15T00:00:00.000Z");

    it("returns 'completed' if the project entity is marked completed", () => {
      expect(calculateProjectHealth([], true, today)).toBe("completed");
    });

    it("returns 'completed' if all milestones are completed", () => {
      const milestones = [
        { targetDate: "2026-08-10", status: "completed" },
        { targetDate: "2026-08-20", status: "completed" },
      ];
      expect(calculateProjectHealth(milestones, false, today)).toBe(
        "completed",
      );
    });

    it("returns 'delayed' if at least one incomplete milestone has targetDate < today", () => {
      const milestones = [
        { targetDate: "2026-08-10", status: "in_progress" }, // past targetDate
        { targetDate: "2026-08-25", status: "not_started" },
      ];
      expect(calculateProjectHealth(milestones, false, today)).toBe("delayed");
    });

    it("returns 'on_track' if incomplete milestones are in the future", () => {
      const milestones = [
        { targetDate: "2026-08-10", status: "completed" },
        { targetDate: "2026-08-25", status: "in_progress" },
      ];
      expect(calculateProjectHealth(milestones, false, today)).toBe("on_track");
    });

    it("stays 'on_track' when an incomplete milestone is merely due soon (no third state)", () => {
      const milestones = [
        { targetDate: "2026-08-10", status: "completed" },
        { targetDate: "2026-08-22", status: "in_progress" }, // today + 7
      ];
      expect(calculateProjectHealth(milestones, false, today)).toBe("on_track");
      // Due today is still on track, not delayed — legacy only flips to
      // 'delayed' once targetDate is strictly before today.
      expect(
        calculateProjectHealth(
          [{ targetDate: "2026-08-15", status: "not_started" }],
          false,
          today,
        ),
      ).toBe("on_track");
    });

    it("ignores overdue tasks entirely — legacy health is milestone-only", () => {
      const milestones = [{ targetDate: "2026-09-30", status: "in_progress" }];
      expect(calculateProjectHealth(milestones, false, today)).toBe("on_track");
      expect(calculateProjectHealth([], false, today)).toBe("on_track");
    });
  });

  describe("isMilestoneUpcoming", () => {
    const today = new Date("2026-08-15T00:00:00.000Z");

    it("is true for an incomplete milestone due within the default 7-day window", () => {
      expect(
        isMilestoneUpcoming(
          { targetDate: "2026-08-22", status: "in_progress" },
          7,
          today,
        ),
      ).toBe(true);
      expect(
        isMilestoneUpcoming(
          { targetDate: "2026-08-15", status: "not_started" },
          7,
          today,
        ),
      ).toBe(true);
    });

    it("is false once the milestone is completed or outside the window", () => {
      expect(
        isMilestoneUpcoming(
          { targetDate: "2026-08-22", status: "completed" },
          7,
          today,
        ),
      ).toBe(false);
      expect(
        isMilestoneUpcoming(
          { targetDate: "2026-08-23", status: "in_progress" },
          7,
          today,
        ),
      ).toBe(false);
      expect(
        isMilestoneUpcoming(
          { targetDate: "2026-08-10", status: "in_progress" },
          7,
          today,
        ),
      ).toBe(false);
    });
  });

  describe("calculateEarnedAmount", () => {
    it("returns 0 for non-positive expected hours or logged hours", () => {
      expect(calculateEarnedAmount(0, 50000, 100)).toBe(0);
      expect(calculateEarnedAmount(10, 50000, 0)).toBe(0);
      expect(calculateEarnedAmount(10, 0, 100)).toBe(0);
    });

    it("calculates prorated revenue earned, rounded to whole rupees (legacy behavior)", () => {
      // Price = 60,000, Expected = 480h -> Rate = 125/h
      // Logged = 24.5h -> 24.5 * 125 = 3062.5 -> rounds to 3063
      expect(calculateEarnedAmount(24.5, 60000, 480)).toBe(3063);
    });
  });

  describe("calculateBudgetUtilization", () => {
    it("computes under-budget positive variance", () => {
      const result = calculateBudgetUtilization(8500, 60000);
      expect(result.utilizationPercent).toBe(14); // 8500/60000 = 14.16%
      expect(result.variance).toBe(51500);
      expect(result.isUnderBudget).toBe(true);
    });

    it("computes over-budget negative variance", () => {
      const result = calculateBudgetUtilization(65000, 60000);
      expect(result.utilizationPercent).toBe(108);
      expect(result.variance).toBe(-5000);
      expect(result.isUnderBudget).toBe(false);
    });
  });

  describe("calculateResourceUtilization", () => {
    it("returns 0 if engineers or tasks count is zero", () => {
      expect(calculateResourceUtilization(0, 5)).toBe(0);
      expect(calculateResourceUtilization(5, 0)).toBe(0);
    });

    it("calculates utilization percentage and caps at 100", () => {
      expect(calculateResourceUtilization(3, 6)).toBe(50);
      expect(calculateResourceUtilization(10, 5)).toBe(100); // 200% capped at 100%
    });
  });

  describe("hasCircularDependency", () => {
    it("returns false if candidateDependencyId is null or undefined", () => {
      expect(hasCircularDependency([], 1, null)).toBe(false);
      expect(hasCircularDependency([], 1, undefined)).toBe(false);
    });

    it("detects immediate self-dependency (task depending on itself)", () => {
      expect(hasCircularDependency([], 5, 5)).toBe(true);
    });

    it("detects direct 2-node cycle (A -> B -> A)", () => {
      const allTasks = [
        { id: 1, dependencyTaskId: null },
        { id: 2, dependencyTaskId: 1 },
      ];
      // Task 1 tries to depend on Task 2 (2 already depends on 1)
      expect(hasCircularDependency(allTasks, 1, 2)).toBe(true);
    });

    it("detects multi-node cycle (A -> B -> C -> A)", () => {
      const allTasks = [
        { id: 1, dependencyTaskId: null },
        { id: 2, dependencyTaskId: 1 },
        { id: 3, dependencyTaskId: 2 },
      ];
      // Task 1 tries to depend on Task 3
      expect(hasCircularDependency(allTasks, 1, 3)).toBe(true);
    });

    it("permits valid acyclic dependencies", () => {
      const allTasks = [
        { id: 1, dependencyTaskId: null },
        { id: 2, dependencyTaskId: 1 },
        { id: 3, dependencyTaskId: 2 },
        { id: 4, dependencyTaskId: null },
      ];
      // Task 4 depends on Task 3 -> completely acyclic
      expect(hasCircularDependency(allTasks, 4, 3)).toBe(false);
    });
  });
});
