import type { AttendanceDayInfo } from "../hr/attendance/services/attendance-lookup.service.js";
import {
  buildEmployeeMonth,
  monthBounds,
  type MonthTimesheetRow,
} from "./timesheet-month.js";

const info = (over: Partial<AttendanceDayInfo>): AttendanceDayInfo => ({
  date: "2026-08-03",
  status: "PRESENT",
  workedMinutes: 480,
  overtimeMinutes: 0,
  targetMinutes: 480,
  baseTargetMinutes: 480,
  hasOpenSession: false,
  permissions: [],
  permissionMinutes: 0,
  checkInAt: null,
  checkOutAt: null,
  ...over,
});

const row = (over: Partial<MonthTimesheetRow>): MonthTimesheetRow => ({
  workDate: "2026-08-03",
  status: "DRAFT",
  category: "TASK",
  durationMinutes: null,
  endedAt: null,
  sessions: [],
  ...over,
});

describe("monthBounds", () => {
  it("covers a 31-day, a 30-day and a leap-year month", () => {
    expect(monthBounds("2026-08")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(monthBounds("2026-11").to).toBe("2026-11-30");
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
    expect(monthBounds("2026-02").to).toBe("2026-02-28");
  });
});

describe("buildEmployeeMonth", () => {
  it("has one line per calendar day, in order, with the weekday", () => {
    const month = buildEmployeeMonth({
      month: "2026-08",
      attendance: new Map(),
      rows: [],
    });
    expect(month.days).toHaveLength(31);
    expect(month.days[0]).toMatchObject({ date: "2026-08-01", weekday: 6 });
    expect(month.days[1]).toMatchObject({ date: "2026-08-02", weekday: 7 });
    expect(month.days[30]!.date).toBe("2026-08-31");
  });

  it("a day HR has nothing for is null, never an absence", () => {
    const month = buildEmployeeMonth({
      month: "2026-08",
      attendance: new Map(),
      rows: [],
    });
    expect(month.days[0]!.attendanceStatus).toBeNull();
    expect(month.summary.absentDays).toBe(0);
  });

  it("counts present (half days included), absent, leave and holiday days", () => {
    const attendance = new Map<string, AttendanceDayInfo>([
      ["2026-08-03", info({ status: "PRESENT" })],
      ["2026-08-04", info({ status: "HALF_DAY" })],
      ["2026-08-05", info({ status: "ABSENT" })],
      ["2026-08-06", info({ status: "ON_LEAVE" })],
      ["2026-08-07", info({ status: "HOLIDAY" })],
      ["2026-08-08", info({ status: "WEEKLY_OFF" })],
    ]);
    const { summary } = buildEmployeeMonth({
      month: "2026-08",
      attendance,
      rows: [],
    });
    expect(summary).toMatchObject({
      presentDays: 2,
      absentDays: 1,
      leaveDays: 1,
      holidayDays: 1,
    });
  });

  it("carries the punches, the reduced target and the approved permission", () => {
    const attendance = new Map([
      [
        "2026-08-03",
        info({
          targetMinutes: 360,
          baseTargetMinutes: 480,
          permissions: [{ fromTime: "10:00", toTime: "12:00", minutes: 120 }],
          permissionMinutes: 120,
          checkInAt: new Date("2026-08-03T04:21:10Z"),
          checkOutAt: new Date("2026-08-03T13:13:46Z"),
        }),
      ],
    ]);
    const month = buildEmployeeMonth({
      month: "2026-08",
      attendance,
      rows: [],
    });
    const day = month.days[2]!;
    expect(day).toMatchObject({
      date: "2026-08-03",
      targetMinutes: 360,
      baseTargetMinutes: 480,
      permissionMinutes: 120,
      checkInAt: "2026-08-03T04:21:10.000Z",
      checkOutAt: "2026-08-03T13:13:46.000Z",
    });
    expect(day.permissions).toEqual([
      { fromTime: "10:00", toTime: "12:00", minutes: 120 },
    ]);
    expect(month.summary.permissionMinutes).toBe(120);
  });

  it("an open session has a check-in and no check-out", () => {
    const attendance = new Map([
      [
        "2026-08-03",
        info({
          hasOpenSession: true,
          checkInAt: new Date("2026-08-03T04:30:00Z"),
          checkOutAt: null,
        }),
      ],
    ]);
    const day = buildEmployeeMonth({ month: "2026-08", attendance, rows: [] })
      .days[2]!;
    expect(day.checkInAt).not.toBeNull();
    expect(day.checkOutAt).toBeNull();
  });

  it("logged time counts closed work only, drafts included, with the review state", () => {
    const rows = [
      row({
        sessions: [
          { endedAt: new Date(), durationMinutes: 90 },
          { endedAt: null, durationMinutes: 40 },
        ],
      }),
      row({
        category: "MEETING",
        durationMinutes: 30,
        endedAt: new Date(),
      }),
      row({
        workDate: "2026-08-04",
        status: "SUBMITTED",
        sessions: [{ endedAt: new Date(), durationMinutes: 60 }],
      }),
    ];
    const month = buildEmployeeMonth({
      month: "2026-08",
      attendance: new Map(),
      rows,
    });
    expect(month.days[2]).toMatchObject({
      loggedMinutes: 120,
      rowCount: 2,
      reviewStatus: "DRAFT",
    });
    expect(month.days[3]).toMatchObject({
      loggedMinutes: 60,
      reviewStatus: "SUBMITTED",
    });
    expect(month.days[4]).toMatchObject({
      loggedMinutes: 0,
      rowCount: 0,
      reviewStatus: null,
    });
    expect(month.summary.loggedMinutes).toBe(180);
  });
});
