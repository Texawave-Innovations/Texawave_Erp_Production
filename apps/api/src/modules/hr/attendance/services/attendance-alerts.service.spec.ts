import { describe, expect, it } from "vitest";
import {
  alertNotifications,
  planAttendanceAlerts,
  type AlertDay,
  type AlertEmployee,
} from "./attendance-alerts.service.js";
import type { DayContext } from "./attendance-day-resolver.js";

// 2026-10-07 is a Wednesday.
const TODAY = "2026-10-07";
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);

const emp = (over: Partial<AlertEmployee> = {}): AlertEmployee => ({
  id: 1,
  teamId: 10,
  workLocationId: null,
  employeeCode: "E1",
  fullName: "Asha",
  userId: 100,
  managerUserId: 200,
  ...over,
});

const ctx = (over: Partial<DayContext> = {}): DayContext => ({
  holidays: [],
  weeklyOffRules: [],
  approvedLeaves: [],
  shiftAssignments: [
    {
      employeeId: null,
      teamId: 10,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      workingMinutes: 480,
      startTime: "10:00",
      endTime: "18:30",
      isOvernight: false,
    },
  ],
  ...over,
});

const day = (
  date: string,
  sessions: AlertDay["sessions"],
  status: string | null = null,
): AlertDay => ({
  employeeId: 1,
  attendanceDate: date,
  storedStatus: status,
  sessions,
});

describe("planAttendanceAlerts — missing check-in", () => {
  it("is not due before shift start + 30 min", () => {
    expect(
      planAttendanceAlerts([emp()], ctx(), [], at(TODAY, "10:29")),
    ).toEqual([]);
  });

  it("is due from shift start + 30 min with no punch", () => {
    const out = planAttendanceAlerts([emp()], ctx(), [], at(TODAY, "10:30"));
    expect(out).toEqual([
      { kind: "missing_check_in", employee: emp(), date: TODAY },
    ]);
  });

  it("stops once the shift has ended (no stale alert in the evening)", () => {
    expect(
      planAttendanceAlerts([emp()], ctx(), [], at(TODAY, "18:30")),
    ).toEqual([]);
  });

  it("is not raised once the employee has punched or HR has marked the day", () => {
    const punched = [
      day(TODAY, [{ checkInAt: at(TODAY, "10:40"), checkOutAt: null }]),
    ];
    expect(
      planAttendanceAlerts([emp()], ctx(), punched, at(TODAY, "11:00")),
    ).toEqual([]);
    const marked = [day(TODAY, [], "ABSENT")];
    expect(
      planAttendanceAlerts([emp()], ctx(), marked, at(TODAY, "11:00")),
    ).toEqual([]);
  });

  it("is not raised on a holiday, weekly off, leave or half-day leave", () => {
    const noon = at(TODAY, "12:00");
    expect(
      planAttendanceAlerts(
        [emp()],
        ctx({ holidays: [{ date: TODAY, workLocationId: null }] }),
        [],
        noon,
      ),
    ).toEqual([]);
    expect(
      planAttendanceAlerts(
        [emp()],
        ctx({
          weeklyOffRules: [
            {
              daysOfWeek: [3],
              teamId: null,
              workLocationId: null,
              effectiveFrom: "2026-01-01",
              effectiveTo: null,
            },
          ],
        }),
        [],
        noon,
      ),
    ).toEqual([]);
    expect(
      planAttendanceAlerts(
        [emp()],
        ctx({
          approvedLeaves: [{ employeeId: 1, startDate: TODAY, endDate: TODAY }],
        }),
        [],
        noon,
      ),
    ).toEqual([]);
    expect(
      planAttendanceAlerts(
        [emp()],
        ctx({
          approvedLeaves: [
            {
              employeeId: 1,
              startDate: TODAY,
              endDate: TODAY,
              dayPortion: "FIRST_HALF",
            },
          ],
        }),
        [],
        noon,
      ),
    ).toEqual([]);
  });

  it("is never raised without a shift (no invented due time)", () => {
    expect(
      planAttendanceAlerts(
        [emp()],
        ctx({ shiftAssignments: [] }),
        [],
        at(TODAY, "12:00"),
      ),
    ).toEqual([]);
  });
});

describe("planAttendanceAlerts — missing check-out", () => {
  const open = [
    day(TODAY, [{ checkInAt: at(TODAY, "13:00"), checkOutAt: null }]),
  ];

  it("is due from shift end + 120 min while the session is open", () => {
    expect(
      planAttendanceAlerts([emp()], ctx(), open, at(TODAY, "20:29")),
    ).toEqual([]);
    expect(
      planAttendanceAlerts([emp()], ctx(), open, at(TODAY, "20:30")),
    ).toEqual([{ kind: "missing_check_out", employee: emp(), date: TODAY }]);
  });

  it("is not raised for a closed session", () => {
    const closed = [
      day(TODAY, [
        { checkInAt: at(TODAY, "10:00"), checkOutAt: at(TODAY, "18:00") },
      ]),
    ];
    expect(
      planAttendanceAlerts([emp()], ctx(), closed, at(TODAY, "21:00")),
    ).toEqual([]);
  });

  it("uses the next day's end for an overnight shift", () => {
    const night = ctx({
      shiftAssignments: [
        {
          employeeId: 1,
          teamId: null,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          workingMinutes: 480,
          startTime: "22:00",
          endTime: "06:00",
          isOvernight: true,
        },
      ],
    });
    const yesterday = "2026-10-06";
    const openNight = [
      day(yesterday, [{ checkInAt: at(yesterday, "22:00"), checkOutAt: null }]),
    ];
    expect(
      planAttendanceAlerts([emp()], night, openNight, at(TODAY, "07:59")),
    ).toEqual([]);
    expect(
      planAttendanceAlerts([emp()], night, openNight, at(TODAY, "08:00")),
    ).toEqual([
      { kind: "missing_check_out", employee: emp(), date: yesterday },
    ]);
  });
});

describe("alertNotifications", () => {
  it("tells the employee and the manager, with one dedup key per kind/employee/date", () => {
    const items = alertNotifications({
      kind: "missing_check_in",
      employee: emp(),
      date: TODAY,
    });
    expect(items.map((i) => i.userId)).toEqual([100, 200]);
    expect(new Set(items.map((i) => i.dedupKey))).toEqual(
      new Set([`attendance.missing_check_in:1:${TODAY}`]),
    );
    expect(items[0]?.link).toBe("/self-service/attendance");
  });

  it("skips a missing login and never tells the same user twice", () => {
    expect(
      alertNotifications({
        kind: "missing_check_out",
        employee: emp({ userId: null }),
        date: TODAY,
      }).map((i) => i.userId),
    ).toEqual([200]);
    expect(
      alertNotifications({
        kind: "missing_check_out",
        employee: emp({ managerUserId: 100 }),
        date: TODAY,
      }).map((i) => i.userId),
    ).toEqual([100]);
  });
});
