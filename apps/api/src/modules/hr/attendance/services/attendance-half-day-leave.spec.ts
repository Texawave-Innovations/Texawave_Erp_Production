import {
  AttendanceCalculationService,
  type CalendarFlags,
} from "./attendance-calculation.service.js";
import {
  EMPTY_DAY_CONTEXT,
  resolveCalendar,
  type DayContext,
} from "./attendance-day-resolver.js";

const employee = { id: 7, teamId: 1, workLocationId: null };
const DAY = "2027-01-06";
const leave = (
  dayPortion: "FULL" | "FIRST_HALF" | "SECOND_HALF",
  startDate = DAY,
  endDate = DAY,
) => ({ employeeId: 7, startDate, endDate, dayPortion });
const ctx = (approvedLeaves: DayContext["approvedLeaves"]): DayContext => ({
  ...EMPTY_DAY_CONTEXT,
  approvedLeaves,
});

const NO_CALENDAR: CalendarFlags = {
  holiday: false,
  weeklyOff: false,
  onLeave: false,
};

describe("approved leave portions in the shared day resolver", () => {
  it("a full-day leave puts the whole day on leave", () => {
    const flags = resolveCalendar(ctx([leave("FULL")]), employee, DAY);
    expect(flags).toMatchObject({ onLeave: true, halfDayLeave: false });
  });

  it("one half is a half-day leave, not a full day on leave", () => {
    const flags = resolveCalendar(ctx([leave("FIRST_HALF")]), employee, DAY);
    expect(flags).toMatchObject({ onLeave: false, halfDayLeave: true });
  });

  it("both halves of the same date make a full day on leave", () => {
    const flags = resolveCalendar(
      ctx([leave("FIRST_HALF"), leave("SECOND_HALF")]),
      employee,
      DAY,
    );
    expect(flags).toMatchObject({ onLeave: true, halfDayLeave: false });
  });

  it("a half-day does not leak onto the neighbouring date", () => {
    const flags = resolveCalendar(
      ctx([leave("FIRST_HALF")]),
      employee,
      "2027-01-07",
    );
    expect(flags).toMatchObject({ onLeave: false, halfDayLeave: false });
  });

  it("another employee's half-day is ignored", () => {
    const flags = resolveCalendar(
      ctx([{ ...leave("FIRST_HALF"), employeeId: 99 }]),
      employee,
      DAY,
    );
    expect(flags).toMatchObject({ onLeave: false, halfDayLeave: false });
  });
});

describe("half-day attendance status", () => {
  const calc = new AttendanceCalculationService();
  const run = (calendar: CalendarFlags) =>
    calc.calculate({
      storedStatus: null,
      sessions: [],
      targetMinutes: 8 * 60,
      calendar,
      asOf: new Date("2027-01-06T23:59:00+05:30"),
    });

  it("a half-day leave with no punches is HALF_DAY with a half-target allocation", () => {
    expect(run({ ...NO_CALENDAR, halfDayLeave: true })).toMatchObject({
      status: "HALF_DAY",
      workedMinutes: 240,
      shortfallMinutes: 240,
    });
  });

  it("a holiday keeps precedence over a half-day leave", () => {
    expect(
      run({ ...NO_CALENDAR, holiday: true, halfDayLeave: true }).status,
    ).toBe("HOLIDAY");
  });

  it("a weekly off keeps precedence over a half-day leave", () => {
    expect(
      run({ ...NO_CALENDAR, weeklyOff: true, halfDayLeave: true }).status,
    ).toBe("WEEKLY_OFF");
  });

  it("a full-day leave still resolves to ON_LEAVE", () => {
    expect(run({ ...NO_CALENDAR, onLeave: true }).status).toBe("ON_LEAVE");
  });
});
