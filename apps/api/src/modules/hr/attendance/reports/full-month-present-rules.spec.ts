import { AttendanceCalculationService } from "../services/attendance-calculation.service.js";
import type { EffectiveStatus } from "../services/attendance-calculation.service.js";
import {
  employedWholeMonthOf,
  isFullMonthPresent,
} from "./full-month-present-rules.js";

const ok = (statuses: EffectiveStatus[]) =>
  isFullMonthPresent({
    monthComplete: true,
    employedWholeMonth: true,
    statuses,
  });

describe("isFullMonthPresent", () => {
  it("qualifies when every working day is PRESENT", () => {
    expect(ok(["PRESENT", "PRESENT", "PRESENT"])).toBe(true);
  });

  it("ignores HOLIDAY and WEEKLY_OFF days", () => {
    expect(
      ok(["PRESENT", "HOLIDAY", "WEEKLY_OFF", "PRESENT", "WEEKLY_OFF"]),
    ).toBe(true);
  });

  it.each<EffectiveStatus>(["ABSENT", "HALF_DAY", "ON_LEAVE", "NOT_MARKED"])(
    "does not qualify when one working day is %s",
    (status) => {
      expect(ok(["PRESENT", status, "PRESENT"])).toBe(false);
    },
  );

  it("does not qualify a month with no working day", () => {
    expect(ok(["WEEKLY_OFF", "HOLIDAY"])).toBe(false);
    expect(ok([])).toBe(false);
  });

  it("never qualifies an incomplete month, even when every counted day is PRESENT", () => {
    expect(
      isFullMonthPresent({
        monthComplete: false,
        employedWholeMonth: true,
        statuses: ["PRESENT", "PRESENT"],
      }),
    ).toBe(false);
  });

  it("never qualifies an employee who was not employed the whole month", () => {
    expect(
      isFullMonthPresent({
        monthComplete: true,
        employedWholeMonth: false,
        statuses: ["PRESENT", "PRESENT"],
      }),
    ).toBe(false);
  });

  it("is consistent with the shared calculation service: a weekly off with no punches does not disqualify", () => {
    const calc = new AttendanceCalculationService();
    const asOf = new Date("2026-10-31T12:00:00+05:30");
    const day = (
      storedStatus: "PRESENT" | "ABSENT" | null,
      calendar: { holiday?: boolean; weeklyOff?: boolean; onLeave?: boolean },
      sessions: { checkInAt: Date; checkOutAt: Date | null }[] = [],
    ) =>
      calc.calculate({
        storedStatus,
        sessions,
        targetMinutes: 480,
        calendar: {
          holiday: false,
          weeklyOff: false,
          onLeave: false,
          ...calendar,
        },
        asOf,
      }).status;

    const statuses = [
      day("PRESENT", {}, [
        {
          checkInAt: new Date("2026-10-01T10:00:00+05:30"),
          checkOutAt: new Date("2026-10-01T18:30:00+05:30"),
        },
      ]),
      day(null, { weeklyOff: true }),
      day(null, { holiday: true }),
      day("PRESENT", {}),
    ];
    expect(statuses).toEqual(["PRESENT", "WEEKLY_OFF", "HOLIDAY", "PRESENT"]);
    expect(ok(statuses)).toBe(true);
    expect(ok([...statuses, day("ABSENT", {})])).toBe(false);
    expect(ok([...statuses, day(null, { onLeave: true })])).toBe(false);
  });
});

describe("employedWholeMonthOf", () => {
  const first = "2026-06-01";
  const last = "2026-06-30";

  it("is true for an employee who joined before the month and has not left", () => {
    expect(employedWholeMonthOf("2025-01-01", null, first, last)).toBe(true);
  });

  it("is true when joined on the first day and exits on the last day", () => {
    expect(employedWholeMonthOf(first, last, first, last)).toBe(true);
  });

  it("is false for a mid-month joiner", () => {
    expect(employedWholeMonthOf("2026-06-15", null, first, last)).toBe(false);
  });

  it("is false for an employee who exits before the last day", () => {
    expect(employedWholeMonthOf("2025-01-01", "2026-06-20", first, last)).toBe(
      false,
    );
  });

  it("is false for an employee who joins after the month", () => {
    expect(employedWholeMonthOf("2026-07-01", null, first, last)).toBe(false);
  });
});
