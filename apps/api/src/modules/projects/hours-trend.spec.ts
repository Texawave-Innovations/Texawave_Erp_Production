import { describe, expect, it } from "vitest";
import { bucketWeeklyHours, mondayOf, weekStarts } from "./hours-trend.js";

describe("projects hours trend", () => {
  it("finds the Monday of any day, Sunday included", () => {
    expect(mondayOf("2026-03-09")).toBe("2026-03-09"); // Monday
    expect(mondayOf("2026-03-15")).toBe("2026-03-09"); // Sunday
    expect(mondayOf("2026-03-01")).toBe("2026-02-23"); // Sunday, prior month
  });

  it("lists week starts oldest first, ending with the current week", () => {
    expect(weekStarts("2026-03-11", 3)).toEqual([
      "2026-02-23",
      "2026-03-02",
      "2026-03-09",
    ]);
  });

  it("sums minutes into hours per week and zero-fills empty weeks", () => {
    const weeks = weekStarts("2026-03-11", 3);
    const rows = [
      { entryDate: new Date("2026-02-24T00:00:00Z"), durationMinutes: 90 },
      { entryDate: new Date("2026-03-01T00:00:00Z"), durationMinutes: 30 }, // Sunday → week of 23 Feb
      { entryDate: new Date("2026-03-10T00:00:00Z"), durationMinutes: 20 },
      { entryDate: new Date("2026-02-15T00:00:00Z"), durationMinutes: 600 }, // outside
    ];
    expect(bucketWeeklyHours(rows, weeks)).toEqual([
      { weekStart: "2026-02-23", hours: 2, entries: 2 },
      { weekStart: "2026-03-02", hours: 0, entries: 0 },
      { weekStart: "2026-03-09", hours: 0.33, entries: 1 },
    ]);
  });
});
