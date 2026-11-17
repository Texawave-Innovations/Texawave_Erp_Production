import {
  buildTaskHistory,
  summarizeDay,
  taskStatusAsOf,
  type RecordedDay,
  type StatusEvent,
} from "./timesheet-views.js";

const at = (iso: string) => new Date(iso);

// The task's status history for the Mon -> Thu acceptance scenario
// (IST dates 2026-11-16 .. 2026-11-19):
//   Mon 10:00 start, Mon 12:00 pause, Thu 10:00 resume, Thu 13:00 complete.
const EVENTS: StatusEvent[] = [
  { at: at("2026-11-16T04:30:00Z"), status: "in_progress" }, // Mon 10:00 IST
  { at: at("2026-11-16T06:30:00Z"), status: "hold" }, // Mon 12:00 IST
  { at: at("2026-11-19T04:30:00Z"), status: "in_progress" }, // Thu 10:00 IST
  { at: at("2026-11-19T07:30:00Z"), status: "completed" }, // Thu 13:00 IST
];

describe("taskStatusAsOf", () => {
  it("is the status at the END of the IST day", () => {
    expect(taskStatusAsOf(EVENTS, "2026-11-15")).toBeNull(); // before anything
    expect(taskStatusAsOf(EVENTS, "2026-11-16")).toBe("hold"); // started AND paused that day
    expect(taskStatusAsOf(EVENTS, "2026-11-17")).toBe("hold");
    expect(taskStatusAsOf(EVENTS, "2026-11-18")).toBe("hold");
    expect(taskStatusAsOf(EVENTS, "2026-11-19")).toBe("completed");
    expect(taskStatusAsOf(EVENTS, "2026-11-25")).toBe("completed");
  });

  it("uses the IST date of the event, not the UTC date", () => {
    // 20:30Z on the 18th is 02:00 IST on the 19th
    const late: StatusEvent[] = [
      { at: at("2026-11-18T20:30:00Z"), status: "in_progress" },
    ];
    expect(taskStatusAsOf(late, "2026-11-18")).toBeNull();
    expect(taskStatusAsOf(late, "2026-11-19")).toBe("in_progress");
  });

  it("does not depend on the order the events are given in", () => {
    expect(taskStatusAsOf([...EVENTS].reverse(), "2026-11-17")).toBe("hold");
  });

  it("is null for a task with no history", () => {
    expect(taskStatusAsOf([], "2026-11-17")).toBeNull();
  });
});

describe("buildTaskHistory — the spec's Nov 16-19 table", () => {
  const recorded = new Map<string, RecordedDay>([
    ["2026-11-16", { rowId: 1, dailyStatus: "IN_PROGRESS", minutes: 120 }],
    ["2026-11-19", { rowId: 2, dailyStatus: "COMPLETED", minutes: 180 }],
  ]);
  const attendance = new Map<string, string>([
    ["2026-11-16", "PRESENT"],
    ["2026-11-17", "PRESENT"],
    ["2026-11-18", "ABSENT"],
    ["2026-11-19", "PRESENT"],
  ]);
  const days = buildTaskHistory({
    from: "2026-11-16",
    to: "2026-11-19",
    recorded,
    events: EVENTS,
    attendance,
  });
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));

  it("Nov 16: recorded, In Progress, 2 hours", () => {
    expect(byDate["2026-11-16"]).toMatchObject({
      carried: false,
      label: "In Progress",
      minutes: 120,
      attendanceStatus: "PRESENT",
      rowId: 1,
    });
  });

  it("Nov 17: carried — On Hold (no work), 0 hours, Present", () => {
    expect(byDate["2026-11-17"]).toMatchObject({
      carried: true,
      label: "On Hold (no work)",
      minutes: 0,
      taskStatus: "hold",
      attendanceStatus: "PRESENT",
      rowId: null,
    });
  });

  it("Nov 18: carried — Not worked, 0 hours, Absent (from HR attendance)", () => {
    expect(byDate["2026-11-18"]).toMatchObject({
      carried: true,
      label: "Not worked",
      minutes: 0,
      attendanceStatus: "ABSENT",
    });
  });

  it("Nov 19: recorded, Completed, 3 hours", () => {
    expect(byDate["2026-11-19"]).toMatchObject({
      carried: false,
      label: "Completed",
      minutes: 180,
      rowId: 2,
    });
  });

  it("the total is exactly the worked days: 5 hours, nothing fabricated", () => {
    expect(days.reduce((n, d) => n + d.minutes, 0)).toBe(300);
    expect(days.filter((d) => d.carried).every((d) => d.minutes === 0)).toBe(
      true,
    );
  });

  it("returns one entry per calendar day, in order", () => {
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
  });
});

describe("buildTaskHistory — other carried-day labels", () => {
  const history = (
    attendance: [string, string][],
    events: StatusEvent[],
    from = "2026-11-16",
    to = "2026-11-16",
  ) =>
    buildTaskHistory({
      from,
      to,
      recorded: new Map(),
      events,
      attendance: new Map(attendance),
    })[0]!;

  it.each(["ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"])(
    "%s is always Not worked, even for a task in progress",
    (status) => {
      const day = history(
        [["2026-11-16", status]],
        [{ at: at("2026-11-10T04:00:00Z"), status: "in_progress" }],
      );
      expect(day.label).toBe("Not worked");
      expect(day.minutes).toBe(0);
    },
  );

  it("a present day with no work on an in-progress task", () => {
    const day = history(
      [["2026-11-16", "PRESENT"]],
      [{ at: at("2026-11-10T04:00:00Z"), status: "in_progress" }],
    );
    expect(day.label).toBe("In Progress (no work)");
  });

  it("with no HR record for the day, only the task status decides the label", () => {
    const day = history(
      [],
      [{ at: at("2026-11-10T04:00:00Z"), status: "hold" }],
    );
    expect(day.attendanceStatus).toBeNull();
    expect(day.label).toBe("On Hold (no work)");
  });

  it("days after completion read Completed; days before any history read Not started", () => {
    const done = history(
      [],
      [{ at: at("2026-11-10T04:00:00Z"), status: "completed" }],
    );
    expect(done.label).toBe("Completed");
    expect(history([], []).label).toBe("Not started");
  });
});

describe("summarizeDay", () => {
  it("adds closed task sessions and custom activities; open and zero rows add nothing", () => {
    const totals = summarizeDay([
      {
        category: "TASK",
        sessions: [
          { endedAt: at("2026-11-16T06:30:00Z"), durationMinutes: 120 },
          { endedAt: null, durationMinutes: 0 }, // still running
          { endedAt: at("2026-11-16T03:00:00Z"), durationMinutes: 0 }, // stale zero row
        ],
        durationMinutes: null,
        endedAt: null,
      },
      {
        category: "INTERNAL_MEETING",
        sessions: [],
        durationMinutes: 60,
        endedAt: at("2026-11-16T09:30:00Z"),
      },
    ]);
    expect(totals).toEqual({
      taskMinutes: 120,
      customMinutes: 60,
      totalMinutes: 180,
      rowCount: 2,
    });
  });

  it("an empty day is all zeros", () => {
    expect(summarizeDay([])).toEqual({
      taskMinutes: 0,
      customMinutes: 0,
      totalMinutes: 0,
      rowCount: 0,
    });
  });
});
