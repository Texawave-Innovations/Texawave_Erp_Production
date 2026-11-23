import test from "node:test";
import assert from "node:assert/strict";
import { axisFor, buildDayTimeline, istMinuteOf } from "./day-timeline.js";
import type { DayAttendance, TimesheetRow, TimesheetSession } from "./types.js";

const DATE = "2026-11-17";
/** An instant on 17 Nov at `hh:mm` IST. */
const at = (hhmm: string) => `${DATE}T${hhmm}:00.000+05:30`;
const iso = (hhmm: string) => new Date(at(hhmm)).toISOString();
const PAST_NOW = new Date("2026-11-20T06:00:00.000Z");

let nextId = 1;
const session = (
  from: string,
  to: string | null,
  over: Partial<TimesheetSession> = {},
): TimesheetSession => ({
  id: nextId++,
  startedAt: iso(from),
  endedAt: to ? iso(to) : null,
  durationMinutes: 0,
  closedReason: null,
  reviewState: "OK",
  source: "TIMER",
  timePrecision: "EXACT",
  notes: null,
  ...over,
});

const taskRow = (
  code: string,
  sessions: TimesheetSession[],
  over: Partial<TimesheetRow> = {},
): TimesheetRow => ({
  id: nextId++,
  category: "TASK",
  title: `Task ${code}`,
  description: null,
  projectId: 1,
  lateEntryReason: null,
  taskId: nextId,
  taskCode: code,
  projectName: "ERP",
  dailyStatus: "IN_PROGRESS",
  submissionStatus: "DRAFT",
  notes: null,
  isBackdated: false,
  startedAt: null,
  endedAt: null,
  durationMinutes: 0,
  sessions,
  ...over,
});

const attendance = (over: Partial<DayAttendance> = {}): DayAttendance => ({
  status: "PRESENT",
  workedMinutes: 480,
  overtimeMinutes: 0,
  targetMinutes: 480,
  baseTargetMinutes: 480,
  permissions: [],
  permissionMinutes: 0,
  hasOpenSession: false,
  checkInAt: iso("10:00"),
  checkOutAt: iso("19:00"),
  ...over,
});

const kinds = (t: ReturnType<typeof buildDayTimeline>) =>
  t.segments.map((s) => `${s.kind}:${s.start}-${s.end}`);

test("istMinuteOf reads IST wall time and clamps to the day", () => {
  assert.equal(istMinuteOf(iso("10:30"), DATE), 630);
  assert.equal(istMinuteOf("2026-11-16T10:00:00.000Z", DATE), 0);
  assert.equal(istMinuteOf("2026-11-18T10:00:00.000Z", DATE), 1440);
});

test("the user's example: 3h task, 2h permission, 2h no active task, check-in to check-out", () => {
  // 10:00 in, task 10:00–13:00, permission 13:00–15:00, nothing 15:00–17:00,
  // task 17:00–19:00, out 19:00.
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [
        taskRow("T-1", [session("10:00", "13:00"), session("17:00", "19:00")]),
      ],
      attendance: attendance({
        permissions: [{ fromTime: "13:00", toTime: "15:00", minutes: 120 }],
        permissionMinutes: 120,
      }),
    },
    PAST_NOW,
  );
  assert.deepEqual(kinds(t), [
    "work:600-780",
    "permission:780-900",
    "no_task:900-1020",
    "work:1020-1140",
  ]);
  assert.equal(t.workMinutes, 300);
  assert.equal(t.permissionMinutes, 120);
  assert.equal(t.noTaskMinutes, 120);
  assert.equal(t.pausedMinutes, 0);
  assert.equal(t.checkIn, 600);
  assert.equal(t.checkOut, 1140);
  assert.deepEqual([t.axisStart, t.axisEnd], [600, 1140]);
});

test("each row keeps its own colour; the bar shows the title, the code is in the tooltip", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [
        taskRow("T-1", [session("10:00", "11:00")]),
        taskRow("T-2", [session("11:00", "12:00")]),
      ],
      attendance: attendance({ checkOutAt: iso("12:00") }),
    },
    PAST_NOW,
  );
  assert.deepEqual(
    t.segments.map((s) => [s.label, s.colorIndex]),
    [
      ["Task T-1", 0],
      ["Task T-2", 1],
    ],
  );
  assert.equal(t.segments[0]!.detail, "T-1 · Task T-1 · ERP");
  assert.equal(t.noTaskMinutes, 0);
});

test("a custom activity is drawn from its own start and end", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [
        taskRow("MEETING", [], {
          category: "MEETING",
          title: "Sprint review",
          startedAt: iso("15:00"),
          endedAt: iso("16:00"),
          durationMinutes: 60,
        }),
      ],
      attendance: null,
    },
    PAST_NOW,
  );
  assert.deepEqual(kinds(t), ["work:900-960"]);
  assert.equal(t.segments[0]!.label, "Sprint review");
});

test("logged durations and abandoned timers are not drawn as work", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [
        taskRow("T-1", [
          session("10:00", "10:00", {
            timePrecision: "DURATION_ONLY",
            durationMinutes: 90,
          }),
          session("11:00", "18:00", { reviewState: "STALE_UNRESOLVED" }),
        ]),
      ],
      attendance: null,
    },
    PAST_NOW,
  );
  assert.deepEqual(t.segments, []);
  assert.equal(t.untimedMinutes, 90);
});

test("today: a running timer and the open attendance run up to now", () => {
  const now = new Date(at("12:30"));
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [taskRow("T-1", [session("11:00", null)])],
      attendance: attendance({ checkOutAt: null }),
    },
    now,
  );
  assert.deepEqual(kinds(t), ["no_task:600-660", "work:660-750"]);
  assert.equal(t.now, 750);
  assert.equal(t.segments[1]!.running, true);
});

test("a past day without a verified check-out ends the gaps at the last work", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [taskRow("T-1", [session("11:00", "12:00")])],
      attendance: attendance({ checkOutAt: null }),
    },
    PAST_NOW,
  );
  assert.deepEqual(kinds(t), ["no_task:600-660", "work:660-720"]);
  assert.equal(t.now, null);
});

test("the gap right after a task was paused is Paused, not No active task", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: null,
      rows: [
        taskRow("T-1", [
          session("10:00", "12:00", { closedReason: "PAUSED" }),
          session("13:00", "15:00", { closedReason: "STOPPED" }),
        ]),
      ],
      attendance: attendance({ checkOutAt: iso("16:00") }),
    },
    PAST_NOW,
  );
  assert.deepEqual(kinds(t), [
    "work:600-720",
    "paused:720-780",
    "work:780-900",
    "no_task:900-960",
  ]);
  assert.equal(t.pausedMinutes, 60);
  assert.equal(t.noTaskMinutes, 60);
  assert.equal(t.segments[1]!.detail, "Task T-1 paused, nothing else running");
});

test("the axis spans whole hours and at least the shift plus a break", () => {
  assert.deepEqual(axisFor([], 540), { start: 540, end: 1080 });
  assert.deepEqual(axisFor([610, 700], 540), { start: 600, end: 1140 });
  assert.deepEqual(axisFor([1300, 1400], 540), { start: 900, end: 1440 });
});

test("HR's status for the day is shown on the bar", () => {
  const status = (date: string, attendanceStatus: string | null) =>
    buildDayTimeline(
      { date, attendanceStatus, rows: [], attendance: null },
      new Date(at("12:00")), // today = 17 Nov
    ).dayStatus;
  assert.equal(status(DATE, "HOLIDAY"), "HOLIDAY");
  assert.equal(status("2026-11-16", "ABSENT"), "ABSENT");
  assert.equal(status("2026-11-16", "ON_LEAVE"), "ON_LEAVE");
  assert.equal(status("2026-11-16", "HALF_DAY"), "HALF_DAY");
  assert.equal(status("2026-11-16", "PRESENT"), null);
  assert.equal(status("2026-11-16", "NOT_MARKED"), null);
  // Ahead of the day only HR's calendar is known.
  assert.equal(status("2026-11-26", "HOLIDAY"), "HOLIDAY");
  assert.equal(status("2026-11-22", "WEEKLY_OFF"), "WEEKLY_OFF");
  assert.equal(status("2026-11-24", "NOT_MARKED"), null);
});

test("work on a holiday is still drawn over the holiday", () => {
  const t = buildDayTimeline(
    {
      date: DATE,
      attendanceStatus: "HOLIDAY",
      rows: [taskRow("T-1", [session("10:00", "12:00")])],
      attendance: null,
    },
    PAST_NOW,
  );
  assert.equal(t.dayStatus, "HOLIDAY");
  assert.deepEqual(kinds(t), ["work:600-720"]);
});
