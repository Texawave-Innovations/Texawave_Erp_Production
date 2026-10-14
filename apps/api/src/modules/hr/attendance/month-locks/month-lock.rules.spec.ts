import { describe, expect, it } from "vitest";
import {
  datesBetween,
  employedWindow,
  FINALIZABLE_FROM,
  firstDayOf,
  isLocked,
  isMonthComplete,
  lastDayOf,
  monthOf,
  summarise,
} from "./month-lock.rules.js";

describe("month-lock rules", () => {
  it("locks only SUBMITTED and APPROVED months", () => {
    expect(isLocked("SUBMITTED")).toBe(true);
    expect(isLocked("APPROVED")).toBe(true);
    expect(isLocked("RETURNED")).toBe(false);
    expect(isLocked("REOPENED")).toBe(false);
    expect(isLocked(null)).toBe(false);
  });

  it("finalizes from no row, RETURNED or REOPENED only", () => {
    expect(FINALIZABLE_FROM).toEqual([null, "RETURNED", "REOPENED"]);
  });

  it("derives month bounds, including leap February", () => {
    expect(firstDayOf("2026-09")).toBe("2026-09-01");
    expect(lastDayOf("2026-09")).toBe("2026-09-30");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
    expect(lastDayOf("2026-12")).toBe("2026-12-31");
    expect(monthOf("2026-09-17")).toBe("2026-09");
  });

  it("treats a month as complete only once its last day is before today", () => {
    expect(isMonthComplete("2026-09", "2026-10-01")).toBe(true);
    expect(isMonthComplete("2026-09", "2026-09-30")).toBe(false);
    expect(isMonthComplete("2026-10", "2026-10-11")).toBe(false);
  });

  it("clips the window to joining and exit", () => {
    expect(employedWindow("2026-09", "2025-01-01", null)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(employedWindow("2026-09", "2026-09-10", "2026-09-20")).toEqual({
      from: "2026-09-10",
      to: "2026-09-20",
    });
    expect(employedWindow("2026-09", "2026-10-01", null)).toBeNull();
    expect(employedWindow("2026-09", "2025-01-01", "2026-08-31")).toBeNull();
  });

  it("lists every date in a range", () => {
    expect(datesBetween("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("summarises counts and minutes, with net overtime", () => {
    const s = summarise({ from: "2026-09-01", to: "2026-09-03" }, [
      {
        status: "PRESENT",
        workedMinutes: 480,
        overtimeMinutes: 60,
        shortfallMinutes: 0,
      },
      {
        status: "PRESENT",
        workedMinutes: 400,
        overtimeMinutes: 0,
        shortfallMinutes: 80,
      },
      {
        status: "HOLIDAY",
        workedMinutes: 0,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      },
    ]);
    expect(s.daysCounted).toBe(3);
    expect(s.countsByStatus.PRESENT).toBe(2);
    expect(s.countsByStatus.HOLIDAY).toBe(1);
    expect(s.workedMinutes).toBe(880);
    expect(s.netOvertimeMinutes).toBe(-20);
  });
});
