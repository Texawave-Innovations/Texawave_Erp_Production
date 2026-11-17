// HANDWRITTEN — mirrors the responses of apps/api/src/modules/timesheets/
// (TimesheetsService.getMyDay / getTaskHistory). Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend responses change.

export type DailyStatus = "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";

/** One continuous work interval (a stopwatch session). */
export interface TimesheetSession {
  id: number;
  startedAt: string;
  /** null while the timer is still running. */
  endedAt: string | null;
  durationMinutes: number;
  /** Why it ended: STOPPED, PAUSED, COMPLETED, ATTENDANCE_CHECKOUT, STALE, … */
  closedReason: string | null;
  /** OK | REVIEW_REQUIRED | STALE_UNRESOLVED */
  reviewState: string;
  /** TIMER | MANUAL | CORRECTION */
  source: string;
  /** EXACT | DURATION_ONLY (a logged duration, not a real clock interval). */
  timePrecision: string;
  notes: string | null;
}

/** One activity on the day: an assigned task, or (later) a custom activity. */
export interface TimesheetRow {
  id: number;
  /** `TASK` or a custom-activity category code. */
  category: string;
  title: string;
  description: string | null;
  projectId: number | null;
  /** Why a late entry was recorded after its day. */
  lateEntryReason: string | null;
  taskId: number | null;
  taskCode: string | null;
  projectName: string | null;
  dailyStatus: DailyStatus;
  /** DRAFT | SUBMITTED | APPROVED | REJECTED */
  submissionStatus: string;
  notes: string | null;
  isBackdated: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** Closed minutes only: a running session counts for nothing yet. */
  durationMinutes: number;
  sessions: TimesheetSession[];
}

export interface DayTotals {
  taskMinutes: number;
  customMinutes: number;
  totalMinutes: number;
  rowCount: number;
}

/** An open task with no work today — context only, never counted. */
export interface CarriedTask {
  taskId: number;
  taskCode: string;
  title: string;
  projectName: string | null;
  taskStatus: string;
  carried: true;
  minutes: 0;
}

export interface DayFlag {
  code: string;
  /** "warning" needs a reviewer's attention; "info" is unusual but legitimate. */
  severity: "warning" | "info";
  message: string;
}

export interface DayAttendance {
  status: string;
  /** Minutes HR counts as worked (capped at the shift target, as in HR). */
  workedMinutes: number;
  overtimeMinutes: number;
  targetMinutes: number | null;
  hasOpenSession: boolean;
}

export interface MyTimesheetDay {
  date: string;
  /** HR's effective status for the day (Not marked = HR has nothing for it). */
  attendanceStatus: string | null;
  attendance: DayAttendance | null;
  /** Mismatches between the recorded work and HR's attendance; derived on read. */
  flags: DayFlag[];
  /** Where the day is in submit / review. */
  review: DayReview;
  totals: DayTotals;
  rows: TimesheetRow[];
  carried: CarriedTask[];
}

export interface TaskHistoryDay {
  date: string;
  /** true = nothing was worked on this task that day (nothing is stored). */
  carried: boolean;
  minutes: number;
  dailyStatus: DailyStatus | null;
  taskStatus: string | null;
  attendanceStatus: string | null;
  label: string;
  rowId: number | null;
}

export interface TaskHistory {
  task: {
    id: number;
    taskCode: string;
    title: string;
    status: string;
    projectName: string | null;
  };
  from: string;
  to: string;
  totalMinutes: number;
  days: TaskHistoryDay[];
}

/** A custom-activity category as the API serves it (never hard-coded here). */
export interface ActivityCategory {
  code: string;
  label: string;
}

/** A project the employee may attach an activity to. */
export interface LinkableProject {
  id: number;
  projectCode: string;
  name: string;
}

/** Body of a custom activity. Times are IST `HH:mm` on `workDate`; the server
 * builds the instants and calculates the duration. */
export interface CustomActivityInput {
  category: string;
  title: string;
  description?: string;
  notes?: string;
  /** null removes the link on an edit. */
  projectId?: number | null;
  workDate: string;
  startTime: string;
  endTime: string;
  lateEntryReason?: string;
}

export interface CustomActivity {
  id: number;
  category: string;
  title: string;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  isBackdated: boolean;
  submissionStatus: string;
}

// ---------------------------------------------------------------------------
// Submit and review (reporting manager first, then HR)
// ---------------------------------------------------------------------------

export type DayWorkflowStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Who a submitted day is waiting for. */
export type ReviewStage = "MANAGER" | "HR";

/** The employee's view of where their day is in review. */
export interface DayReview {
  /** null = no rows on the day. */
  status: DayWorkflowStatus | null;
  stage: ReviewStage | null;
  /** 2 = reporting manager then HR; 1 = HR alone (no reporting manager). */
  approvalLevels: 1 | 2;
  submittedAt: string | null;
  firstApprovedAt: string | null;
  decidedAt: string | null;
  /** The approver's note; for a returned day, why. */
  decisionNote: string | null;
  /** Submit is offered: there is work, no timer is running, not a future day. */
  canSubmit: boolean;
}

export interface SubmitDayResult {
  date: string;
  rowCount: number;
  approvalLevels: 1 | 2;
  approverBasis: "REPORTING_MANAGER" | "HR";
}

export interface SubmitWeekResult {
  weekStart: string;
  submitted: { date: string; rowCount: number }[];
  skipped: { date: string; reason: string }[];
}

/** One employee-day in a review list. */
export interface ReviewDaySummary {
  employee: { id: number; code: string; name: string; team: string };
  date: string;
  status: DayWorkflowStatus;
  stage: ReviewStage | null;
  approvalLevels: 1 | 2;
  approverBasis: string | null;
  submittedAt: string | null;
  firstApprovedAt: string | null;
  firstApprovalNote: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  totalMinutes: number;
  /** Minutes from task timers; the rest of the total is other activities. */
  taskMinutes: number;
  customMinutes: number;
  rowCount: number;
  /** Some session on the day needs a reviewer's look. */
  needsAttention: boolean;
  /** Recorded in this system (not imported legacy history). */
  native: boolean;
}

export interface ReviewRowDetail {
  id: number;
  category: string;
  title: string;
  description: string | null;
  notes: string | null;
  taskCode: string | null;
  projectName: string | null;
  dailyStatus: DailyStatus;
  isBackdated: boolean;
  lateEntryReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  sessions: {
    id: number;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number;
    closedReason: string | null;
    reviewState: string;
  }[];
}

export interface ReviewDayDetail extends ReviewDaySummary {
  /** The caller may decide this day right now. */
  canDecide: boolean;
  /** HR may send this approved day back to the employee. */
  canReopen: boolean;
  /** HR may confirm the end of a flagged timer on this day. */
  canCorrect: boolean;
  attendance: {
    status: string;
    workedMinutes: number;
    overtimeMinutes: number;
    targetMinutes: number | null;
  } | null;
  /** HR's status when the day was submitted (to see a later change). */
  attendanceStatusAtSubmit: string | null;
  flags: DayFlag[];
  rows: ReviewRowDetail[];
}

export interface ReviewDecisionResult {
  employeeId: number;
  date: string;
  /** SUBMITTED after a first approval (HR is next), APPROVED when final. */
  status: DayWorkflowStatus;
  stage: 1 | 2;
  override: boolean;
  rowCount: number;
}

export interface ReviewSummary {
  /** `YYYY-MM` the approved count is for. */
  month: string;
  /** Days waiting for the caller's own decision; null if the caller cannot decide. */
  awaitingMe: number | null;
  submitted: number;
  needsAttention: number;
  returned: number;
  approvedThisMonth: number;
}

export interface CorrectSessionResult {
  sessionId: number;
  employeeId: number;
  date: string;
  minutes: number;
  previousMinutes: number;
}

export interface EmployeeReportLine {
  employee: { id: number; code: string; name: string; team: string };
  daysRecorded: number;
  taskMinutes: number;
  customMinutes: number;
  totalMinutes: number;
  notSubmittedDays: number;
  submittedDays: number;
  approvedDays: number;
  returnedDays: number;
  needsAttentionDays: number;
}

export interface EmployeeReport {
  from: string;
  to: string;
  lines: EmployeeReportLine[];
}

/** `GET /timesheets/reports/days`: every employee-day with work in the range,
 * drafts included — what the Week grid draws. */
export interface DayReport {
  from: string;
  to: string;
  days: ReviewDaySummary[];
}
