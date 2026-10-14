import {
  AttendanceCalculationService,
  assertSessionsConsistent,
  isoWeekdayOf,
  istDateOf,
  SessionOrderError,
  workedMinutesOf,
  type AttendanceDayInput,
  type CalendarFlags,
} from "./attendance-calculation.service.js";

const NO_CALENDAR: CalendarFlags = {
  holiday: false,
  weeklyOff: false,
  onLeave: false,
};
const at = (hhmm: string, day = "2026-10-05") =>
  new Date(`${day}T${hhmm}:00+05:30`);
const session = (inHhmm: string, outHhmm: string | null) => ({
  checkInAt: at(inHhmm),
  checkOutAt: outHhmm === null ? null : at(outHhmm),
});

function run(overrides: Partial<AttendanceDayInput>) {
  const service = new AttendanceCalculationService();
  return service.calculate({
    storedStatus: null,
    sessions: [],
    targetMinutes: 8 * 60,
    calendar: NO_CALENDAR,
    asOf: at("23:59"),
    ...overrides,
  });
}

describe("AttendanceCalculationService", () => {
  describe("normal working day", () => {
    it("full day: worked equals target, no overtime or shortfall", () => {
      const r = run({ sessions: [session("10:00", "18:00")] });
      expect(r).toMatchObject({
        status: "PRESENT",
        workedMinutes: 480,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });

    it("partial day: shortfall is the difference, worked is actual", () => {
      const r = run({ sessions: [session("10:00", "15:00")] });
      expect(r).toMatchObject({
        workedMinutes: 300,
        overtimeMinutes: 0,
        shortfallMinutes: 180,
      });
    });

    it("overtime: worked is capped at target, the excess is overtime", () => {
      const r = run({ sessions: [session("10:00", "19:30")] });
      expect(r).toMatchObject({
        workedMinutes: 480,
        overtimeMinutes: 90,
        shortfallMinutes: 0,
      });
    });

    it("multiple sessions are summed; the gap between them is a break and is not counted", () => {
      const r = run({
        sessions: [session("10:00", "13:00"), session("14:00", "19:00")],
      });
      expect(r).toMatchObject({
        workedMinutes: 480,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });

    it("lunch is not deducted automatically: a session gap is simply not worked time", () => {
      const r = run({
        sessions: [session("10:00", "12:00"), session("13:00", "16:00")],
      });
      expect(r.workedMinutes).toBe(300);
    });

    it("no shift target: punched time is reported with no overtime or shortfall", () => {
      const r = run({
        sessions: [session("10:00", "13:00")],
        targetMinutes: null,
      });
      expect(r).toMatchObject({
        status: "PRESENT",
        workedMinutes: 180,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });
  });

  describe("open session", () => {
    it("counts time up to asOf and flags the open session", () => {
      const r = run({
        sessions: [session("10:00", null)],
        asOf: at("12:30"),
      });
      expect(r).toMatchObject({
        hasOpenSession: true,
        workedMinutes: 150,
        shortfallMinutes: 330,
      });
    });

    it("a closed day reports no open session", () => {
      expect(
        run({ sessions: [session("10:00", "11:00")] }).hasOpenSession,
      ).toBe(false);
    });
  });

  describe("stored status", () => {
    it("explicit ABSENT means zero worked hours, even with punches", () => {
      const r = run({
        storedStatus: "ABSENT",
        sessions: [session("10:00", "18:00")],
      });
      expect(r).toMatchObject({
        status: "ABSENT",
        workedMinutes: 0,
        overtimeMinutes: 0,
        shortfallMinutes: 480,
      });
    });

    it("HALF_DAY: worked is target / 2, no overtime", () => {
      const r = run({
        storedStatus: "HALF_DAY",
        sessions: [session("10:00", "20:00")],
      });
      expect(r).toMatchObject({
        status: "HALF_DAY",
        workedMinutes: 240,
        overtimeMinutes: 0,
        shortfallMinutes: 240,
      });
    });

    it("HALF_DAY with no shift target falls back to punched time", () => {
      const r = run({
        storedStatus: "HALF_DAY",
        sessions: [session("10:00", "12:00")],
        targetMinutes: null,
      });
      expect(r.workedMinutes).toBe(120);
    });

    it("stored PRESENT with no punches stands as PRESENT with zero worked time", () => {
      expect(run({ storedStatus: "PRESENT" })).toMatchObject({
        status: "PRESENT",
        workedMinutes: 0,
        shortfallMinutes: 480,
      });
    });

    it("an unmarked day with no punches is NOT_MARKED and is never stored as absent", () => {
      expect(run({})).toMatchObject({
        status: "NOT_MARKED",
        workedMinutes: 0,
        shortfallMinutes: 480,
      });
    });
  });

  describe("calendar precedence: Holiday > Weekly Off > Leave > stored status", () => {
    const punched = [session("10:00", "13:00")];

    it("Holiday beats Weekly Off and Leave", () => {
      const r = run({
        calendar: { holiday: true, weeklyOff: true, onLeave: true },
        sessions: punched,
        storedStatus: "ABSENT",
      });
      expect(r.status).toBe("HOLIDAY");
    });

    it("Weekly Off beats Leave", () => {
      expect(
        run({
          calendar: { holiday: false, weeklyOff: true, onLeave: true },
          sessions: punched,
        }).status,
      ).toBe("WEEKLY_OFF");
    });

    it("Leave beats a stored status", () => {
      expect(
        run({
          calendar: { holiday: false, weeklyOff: false, onLeave: true },
          storedStatus: "PRESENT",
        }).status,
      ).toBe("ON_LEAVE");
    });

    it("holiday keeps punched time, with no overtime and no shortfall", () => {
      const r = run({
        calendar: { holiday: true, weeklyOff: false, onLeave: false },
        sessions: [session("10:00", "20:00")],
      });
      expect(r).toMatchObject({
        workedMinutes: 600,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });

    it("leave keeps punched time, with no overtime and no shortfall", () => {
      const r = run({
        calendar: { holiday: false, weeklyOff: false, onLeave: true },
        sessions: [session("10:00", "11:00")],
      });
      expect(r).toMatchObject({
        workedMinutes: 60,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      });
    });

    it("weekly off caps worked at target and reports no overtime (legacy Sunday rule)", () => {
      const r = run({
        calendar: { holiday: false, weeklyOff: true, onLeave: false },
        sessions: [session("09:00", "13:00")],
        targetMinutes: 240,
      });
      expect(r).toMatchObject({
        status: "WEEKLY_OFF",
        workedMinutes: 240,
        overtimeMinutes: 0,
      });
    });

    it("a holiday with no punches reports zero and no shortfall", () => {
      expect(
        run({ calendar: { holiday: true, weeklyOff: false, onLeave: false } }),
      ).toMatchObject({ workedMinutes: 0, shortfallMinutes: 0 });
    });
  });

  it("recalculation is deterministic: the same input always gives the same output", () => {
    const input: AttendanceDayInput = {
      storedStatus: null,
      sessions: [session("10:00", "18:45")],
      targetMinutes: 480,
      calendar: NO_CALENDAR,
      asOf: at("23:59"),
    };
    const service = new AttendanceCalculationService();
    expect(service.calculate(input)).toEqual(service.calculate(input));
  });
});

describe("workedMinutesOf", () => {
  it("floors partial minutes", () => {
    const sessions = [
      {
        checkInAt: new Date("2026-10-05T04:00:00Z"),
        checkOutAt: new Date("2026-10-05T04:01:59Z"),
      },
    ];
    expect(workedMinutesOf(sessions, new Date()).minutes).toBe(1);
  });
});

describe("timezone and date boundary (Asia/Kolkata)", () => {
  it("an instant just before IST midnight belongs to that IST day", () => {
    expect(istDateOf(new Date("2026-10-04T18:29:59Z"))).toBe("2026-10-04");
  });

  it("an instant at IST midnight belongs to the next IST day", () => {
    expect(istDateOf(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
  });

  it("ISO weekday numbering: Monday 1 … Sunday 7", () => {
    expect(isoWeekdayOf("2026-10-05")).toBe(1);
    expect(isoWeekdayOf("2026-10-11")).toBe(7);
  });
});

describe("assertSessionsConsistent", () => {
  it("accepts ordered, non-overlapping sessions", () => {
    expect(() =>
      assertSessionsConsistent([
        session("10:00", "13:00"),
        session("14:00", "18:00"),
      ]),
    ).not.toThrow();
  });

  it("rejects an overlap", () => {
    expect(() =>
      assertSessionsConsistent([
        session("10:00", "13:00"),
        session("12:00", "18:00"),
      ]),
    ).toThrow(SessionOrderError);
  });

  it("rejects a zero or negative length session", () => {
    expect(() => assertSessionsConsistent([session("10:00", "10:00")])).toThrow(
      SessionOrderError,
    );
  });

  it("rejects an open session that is not the last one", () => {
    expect(() =>
      assertSessionsConsistent([
        session("10:00", null),
        session("14:00", "18:00"),
      ]),
    ).toThrow(SessionOrderError);
  });
});
