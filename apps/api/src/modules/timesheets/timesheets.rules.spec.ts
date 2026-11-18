import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../common/exceptions/business.exception.js";
import { splitAtBusinessMidnight } from "../../common/dates/business-date.js";
import {
  CUSTOM_ACTIVITY_CATEGORIES,
  MAX_OPEN_SESSION_HOURS,
  TIMESHEET_CATEGORIES,
  applyTaskAction,
  applyTimesheetAction,
  assertDecisionNote,
  assertManagerStatusChange,
  assertNotSelfDecision,
  beginTimerTarget,
  checkCustomActivity,
  dailyStatusAfterAction,
  dailyTotalMinutes,
  findOverlap,
  isCompletionTransition,
  isCustomActivityCategory,
  isPendingSubmission,
  resolveOpenSession,
  sessionMinutes,
  type TaskAction,
  type TaskStatus,
} from "./timesheets.rules.js";

const at = (iso: string) => new Date(iso);

describe("timesheet categories", () => {
  it("has TASK plus the custom activities, once each", () => {
    expect(TIMESHEET_CATEGORIES[0]).toBe("TASK");
    expect(new Set(TIMESHEET_CATEGORIES).size).toBe(
      TIMESHEET_CATEGORIES.length,
    );
    expect(CUSTOM_ACTIVITY_CATEGORIES).toContain("INTERNAL_MEETING");
    expect(CUSTOM_ACTIVITY_CATEGORIES).toContain("TECHNICAL_DISCUSSION");
  });

  it("TASK is not a custom activity category", () => {
    expect(isCustomActivityCategory("TASK")).toBe(false);
    expect(isCustomActivityCategory("RESEARCH")).toBe(true);
    expect(isCustomActivityCategory("nonsense")).toBe(false);
  });
});

describe("task lifecycle (employee actions)", () => {
  it("walks ASSIGNED -> IN_PROGRESS -> ON HOLD -> IN_PROGRESS -> COMPLETED", () => {
    let s: TaskStatus = "not_started";
    s = applyTaskAction(s, "start");
    expect(s).toBe("in_progress");
    s = applyTaskAction(s, "pause");
    expect(s).toBe("hold");
    s = applyTaskAction(s, "resume");
    expect(s).toBe("in_progress");
    s = applyTaskAction(s, "complete");
    expect(s).toBe("completed");
  });

  it("can complete straight from hold (records no new minutes)", () => {
    expect(applyTaskAction("hold", "complete")).toBe("completed");
  });

  it.each<[TaskStatus, TaskAction]>([
    ["not_started", "pause"], // pause an inactive task
    ["not_started", "resume"],
    ["not_started", "complete"], // must be started first
    ["in_progress", "start"],
    ["in_progress", "resume"], // resume an already-active task
    ["hold", "pause"],
    ["completed", "complete"], // duplicate completion
    ["completed", "pause"],
    ["completed", "start"],
  ])("refuses %s -> %s", (from, action) => {
    expect(() => applyTaskAction(from, action)).toThrow(
      InvalidStateTransitionException,
    );
  });

  it("tells the employee to resume a task that is on hold", () => {
    expect(() => applyTaskAction("hold", "start")).toThrow(/use "resume"/);
  });
});

describe("legacy timer start (beginTimerTarget)", () => {
  it.each<TaskStatus>(["not_started", "in_progress", "hold"])(
    "puts a %s task in progress",
    (from) => {
      expect(beginTimerTarget(from)).toBe("in_progress");
    },
  );

  it("refuses a completed task: reopen it first", () => {
    expect(() => beginTimerTarget("completed")).toThrow(
      InvalidStateTransitionException,
    );
    expect(() => beginTimerTarget("completed")).toThrow(/reopen/);
  });
});

describe("daily status vs task status", () => {
  it("any worked day is IN_PROGRESS; only completing makes the day COMPLETED", () => {
    expect(dailyStatusAfterAction("start")).toBe("IN_PROGRESS");
    expect(dailyStatusAfterAction("resume")).toBe("IN_PROGRESS");
    expect(dailyStatusAfterAction("complete")).toBe("COMPLETED");
  });

  it("a pause does not turn the day ON_HOLD (it is task history, not a daily status)", () => {
    expect(dailyStatusAfterAction("pause")).toBe("IN_PROGRESS");
  });
});

describe("manager status changes (PATCH path)", () => {
  it("allows any change between non-completed states, as the UI always has", () => {
    expect(
      assertManagerStatusChange("not_started", "completed", undefined),
    ).toBe("change"); // existing e2e: PATCH {status:"completed"} on a fresh task
    expect(assertManagerStatusChange("in_progress", "hold", undefined)).toBe(
      "change",
    );
    expect(assertManagerStatusChange("hold", "not_started", undefined)).toBe(
      "change",
    );
  });

  it("treats a same-status request as a no-op, not an error", () => {
    expect(assertManagerStatusChange("hold", "hold", undefined)).toBe("noop");
  });

  it("leaving completed is a reopen and needs a reason", () => {
    expect(() =>
      assertManagerStatusChange("completed", "in_progress", ""),
    ).toThrow(BusinessRuleViolationException);
    expect(() =>
      assertManagerStatusChange("completed", "in_progress", "  "),
    ).toThrow(/reason is required/);
    expect(
      assertManagerStatusChange(
        "completed",
        "in_progress",
        "Client asked for changes",
      ),
    ).toBe("reopen");
  });
});

describe("isCompletionTransition (kept identical to the legacy trigger)", () => {
  it("fires when status becomes completed", () => {
    expect(
      isCompletionTransition(
        { status: "in_progress" },
        { status: "completed" },
      ),
    ).toBe(true);
  });

  it("fires when the percent reaches 100", () => {
    expect(
      isCompletionTransition(
        { status: "in_progress", completionPercent: 60 },
        { completionPercent: 100 },
      ),
    ).toBe(true);
  });

  it("does not fire for a task that was already complete (no second award)", () => {
    expect(
      isCompletionTransition({ status: "completed" }, { status: "completed" }),
    ).toBe(false);
    expect(
      isCompletionTransition(
        { status: "in_progress", completionPercent: 100 },
        { status: "completed" },
      ),
    ).toBe(false);
  });

  it("does not fire for unrelated edits", () => {
    expect(isCompletionTransition({ status: "in_progress" }, {})).toBe(false);
    expect(
      isCompletionTransition(
        { status: "in_progress" },
        { completionPercent: 40 },
      ),
    ).toBe(false);
  });
});

describe("durations and the daily total", () => {
  it("sessionMinutes rounds to whole minutes, minimum 1", () => {
    expect(
      sessionMinutes(at("2026-11-16T04:30:00Z"), at("2026-11-16T06:30:00Z")),
    ).toBe(120);
    expect(
      sessionMinutes(at("2026-11-16T04:30:00Z"), at("2026-11-16T04:30:20Z")),
    ).toBe(1);
    expect(
      sessionMinutes(at("2026-11-16T04:30:00Z"), at("2026-11-16T04:30:00Z")),
    ).toBe(1);
  });

  it("sums closed sessions and custom activities only", () => {
    expect(
      dailyTotalMinutes([
        { endedAt: at("2026-11-16T06:30:00Z"), durationMinutes: 120 }, // task session
        { endedAt: at("2026-11-16T09:30:00Z"), durationMinutes: 60 }, // custom meeting
        { endedAt: null, durationMinutes: 0 }, // still running: not counted yet
        { endedAt: at("2026-11-16T03:00:00Z"), durationMinutes: 0 }, // stale zero row
      ]),
    ).toBe(180);
  });

  it("paused / idle time never adds minutes", () => {
    // 10:00-12:00 and 14:00-16:00 with a 2h pause in between = 4h, not 6h
    expect(
      dailyTotalMinutes([
        { endedAt: at("2026-11-16T06:30:00Z"), durationMinutes: 120 },
        { endedAt: at("2026-11-16T10:30:00Z"), durationMinutes: 120 },
      ]),
    ).toBe(240);
  });

  it("an empty day totals zero", () => {
    expect(dailyTotalMinutes([])).toBe(0);
  });

  it("findOverlap flags overlapping ranges and ignores touching ends", () => {
    const a = {
      start: at("2026-11-16T04:30:00Z"),
      end: at("2026-11-16T06:30:00Z"),
    };
    const touching = {
      start: at("2026-11-16T06:30:00Z"),
      end: at("2026-11-16T07:00:00Z"),
    };
    const overlapping = {
      start: at("2026-11-16T06:00:00Z"),
      end: at("2026-11-16T07:00:00Z"),
    };
    expect(findOverlap([a, touching])).toBeNull();
    expect(findOverlap([overlapping, a])?.length).toBe(2);
  });
});

describe("Nov 16-19 acceptance scenario (rule level)", () => {
  // 16 Nov: 10:00-12:00 IST; 19 Nov: 10:00-13:00 IST; absent on 18 Nov (HR).
  const nov16 = {
    start: at("2026-11-16T04:30:00Z"),
    end: at("2026-11-16T06:30:00Z"),
  };
  const nov19 = {
    start: at("2026-11-19T04:30:00Z"),
    end: at("2026-11-19T07:30:00Z"),
  };

  it("records separate days, sums to 5h and never rewrites the first day", () => {
    let status: TaskStatus = "not_started";
    // Nov 16: start, pause
    status = applyTaskAction(status, "start");
    const day16Status = dailyStatusAfterAction("start");
    status = applyTaskAction(status, "pause");
    expect(status).toBe("hold");
    const day16Minutes = sessionMinutes(nov16.start, nov16.end);
    // Nov 17 / 18: no actions -> no rows, no minutes (carried status is derived on read)
    // Nov 19: resume, complete
    status = applyTaskAction(status, "resume");
    status = applyTaskAction(status, "complete");
    const day19Status = dailyStatusAfterAction("complete");
    const day19Minutes = sessionMinutes(nov19.start, nov19.end);

    expect(status).toBe("completed");
    expect(day16Status).toBe("IN_PROGRESS"); // Nov 16 stays In Progress forever
    expect(day16Minutes).toBe(120);
    expect(day19Status).toBe("COMPLETED");
    expect(day19Minutes).toBe(180);
    expect(day16Minutes + day19Minutes).toBe(300); // 5h total
    // each session sits wholly inside its own IST day
    expect(splitAtBusinessMidnight(nov16.start, nov16.end)).toHaveLength(1);
    expect(splitAtBusinessMidnight(nov19.start, nov19.end)).toHaveLength(1);
  });
});

describe("forgotten timers — never fabricate hours", () => {
  const startedAt = at("2026-11-16T04:30:00Z"); // 10:00 IST Mon

  it("closes at the real attendance check-out", () => {
    const d = resolveOpenSession({
      startedAt,
      now: at("2026-11-16T14:00:00Z"),
      attendanceCheckOutAt: at("2026-11-16T12:30:00Z"), // 18:00 IST
    });
    expect(d).toEqual({
      kind: "CLOSE_AT_CHECKOUT",
      endedAt: at("2026-11-16T12:30:00Z"),
      closedReason: "ATTENDANCE_CHECKOUT",
      reviewRequired: false,
    });
  });

  it("an auto-checkout closes the session but flags it for the approver", () => {
    const d = resolveOpenSession({
      startedAt,
      now: at("2026-11-16T14:00:00Z"),
      attendanceCheckOutAt: at("2026-11-16T13:30:00Z"),
      checkOutIsAuto: true,
    });
    expect(d).toMatchObject({
      kind: "CLOSE_AT_CHECKOUT",
      closedReason: "AUTO_CHECKOUT",
      reviewRequired: true,
    });
  });

  it("ignores a check-out that happened BEFORE the session started", () => {
    const d = resolveOpenSession({
      startedAt,
      now: at("2026-11-16T05:30:00Z"),
      attendanceCheckOutAt: at("2026-11-16T03:00:00Z"),
    });
    expect(d.kind).toBe("KEEP_OPEN");
  });

  it("keeps a recent session open", () => {
    expect(
      resolveOpenSession({ startedAt, now: at("2026-11-16T08:30:00Z") }).kind,
    ).toBe("KEEP_OPEN");
  });

  it("no check-out + IST midnight crossed -> closes at its own start with zero minutes", () => {
    const d = resolveOpenSession({
      startedAt: at("2026-11-16T12:00:00Z"), // 17:30 IST
      now: at("2026-11-16T19:00:00Z"), // 00:30 IST next day, only 7h later
    });
    expect(d).toEqual({
      kind: "CLOSE_STALE_ZERO",
      endedAt: at("2026-11-16T12:00:00Z"),
    });
  });

  it("no check-out + longer than the cap -> stale zero", () => {
    const d = resolveOpenSession({
      startedAt: at("2026-11-16T04:30:00Z"), // 10:00 IST
      now: new Date(
        at("2026-11-16T04:30:00Z").getTime() +
          (MAX_OPEN_SESSION_HOURS + 1) * 3_600_000,
      ),
    });
    expect(d.kind).toBe("CLOSE_STALE_ZERO");
  });

  it("a stale decision never carries an end later than the start (no invented time)", () => {
    const d = resolveOpenSession({
      startedAt: at("2026-11-10T04:30:00Z"),
      now: at("2026-11-16T04:30:00Z"),
    });
    expect(d.kind).toBe("CLOSE_STALE_ZERO");
    if (d.kind === "CLOSE_STALE_ZERO") {
      expect(d.endedAt.getTime()).toBe(at("2026-11-10T04:30:00Z").getTime());
    }
  });
});

describe("custom activities", () => {
  const now = at("2026-11-16T12:00:00Z"); // 17:30 IST Mon 16 Nov

  const valid = {
    category: "INTERNAL_MEETING",
    title: "Internal team discussion",
    workDate: "2026-11-16",
    startedAt: at("2026-11-16T08:30:00Z"), // 14:00 IST
    endedAt: at("2026-11-16T09:30:00Z"), // 15:00 IST
  };

  it("accepts the spec example: 14:00-15:00 IST is exactly 1 hour", () => {
    const r = checkCustomActivity(valid, now);
    expect(r.errors).toEqual([]);
    expect(r.durationMinutes).toBe(60);
    expect(r.isBackdated).toBe(false);
  });

  it("rejects an end before the start", () => {
    const r = checkCustomActivity(
      { ...valid, startedAt: valid.endedAt, endedAt: valid.startedAt },
      now,
    );
    expect(r.errors).toContain("End time must be after the start time.");
  });

  it("rejects an activity that ends in the future", () => {
    const r = checkCustomActivity(
      { ...valid, endedAt: at("2026-11-16T13:00:00Z") },
      now,
    );
    expect(r.errors).toContain("An activity cannot end in the future.");
  });

  it("rejects an activity crossing IST midnight", () => {
    const late = at("2026-11-17T03:00:00Z");
    const r = checkCustomActivity(
      {
        ...valid,
        startedAt: at("2026-11-16T17:30:00Z"), // 23:00 IST
        endedAt: at("2026-11-16T19:00:00Z"), // 00:30 IST next day
      },
      late,
    );
    expect(r.errors.join(" ")).toMatch(/same day/);
  });

  it("allows an activity that ends exactly at IST midnight (it can only be recorded the next day, so it is a late entry that needs a reason)", () => {
    const entry = {
      ...valid,
      startedAt: at("2026-11-16T17:30:00Z"), // 23:00 IST
      endedAt: at("2026-11-16T18:30:00Z"), // 24:00 IST
    };
    const nextMorning = at("2026-11-17T03:00:00Z");
    const r = checkCustomActivity(
      { ...entry, lateEntryReason: "Joined the call after logging off" },
      nextMorning,
    );
    expect(r.errors).toEqual([]);
    expect(r.durationMinutes).toBe(60);
    expect(r.isBackdated).toBe(true);
    // and it is not rejected as "crossing midnight"
    expect(
      checkCustomActivity(entry, nextMorning).errors.join(" "),
    ).not.toMatch(/same day/);
  });

  it("rejects a work date that does not match the times", () => {
    const r = checkCustomActivity({ ...valid, workDate: "2026-11-15" }, now);
    expect(r.errors.join(" ")).toMatch(/same day/);
  });

  it("rejects an unknown category and a blank title", () => {
    const r = checkCustomActivity(
      { ...valid, category: "TASK", title: "  " },
      now,
    );
    expect(r.errors).toContain("Choose a valid activity category.");
    expect(r.errors).toContain("Activity title is required.");
  });

  it("a backdated activity needs a reason and is flagged", () => {
    const backdated = {
      ...valid,
      workDate: "2026-11-13",
      startedAt: at("2026-11-13T08:30:00Z"),
      endedAt: at("2026-11-13T09:30:00Z"),
    };
    const noReason = checkCustomActivity(backdated, now);
    expect(noReason.isBackdated).toBe(true);
    expect(noReason.errors).toContain(
      "A reason is required for an activity recorded after its day.",
    );
    const withReason = checkCustomActivity(
      { ...backdated, lateEntryReason: "Forgot to log after the client call" },
      now,
    );
    expect(withReason.errors).toEqual([]);
    expect(withReason.isBackdated).toBe(true);
  });
});

describe("timesheet submission and approval", () => {
  it("DRAFT -> SUBMITTED -> APPROVED", () => {
    expect(applyTimesheetAction("DRAFT", "submit")).toBe("SUBMITTED");
    expect(applyTimesheetAction("SUBMITTED", "approve")).toBe("APPROVED");
  });

  it("a rejected day can be corrected and resubmitted", () => {
    const rejected = applyTimesheetAction("SUBMITTED", "reject");
    expect(rejected).toBe("REJECTED");
    expect(applyTimesheetAction(rejected, "submit")).toBe("SUBMITTED");
  });

  it("only HR reopen moves an approved day, back to the employee as REJECTED", () => {
    expect(applyTimesheetAction("APPROVED", "reopen")).toBe("REJECTED");
  });

  it.each([
    ["APPROVED", "submit"],
    ["APPROVED", "reject"],
    ["DRAFT", "approve"],
    ["DRAFT", "reject"],
    ["REJECTED", "approve"],
    ["SUBMITTED", "submit"],
    ["SUBMITTED", "reopen"],
  ] as const)("refuses %s -> %s", (from, action) => {
    expect(() => applyTimesheetAction(from, action)).toThrow(
      InvalidStateTransitionException,
    );
  });

  it("reject and reopen require a reason; approve and submit do not", () => {
    expect(() => assertDecisionNote("reject", " ")).toThrow(
      /reason is required/,
    );
    expect(() => assertDecisionNote("reopen", undefined)).toThrow(
      /reason is required/,
    );
    expect(() =>
      assertDecisionNote("reject", "Hours do not match the standup"),
    ).not.toThrow();
    expect(() => assertDecisionNote("approve", undefined)).not.toThrow();
    expect(() => assertDecisionNote("submit", undefined)).not.toThrow();
  });

  it("nobody decides their own timesheet, and the submitter cannot decide it", () => {
    expect(() =>
      assertNotSelfDecision({
        actorUserId: 7,
        employeeUserId: 7,
        submittedByUserId: 7,
      }),
    ).toThrow(/your own/);
    expect(() =>
      assertNotSelfDecision({
        actorUserId: 9,
        employeeUserId: 7,
        submittedByUserId: 9,
      }),
    ).toThrow(/submitted/);
    expect(() =>
      assertNotSelfDecision({
        actorUserId: 9,
        employeeUserId: 7,
        submittedByUserId: 7,
      }),
    ).not.toThrow();
    // an employee with no user account can still be reviewed
    expect(() =>
      assertNotSelfDecision({
        actorUserId: 9,
        employeeUserId: null,
        submittedByUserId: null,
      }),
    ).not.toThrow();
  });

  it("only native drafts/rejected days count as pending submission; migrated days never nag", () => {
    expect(isPendingSubmission({ status: "DRAFT", origin: "NATIVE" })).toBe(
      true,
    );
    expect(isPendingSubmission({ status: "REJECTED", origin: "NATIVE" })).toBe(
      true,
    );
    expect(isPendingSubmission({ status: "DRAFT", origin: "MIGRATED" })).toBe(
      false,
    );
    expect(isPendingSubmission({ status: "SUBMITTED", origin: "NATIVE" })).toBe(
      false,
    );
    expect(isPendingSubmission({ status: "APPROVED", origin: "NATIVE" })).toBe(
      false,
    );
  });
});
