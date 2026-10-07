import { AttendanceCalculationService } from "../services/attendance-calculation.service.js";
import type {
  DayContext,
  EmployeeRef,
} from "../services/attendance-day-resolver.js";
import {
  AttendanceDayViewService,
  type DayView,
  type StoredDay,
} from "../services/attendance-day-view.service.js";
import { missingPunchOf, overtimeDaysOf } from "./attendance-report-rules.js";

const EMP: EmployeeRef = { id: 1, teamId: 9, workLocationId: null };
const TODAY = "2026-10-05";
const PAST = "2026-10-01";
const SUNDAY = "2026-10-04";
const ctl = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm}:00+05:30`);

const SHIFT_8H: DayContext["shiftAssignments"] = [
  {
    employeeId: null,
    teamId: 9,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    workingMinutes: 480,
  },
];

function viewOf(
  day: Partial<StoredDay> & { attendanceDate: string },
  ctx: Partial<DayContext> = {},
  asOf = new Date(`${TODAY}T23:59:00+05:30`),
): DayView {
  const service = new AttendanceDayViewService(
    new AttendanceCalculationService(),
  );
  const stored: StoredDay = {
    recordId: 1,
    employeeId: EMP.id,
    storedStatus: null,
    sessions: [],
    ...day,
  };
  const context: DayContext = {
    holidays: [],
    weeklyOffRules: [],
    approvedLeaves: [],
    shiftAssignments: SHIFT_8H,
    ...ctx,
  };
  const [view] = service.build(
    context,
    new Map([[EMP.id, EMP]]),
    [stored],
    asOf,
  );
  return view!;
}

const closed = (id: number, inAt: string, outAt: string) => ({
  id,
  checkInAt: ctl(PAST, inAt),
  checkOutAt: ctl(PAST, outAt),
  source: "SELF",
});

describe("missing punch definition", () => {
  it("flags an open session on a past day as a missing checkout", () => {
    const v = viewOf({
      attendanceDate: PAST,
      sessions: [
        {
          id: 1,
          checkInAt: ctl(PAST, "10:00"),
          checkOutAt: null,
          source: "SELF",
        },
      ],
    });
    expect(missingPunchOf(v, TODAY)).toBe("MISSING_CHECKOUT");
  });

  it("does not flag an open session that belongs to today (still working)", () => {
    const v = viewOf({
      attendanceDate: TODAY,
      sessions: [
        {
          id: 1,
          checkInAt: ctl(TODAY, "10:00"),
          checkOutAt: null,
          source: "SELF",
        },
      ],
    });
    expect(missingPunchOf(v, TODAY)).toBeNull();
  });

  it("does not flag a normal, complete day", () => {
    expect(
      missingPunchOf(
        viewOf({
          attendanceDate: PAST,
          sessions: [closed(1, "10:00", "18:30")],
        }),
        TODAY,
      ),
    ).toBeNull();
  });

  it("flags stored PRESENT with no punches as a missing check-in", () => {
    const v = viewOf({ attendanceDate: PAST, storedStatus: "PRESENT" });
    expect(missingPunchOf(v, TODAY)).toBe("MISSING_CHECK_IN");
  });

  it("does not flag an unmarked working day (never labelled a missing punch)", () => {
    expect(missingPunchOf(viewOf({ attendanceDate: PAST }), TODAY)).toBeNull();
  });

  it("holiday exclusion: a holiday with no punches is not a missing punch", () => {
    const v = viewOf(
      { attendanceDate: PAST, storedStatus: "PRESENT" },
      {
        holidays: [{ date: PAST, workLocationId: null }],
      },
    );
    expect(missingPunchOf(v, TODAY)).toBeNull();
  });

  it("weekly-off exclusion: a weekly off with stored PRESENT and no punches is not flagged", () => {
    const v = viewOf(
      { attendanceDate: SUNDAY, storedStatus: "PRESENT" },
      {
        weeklyOffRules: [
          {
            daysOfWeek: [7],
            teamId: null,
            workLocationId: null,
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
          },
        ],
      },
    );
    expect(missingPunchOf(v, TODAY)).toBeNull();
  });

  it("leave exclusion: an approved leave day with stored PRESENT and no punches is not flagged", () => {
    const v = viewOf(
      { attendanceDate: PAST, storedStatus: "PRESENT" },
      {
        approvedLeaves: [
          { employeeId: EMP.id, startDate: PAST, endDate: PAST },
        ],
      },
    );
    expect(missingPunchOf(v, TODAY)).toBeNull();
  });

  it("explicit ABSENT and HALF_DAY with no punches are not missing punches", () => {
    expect(
      missingPunchOf(
        viewOf({ attendanceDate: PAST, storedStatus: "ABSENT" }),
        TODAY,
      ),
    ).toBeNull();
    expect(
      missingPunchOf(
        viewOf({ attendanceDate: PAST, storedStatus: "HALF_DAY" }),
        TODAY,
      ),
    ).toBeNull();
  });

  it("a future date is never flagged", () => {
    const v = viewOf({ attendanceDate: "2026-10-09", storedStatus: "PRESENT" });
    expect(missingPunchOf(v, TODAY)).toBeNull();
  });
});

describe("overtime rows (the calculation is the only formula)", () => {
  it("normal day with overtime produces an overtime row", () => {
    const v = viewOf({
      attendanceDate: PAST,
      sessions: [closed(1, "09:00", "18:30")],
    });
    // 09:00–18:30 is 570 minutes; against the 480-minute target that is 90.
    expect(v.overtimeMinutes).toBe(90);
    expect(overtimeDaysOf([v])).toEqual([v]);
  });

  it("zero overtime: a day worked exactly to target produces no row", () => {
    const v = viewOf({
      attendanceDate: PAST,
      sessions: [closed(1, "10:00", "18:00")],
    });
    expect(overtimeDaysOf([v])).toEqual([]);
  });

  it("Sunday / weekly-off: overtime is zero by the calculation and produces no row", () => {
    const v = viewOf(
      { attendanceDate: SUNDAY, sessions: [closed(1, "09:00", "20:00")] },
      {
        weeklyOffRules: [
          {
            daysOfWeek: [7],
            teamId: null,
            workLocationId: null,
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
          },
        ],
      },
    );
    expect(v.overtimeMinutes).toBe(0);
    expect(overtimeDaysOf([v])).toEqual([]);
  });

  it("holiday: overtime is zero and produces no row", () => {
    const v = viewOf(
      { attendanceDate: PAST, sessions: [closed(1, "09:00", "20:00")] },
      {
        holidays: [{ date: PAST, workLocationId: null }],
      },
    );
    expect(overtimeDaysOf([v])).toEqual([]);
  });

  it("leave: overtime is zero and produces no row", () => {
    const v = viewOf(
      { attendanceDate: PAST, sessions: [closed(1, "09:00", "20:00")] },
      {
        approvedLeaves: [
          { employeeId: EMP.id, startDate: PAST, endDate: PAST },
        ],
      },
    );
    expect(overtimeDaysOf([v])).toEqual([]);
  });

  it("half day: overtime is zero even with long punches", () => {
    const v = viewOf({
      attendanceDate: PAST,
      storedStatus: "HALF_DAY",
      sessions: [closed(1, "09:00", "20:00")],
    });
    expect(overtimeDaysOf([v])).toEqual([]);
  });

  it("stored ABSENT: overtime is zero even with punches", () => {
    const v = viewOf({
      attendanceDate: PAST,
      storedStatus: "ABSENT",
      sessions: [closed(1, "09:00", "20:00")],
    });
    expect(overtimeDaysOf([v])).toEqual([]);
  });
});
