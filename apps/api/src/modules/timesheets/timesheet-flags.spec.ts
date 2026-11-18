import { describe, expect, it } from "vitest";
import {
  flagsForDay,
  isNonWorkingDay,
  type FlagInput,
} from "./timesheet-flags.js";

const base: FlagInput = {
  date: "2026-11-16",
  today: "2026-11-17",
  attendanceStatus: "PRESENT",
  totalMinutes: 120,
  sessionReviewStates: ["OK"],
};
const codes = (over: Partial<FlagInput>) =>
  flagsForDay({ ...base, ...over }).map((f) => f.code);

describe("flagsForDay", () => {
  it("a normal worked day on a present day has no flags", () => {
    expect(codes({})).toEqual([]);
    expect(codes({ attendanceStatus: "HALF_DAY" })).toEqual([]);
  });

  it("work on an absent day or a leave day is a warning", () => {
    const [absent] = flagsForDay({ ...base, attendanceStatus: "ABSENT" });
    expect(absent).toMatchObject({
      code: "WORK_ON_ABSENT_DAY",
      severity: "warning",
    });
    expect(codes({ attendanceStatus: "ON_LEAVE" })).toEqual(["WORK_ON_LEAVE"]);
  });

  it("work on a holiday or weekly off is informational, not a warning", () => {
    const [holiday] = flagsForDay({ ...base, attendanceStatus: "HOLIDAY" });
    expect(holiday).toMatchObject({
      code: "WORK_ON_HOLIDAY",
      severity: "info",
    });
    const [off] = flagsForDay({ ...base, attendanceStatus: "WEEKLY_OFF" });
    expect(off).toMatchObject({ code: "WORK_ON_WEEKLY_OFF", severity: "info" });
  });

  it("no work, no attendance flag — an absence alone is HR's business, not a mismatch", () => {
    for (const status of ["ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"]) {
      expect(codes({ attendanceStatus: status, totalMinutes: 0 })).toEqual([]);
    }
  });

  it("an unmarked PAST day with work is flagged; an unmarked TODAY is not", () => {
    expect(codes({ attendanceStatus: "NOT_MARKED" })).toEqual([
      "WORK_WITHOUT_ATTENDANCE",
    ]);
    expect(
      codes({ attendanceStatus: "NOT_MARKED", date: "2026-11-17" }),
    ).toEqual([]);
  });

  it("an unknown attendance status is never guessed into a flag", () => {
    expect(codes({ attendanceStatus: null })).toEqual([]);
  });

  it("session review states raise their own flags even with no minutes", () => {
    expect(
      codes({
        totalMinutes: 0,
        sessionReviewStates: ["STALE_UNRESOLVED", "OK"],
      }),
    ).toEqual(["STALE_SESSION"]);
    expect(codes({ sessionReviewStates: ["REVIEW_REQUIRED"] })).toEqual([
      "SESSION_NEEDS_REVIEW",
    ]);
  });

  it("attendance changed after the day was submitted is flagged; unchanged or never-submitted is not", () => {
    expect(
      codes({
        attendanceStatus: "ABSENT",
        attendanceStatusAtSubmit: "PRESENT",
      }),
    ).toContain("ATTENDANCE_CHANGED_AFTER_SUBMIT");
    expect(
      codes({
        attendanceStatus: "PRESENT",
        attendanceStatusAtSubmit: "PRESENT",
      }),
    ).toEqual([]);
    expect(codes({ attendanceStatusAtSubmit: null })).toEqual([]);
    expect(codes({})).toEqual([]);
  });

  it("flags combine", () => {
    expect(
      codes({
        attendanceStatus: "ABSENT",
        sessionReviewStates: ["STALE_UNRESOLVED", "REVIEW_REQUIRED"],
      }),
    ).toEqual(["WORK_ON_ABSENT_DAY", "STALE_SESSION", "SESSION_NEEDS_REVIEW"]);
  });
});

describe("isNonWorkingDay", () => {
  it("is true only for the four days on which no work is expected", () => {
    for (const s of ["ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"]) {
      expect(isNonWorkingDay(s)).toBe(true);
    }
    for (const s of ["PRESENT", "HALF_DAY", "NOT_MARKED", null]) {
      expect(isNonWorkingDay(s)).toBe(false);
    }
  });
});
