import {
  businessDateOf,
  businessToday,
} from "../../common/dates/business-date.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../common/exceptions/business.exception.js";

/**
 * Pure Timesheet business rules — no I/O, no clock (every "now" is passed in),
 * so each rule is unit-tested without Prisma (timesheets.rules.spec.ts).
 * Services and repositories call these; none of them re-implements a rule.
 *
 * Vocabulary (never merged):
 *  - task status      — ProjectTask.status, the task's overall lifecycle;
 *  - daily status     — hr.timesheets.daily_status, describes THAT day's work
 *                       (any worked day is IN_PROGRESS; COMPLETED only on the
 *                       completion day). A pause is NOT a daily status;
 *  - session          — one continuous interval (projects.project_time_entries);
 *  - work date        — always the IST business date (common/dates/business-date).
 */

// ---------------------------------------------------------------------------
// Categories — ONE list. `TASK` is an assigned project task; the rest are
// custom activities. The UI mirrors this by hand in
// packages/api-types/src/timesheets.ts (HANDWRITTEN header there).
// ---------------------------------------------------------------------------
export const TASK_CATEGORY = "TASK" as const;
export const CUSTOM_ACTIVITY_CATEGORIES = [
  "INTERNAL_MEETING",
  "CLIENT_MEETING",
  "TEAM_DISCUSSION",
  "TECHNICAL_DISCUSSION",
  "RESEARCH",
  "CODE_REVIEW",
  "BUG_INVESTIGATION",
  "DOCUMENTATION",
  "TRAINING",
  "ADMINISTRATIVE",
  "OTHER",
] as const;
export const TIMESHEET_CATEGORIES = [
  TASK_CATEGORY,
  ...CUSTOM_ACTIVITY_CATEGORIES,
] as const;

export type CustomActivityCategory =
  (typeof CUSTOM_ACTIVITY_CATEGORIES)[number];
export type TimesheetCategory = (typeof TIMESHEET_CATEGORIES)[number];

/** Display names for the custom-activity categories — served by the API so the
 * UI never hard-codes the list. */
export const CUSTOM_ACTIVITY_CATEGORY_LABELS: Record<
  CustomActivityCategory,
  string
> = {
  INTERNAL_MEETING: "Internal meeting",
  CLIENT_MEETING: "Client meeting",
  TEAM_DISCUSSION: "Team discussion",
  TECHNICAL_DISCUSSION: "Technical discussion",
  RESEARCH: "Research",
  CODE_REVIEW: "Code review",
  BUG_INVESTIGATION: "Bug investigation",
  DOCUMENTATION: "Documentation",
  TRAINING: "Training",
  ADMINISTRATIVE: "Administrative work",
  OTHER: "Other",
};

export function isCustomActivityCategory(
  value: string,
): value is CustomActivityCategory {
  return (CUSTOM_ACTIVITY_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Status vocabularies (mirrored by the CHECK constraints in the migration).
// ---------------------------------------------------------------------------
export const TIMESHEET_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const DAILY_STATUSES = ["IN_PROGRESS", "ON_HOLD", "COMPLETED"] as const;
export type DailyStatus = (typeof DAILY_STATUSES)[number];

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------
export type TaskStatus = "not_started" | "in_progress" | "hold" | "completed";
export type TaskAction = "start" | "pause" | "resume" | "complete";

/** What an ASSIGNEE may do from each state. Strict: this is the employee's
 * Start / Pause / Resume / Complete flow. */
export const TASK_ACTIONS: Record<
  TaskAction,
  { from: readonly TaskStatus[]; to: TaskStatus }
> = {
  start: { from: ["not_started"], to: "in_progress" },
  pause: { from: ["in_progress"], to: "hold" },
  resume: { from: ["hold"], to: "in_progress" },
  // Completing from hold is allowed and records 0 new minutes (no fabricated session).
  complete: { from: ["in_progress", "hold"], to: "completed" },
};

/** Target status of an employee action, or a state-transition error that names
 * the action the employee should have used. */
export function applyTaskAction(
  current: TaskStatus,
  action: TaskAction,
): TaskStatus {
  const rule = TASK_ACTIONS[action];
  if (!rule.from.includes(current)) {
    const hint =
      action === "start" && current === "hold"
        ? ' (the task is on hold — use "resume")'
        : action === "resume" && current === "in_progress"
          ? " (the task is already in progress)"
          : action === "complete" && current === "completed"
            ? " (the task is already completed)"
            : "";
    throw new InvalidStateTransitionException(
      "Task",
      current,
      rule.to,
      `action "${action}" is not allowed from "${current}"${hint}`,
    );
  }
  return rule.to;
}

/** Target status of the legacy "start the stopwatch" call (`timer/start`): the
 * old UI sets a task in progress and starts the timer in either order, so it
 * accepts every state except a completed task (which must be reopened first). */
export function beginTimerTarget(current: TaskStatus): TaskStatus {
  if (current === "completed") {
    throw new InvalidStateTransitionException(
      "Task",
      current,
      "in_progress",
      "cannot start a timer on a completed task — reopen it first",
    );
  }
  return "in_progress";
}

/**
 * Status change made by someone with `projects.task.write` (the PATCH path the
 * UI dropdowns use). Deliberately more permissive than the employee flow so the
 * existing manager UI and tests keep working (any state may be set), but with
 * one guard: LEAVING `completed` is a reopen and needs a reason, because it
 * un-completes finished work. A same-status request is a no-op, never an error.
 */
export function assertManagerStatusChange(
  from: TaskStatus,
  to: TaskStatus,
  reason: string | undefined,
): "noop" | "change" | "reopen" {
  if (from === to) return "noop";
  if (from === "completed") {
    if (!reason?.trim()) {
      throw new BusinessRuleViolationException(
        "A reason is required to reopen a completed task",
        "TASK_REOPEN_REASON_REQUIRED",
      );
    }
    return "reopen";
  }
  return "change";
}

/** The exact completion trigger `TasksService.updateTask` has always used:
 * the task BECOMES complete when the status is completed or the percent hits
 * 100, and it was not already complete. Kept identical so existing behaviour
 * (and tests) are unchanged; points are awarded once per task by the caller. */
export function isCompletionTransition(
  existing: { status: TaskStatus; completionPercent?: number | undefined },
  requested: {
    status?: TaskStatus | undefined;
    completionPercent?: number | undefined;
  },
): boolean {
  const isNowCompleted =
    requested.status === "completed" || requested.completionPercent === 100;
  const wasCompleted =
    existing.status === "completed" || existing.completionPercent === 100;
  return isNowCompleted && !wasCompleted;
}

/** Daily status written by an employee action: any day with work is IN_PROGRESS;
 * only completing the task makes that day COMPLETED. Pause does NOT make the
 * day ON_HOLD (the pause lives in the task history and is shown as "paused
 * 12:00"); ON_HOLD is only a display value for carried, no-work days. */
export function dailyStatusAfterAction(action: TaskAction): DailyStatus {
  return action === "complete" ? "COMPLETED" : "IN_PROGRESS";
}

// ---------------------------------------------------------------------------
// Time arithmetic
// ---------------------------------------------------------------------------
export interface TimeRange {
  start: Date;
  end: Date;
}

/** First pair of overlapping ranges (touching ends do not overlap), or null.
 * Used by the write paths to REFUSE overlaps so a day total can never
 * double-count; the total itself is a plain sum. */
export function findOverlap(
  ranges: readonly TimeRange[],
): [TimeRange, TimeRange] | null {
  const sorted = [...ranges].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as TimeRange;
    const cur = sorted[i] as TimeRange;
    if (cur.start.getTime() < prev.end.getTime()) return [prev, cur];
  }
  return null;
}

/** Recorded minutes of one closed session: whole minutes, at least 1 (the
 * stopwatch's long-standing rule). */
export function sessionMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

export interface DayWorkItem {
  /** null/undefined = still running: contributes nothing until it is closed. */
  endedAt?: Date | null;
  durationMinutes: number;
}

/** Day total = sum of the stored minutes of CLOSED sessions and custom
 * activities. Open sessions, zero-minute stale/duplicate rows and paused or idle
 * time contribute nothing, so no hour is ever fabricated. */
export function dailyTotalMinutes(items: readonly DayWorkItem[]): number {
  return items.reduce(
    (sum, i) => (i.endedAt ? sum + Math.max(0, i.durationMinutes) : sum),
    0,
  );
}

// ---------------------------------------------------------------------------
// Forgotten timers — never fabricate hours
// ---------------------------------------------------------------------------
/** An open session is stale after this many hours (configurable later). */
export const MAX_OPEN_SESSION_HOURS = 12;

export type OpenSessionDecision =
  | { kind: "KEEP_OPEN" }
  | {
      kind: "CLOSE_AT_CHECKOUT";
      endedAt: Date;
      closedReason: "ATTENDANCE_CHECKOUT" | "AUTO_CHECKOUT";
      /** System-made check-outs are counted but flagged for the approver. */
      reviewRequired: boolean;
    }
  | {
      kind: "CLOSE_STALE_ZERO";
      /** = startedAt: the real end is unknown, so 0 minutes are counted. */
      endedAt: Date;
    };

/**
 * What to do with a still-open session. Only REAL instants are ever used as an
 * end time:
 *  1. the attendance check-out that follows the session start (an
 *     auto-checkout is counted but flagged REVIEW_REQUIRED);
 *  2. otherwise, if the session crossed IST midnight or ran past the cap, it is
 *     closed at its own start with ZERO minutes and raised as an exception —
 *     the employee/HR supply the real end through the correction workflow;
 *  3. otherwise it is simply still running.
 */
export function resolveOpenSession(input: {
  startedAt: Date;
  now: Date;
  /** Latest attendance check-out at/after startedAt, if any. */
  attendanceCheckOutAt?: Date | null;
  checkOutIsAuto?: boolean;
  maxOpenHours?: number;
}): OpenSessionDecision {
  const { startedAt, now, attendanceCheckOutAt } = input;
  if (
    attendanceCheckOutAt &&
    attendanceCheckOutAt.getTime() >= startedAt.getTime() &&
    attendanceCheckOutAt.getTime() <= now.getTime()
  ) {
    const auto = input.checkOutIsAuto === true;
    return {
      kind: "CLOSE_AT_CHECKOUT",
      endedAt: attendanceCheckOutAt,
      closedReason: auto ? "AUTO_CHECKOUT" : "ATTENDANCE_CHECKOUT",
      reviewRequired: auto,
    };
  }
  const maxMs = (input.maxOpenHours ?? MAX_OPEN_SESSION_HOURS) * 3_600_000;
  const crossedMidnight = businessDateOf(startedAt) < businessDateOf(now);
  const tooLong = now.getTime() - startedAt.getTime() > maxMs;
  if (crossedMidnight || tooLong) {
    return { kind: "CLOSE_STALE_ZERO", endedAt: startedAt };
  }
  return { kind: "KEEP_OPEN" };
}

// ---------------------------------------------------------------------------
// Custom activities
// ---------------------------------------------------------------------------
export interface CustomActivityInput {
  category: string;
  title: string;
  workDate: string;
  startedAt: Date;
  endedAt: Date;
  lateEntryReason?: string | undefined;
}

export interface CustomActivityCheck {
  errors: string[];
  durationMinutes: number;
  /** The work date is before today (IST): a late entry that needs a reason and,
   * on an already-submitted day, the correction workflow. */
  isBackdated: boolean;
}

export function checkCustomActivity(
  input: CustomActivityInput,
  now: Date,
): CustomActivityCheck {
  const errors: string[] = [];
  const startMs = input.startedAt.getTime();
  const endMs = input.endedAt.getTime();

  if (!isCustomActivityCategory(input.category)) {
    errors.push("Choose a valid activity category.");
  }
  if (!input.title.trim()) errors.push("Activity title is required.");
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    errors.push("Start and end time are required.");
    return { errors, durationMinutes: 0, isBackdated: false };
  }
  if (endMs <= startMs) errors.push("End time must be after the start time.");
  if (endMs > now.getTime())
    errors.push("An activity cannot end in the future.");

  // The whole interval stays inside the work date (IST). An activity that ends
  // exactly at midnight still belongs to the day it started on.
  if (endMs > startMs) {
    const startDay = businessDateOf(input.startedAt);
    const lastDay = businessDateOf(new Date(endMs - 1));
    if (startDay !== input.workDate || lastDay !== input.workDate) {
      errors.push(
        "An activity must start and end on the same day; record a separate entry for each day.",
      );
    }
  }

  const isBackdated = input.workDate < businessToday(now);
  if (isBackdated && !input.lateEntryReason?.trim()) {
    errors.push("A reason is required for an activity recorded after its day.");
  }

  const durationMinutes =
    endMs > startMs ? Math.round((endMs - startMs) / 60_000) : 0;
  if (endMs > startMs && durationMinutes < 1) {
    errors.push("An activity must last at least one minute.");
  }
  return { errors, durationMinutes, isBackdated };
}

// ---------------------------------------------------------------------------
// Submission / approval
// ---------------------------------------------------------------------------
export type TimesheetAction = "submit" | "approve" | "reject" | "reopen";

export const TIMESHEET_ACTIONS: Record<
  TimesheetAction,
  { from: readonly TimesheetStatus[]; to: TimesheetStatus }
> = {
  submit: { from: ["DRAFT", "REJECTED"], to: "SUBMITTED" },
  approve: { from: ["SUBMITTED"], to: "APPROVED" },
  reject: { from: ["SUBMITTED"], to: "REJECTED" },
  // HR reopens an approved day (after attendance drift etc.); it goes back to
  // the employee as REJECTED with the reopen reason.
  reopen: { from: ["APPROVED"], to: "REJECTED" },
};

export const NOTE_REQUIRED_ACTIONS: readonly TimesheetAction[] = [
  "reject",
  "reopen",
];

export function applyTimesheetAction(
  current: TimesheetStatus,
  action: TimesheetAction,
): TimesheetStatus {
  const rule = TIMESHEET_ACTIONS[action];
  if (!rule.from.includes(current)) {
    throw new InvalidStateTransitionException(
      "Timesheet",
      current,
      rule.to,
      `action "${action}" is not allowed from "${current}"`,
    );
  }
  return rule.to;
}

export function assertDecisionNote(
  action: TimesheetAction,
  note: string | undefined,
): void {
  if (NOTE_REQUIRED_ACTIONS.includes(action) && !note?.trim()) {
    throw new BusinessRuleViolationException(
      `A reason is required to ${action} a timesheet`,
      "TIMESHEET_DECISION_NOTE_REQUIRED",
    );
  }
}

/** Maker-checker: nobody decides their own timesheet, and whoever submitted a
 * day cannot also decide it. */
export function assertNotSelfDecision(input: {
  actorUserId: number;
  employeeUserId: number | null;
  submittedByUserId: number | null;
}): void {
  if (
    input.employeeUserId !== null &&
    input.actorUserId === input.employeeUserId
  ) {
    throw new BusinessRuleViolationException(
      "You cannot decide your own timesheet",
      "TIMESHEET_SELF_DECISION_FORBIDDEN",
    );
  }
  if (
    input.submittedByUserId !== null &&
    input.actorUserId === input.submittedByUserId
  ) {
    throw new BusinessRuleViolationException(
      "The person who submitted a timesheet cannot decide it",
      "TIMESHEET_SELF_DECISION_FORBIDDEN",
    );
  }
}

/** Rows of a day that count as "pending submission": native drafts only —
 * migrated legacy days never nag. */
export function isPendingSubmission(row: {
  status: TimesheetStatus;
  origin: "NATIVE" | "MIGRATED";
}): boolean {
  return (
    row.origin === "NATIVE" &&
    (row.status === "DRAFT" || row.status === "REJECTED")
  );
}
