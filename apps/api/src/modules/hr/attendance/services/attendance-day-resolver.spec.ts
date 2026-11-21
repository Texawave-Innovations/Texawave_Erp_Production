import {
  EMPTY_DAY_CONTEXT,
  resolveBaseTargetMinutes,
  resolveCalendar,
  resolvePermissions,
  resolveTargetMinutes,
  type DayContext,
  type EmployeeRef,
} from "./attendance-day-resolver.js";

const EMP: EmployeeRef = { id: 10, teamId: 5, workLocationId: 2 };
const SUNDAY = "2026-10-11";
const MONDAY = "2026-10-05";

function ctx(overrides: Partial<DayContext>): DayContext {
  return { ...EMPTY_DAY_CONTEXT, ...overrides };
}

const rule = (over: Partial<DayContext["weeklyOffRules"][number]>) => ({
  daysOfWeek: [7],
  teamId: null,
  workLocationId: null,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  ...over,
});

describe("resolveCalendar: holidays", () => {
  it("an organization-wide holiday applies to every employee", () => {
    const c = ctx({ holidays: [{ date: MONDAY, workLocationId: null }] });
    expect(resolveCalendar(c, EMP, MONDAY).holiday).toBe(true);
  });

  it("a location holiday applies only to that location", () => {
    const c = ctx({ holidays: [{ date: MONDAY, workLocationId: 99 }] });
    expect(resolveCalendar(c, EMP, MONDAY).holiday).toBe(false);
    expect(
      resolveCalendar(c, { ...EMP, workLocationId: 99 }, MONDAY).holiday,
    ).toBe(true);
  });

  it("a holiday on another date does not apply", () => {
    const c = ctx({ holidays: [{ date: "2026-12-25", workLocationId: null }] });
    expect(resolveCalendar(c, EMP, MONDAY).holiday).toBe(false);
  });
});

describe("resolveCalendar: weekly off, most specific rule wins", () => {
  it("no rules at all: nothing is assumed off, Sunday included", () => {
    expect(resolveCalendar(EMPTY_DAY_CONTEXT, EMP, SUNDAY).weeklyOff).toBe(
      false,
    );
  });

  it("an organization rule covers the weekday it lists", () => {
    expect(
      resolveCalendar(ctx({ weeklyOffRules: [rule({})] }), EMP, SUNDAY)
        .weeklyOff,
    ).toBe(true);
    expect(
      resolveCalendar(ctx({ weeklyOffRules: [rule({})] }), EMP, MONDAY)
        .weeklyOff,
    ).toBe(false);
  });

  it("a team rule overrides an organization rule, even on a day the org treats as off", () => {
    const c = ctx({
      weeklyOffRules: [rule({}), rule({ daysOfWeek: [6], teamId: EMP.teamId })],
    });
    expect(resolveCalendar(c, EMP, SUNDAY).weeklyOff).toBe(false);
  });

  it("a location rule overrides an organization rule", () => {
    const c = ctx({
      weeklyOffRules: [
        rule({}),
        rule({ daysOfWeek: [1], workLocationId: EMP.workLocationId }),
      ],
    });
    expect(resolveCalendar(c, EMP, MONDAY).weeklyOff).toBe(true);
    expect(resolveCalendar(c, EMP, SUNDAY).weeklyOff).toBe(false);
  });

  it("a team rule for another team does not apply", () => {
    const c = ctx({ weeklyOffRules: [rule({ teamId: 999 })] });
    expect(resolveCalendar(c, EMP, SUNDAY).weeklyOff).toBe(false);
  });

  it("a rule outside its effective range does not apply", () => {
    const c = ctx({ weeklyOffRules: [rule({ effectiveFrom: "2026-11-01" })] });
    expect(resolveCalendar(c, EMP, SUNDAY).weeklyOff).toBe(false);
  });

  it("an ended rule does not apply after its effective_to date", () => {
    const c = ctx({ weeklyOffRules: [rule({ effectiveTo: "2026-10-04" })] });
    expect(resolveCalendar(c, EMP, SUNDAY).weeklyOff).toBe(false);
  });
});

describe("resolveCalendar: leave", () => {
  it("an approved leave covering the day makes it an on-leave day", () => {
    const c = ctx({
      approvedLeaves: [
        { employeeId: EMP.id, startDate: "2026-10-04", endDate: "2026-10-06" },
      ],
    });
    expect(resolveCalendar(c, EMP, MONDAY).onLeave).toBe(true);
  });

  it("leave of another employee does not apply", () => {
    const c = ctx({
      approvedLeaves: [{ employeeId: 999, startDate: MONDAY, endDate: MONDAY }],
    });
    expect(resolveCalendar(c, EMP, MONDAY).onLeave).toBe(false);
  });
});

describe("resolveTargetMinutes", () => {
  const assignment = (
    over: Partial<DayContext["shiftAssignments"][number]>,
  ) => ({
    employeeId: null,
    teamId: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    workingMinutes: 480,
    ...over,
  });

  it("no assignment: target is null", () => {
    expect(resolveTargetMinutes(EMPTY_DAY_CONTEXT, EMP, MONDAY)).toBeNull();
  });

  it("a team assignment provides the target", () => {
    const c = ctx({
      shiftAssignments: [
        assignment({ teamId: EMP.teamId, workingMinutes: 480 }),
      ],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(480);
  });

  it("an employee assignment overrides the team assignment", () => {
    const c = ctx({
      shiftAssignments: [
        assignment({ teamId: EMP.teamId, workingMinutes: 480 }),
        assignment({ employeeId: EMP.id, workingMinutes: 240 }),
      ],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(240);
  });

  it("an assignment that does not cover the date is ignored", () => {
    const c = ctx({
      shiftAssignments: [
        assignment({ employeeId: EMP.id, effectiveFrom: "2026-11-01" }),
      ],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBeNull();
  });
});

describe("approved work permissions reduce the target", () => {
  const shift = {
    employeeId: null,
    teamId: EMP.teamId,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    workingMinutes: 480,
  };
  const permission = (over: {
    employeeId?: number;
    date?: string;
    fromTime?: string;
    toTime?: string;
    minutes?: number;
  }) => ({
    employeeId: EMP.id,
    date: MONDAY,
    fromTime: "10:00",
    toTime: "12:00",
    minutes: 120,
    ...over,
  });

  it("an 8h shift with a 2h approved permission has a 6h target", () => {
    const c = ctx({
      shiftAssignments: [shift],
      approvedPermissions: [permission({})],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(360);
    expect(resolveBaseTargetMinutes(c, EMP, MONDAY)).toBe(480);
  });

  it("several permissions on the day are all excused", () => {
    const c = ctx({
      shiftAssignments: [shift],
      approvedPermissions: [
        permission({ minutes: 60, fromTime: "10:00", toTime: "11:00" }),
        permission({ minutes: 30, fromTime: "15:00", toTime: "15:30" }),
      ],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(390);
  });

  it("never goes below zero", () => {
    const c = ctx({
      shiftAssignments: [{ ...shift, workingMinutes: 60 }],
      approvedPermissions: [permission({ minutes: 120 })],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(0);
  });

  it("another employee's, or another day's, permission is ignored", () => {
    const c = ctx({
      shiftAssignments: [shift],
      approvedPermissions: [
        permission({ employeeId: 999 }),
        permission({ date: "2026-10-06" }),
      ],
    });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(480);
    expect(resolvePermissions(c, EMP, MONDAY)).toEqual([]);
  });

  it("with no shift there is no target to reduce", () => {
    const c = ctx({ approvedPermissions: [permission({})] });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBeNull();
    expect(resolvePermissions(c, EMP, MONDAY)).toEqual([
      { fromTime: "10:00", toTime: "12:00", minutes: 120 },
    ]);
  });

  it("a context without the field behaves as before", () => {
    const c = ctx({ shiftAssignments: [shift] });
    expect(resolveTargetMinutes(c, EMP, MONDAY)).toBe(480);
  });
});
