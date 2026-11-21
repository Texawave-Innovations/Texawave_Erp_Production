/**
 * Who may decide a submitted timesheet day, and at which stage — pure, so every
 * rule is unit-tested (timesheet-approval.spec.ts). Same shape as leave's
 * `approvalVerdict` (hr/leave-requests/leave-domain.ts), so the two workflows
 * behave alike:
 *
 *  - Two-level day (the employee's team has a lead - a team-level approver
 *    assigned to the team): the team lead (or another team/all approver whose
 *    scope covers the employee) gives the FIRST approval; HR (`.all`) gives
 *    the SECOND, which is final. A day submitted before team-lead routing
 *    (basis REPORTING_MANAGER) can still take its first approval from the
 *    reporting manager.
 *  - One-level day (a team lead's own day, or a team with no lead): HR
 *    (`.all`) decides alone.
 *  - HR may decide a two-level day that has no first approval yet directly (for
 *    example when the manager is away) — an override, recorded as such. Not when
 *    the HR approver is the employee's own manager: then they give the first
 *    approval and a different HR approver gives the second.
 *  - Nobody decides their own day, or one they submitted.
 *  - A person with no authority over the employee does not see the day at all
 *    (NOT_VISIBLE → 404).
 */

export interface ApprovalFacts {
  approvalLevels: 1 | 2;
  firstDecidedAt: Date | null;
  firstDecidedBy: number | null;
  actorUserId: number;
  employeeUserId: number | null;
  submittedByUserId: number | null;
  /** The actor is the employee's reporting manager. */
  isManager: boolean;
  /** The actor's `hr.timesheet.approve` scope is team/all and covers the employee. */
  inScope: boolean;
  scopeLevel: "own" | "team" | "all";
}

export type ApprovalRefusal =
  | "NOT_VISIBLE"
  | "SELF"
  | "SUBMITTER"
  | "HR_ONLY"
  | "AWAITING_HR"
  | "SAME_APPROVER";

export type ApprovalVerdict =
  | { ok: true; stage: 1 | 2; final: boolean; override: boolean }
  | { ok: false; reason: ApprovalRefusal };

export function approvalVerdict(f: ApprovalFacts): ApprovalVerdict {
  if (!f.isManager && !f.inScope) return { ok: false, reason: "NOT_VISIBLE" };
  if (f.employeeUserId !== null && f.employeeUserId === f.actorUserId) {
    return { ok: false, reason: "SELF" };
  }
  if (f.submittedByUserId !== null && f.submittedByUserId === f.actorUserId) {
    return { ok: false, reason: "SUBMITTER" };
  }
  const hr = f.inScope && f.scopeLevel === "all";

  if (f.approvalLevels === 1) {
    return hr
      ? { ok: true, stage: 1, final: true, override: false }
      : { ok: false, reason: "HR_ONLY" };
  }

  if (f.firstDecidedAt === null) {
    // First approval pending: the manager / team approver, or HR overriding.
    if (hr && !f.isManager) {
      return { ok: true, stage: 1, final: true, override: true };
    }
    return { ok: true, stage: 1, final: false, override: false };
  }

  if (!hr) return { ok: false, reason: "AWAITING_HR" };
  if (f.firstDecidedBy === f.actorUserId) {
    return { ok: false, reason: "SAME_APPROVER" };
  }
  return { ok: true, stage: 2, final: true, override: false };
}

export const APPROVAL_REFUSAL_MESSAGE: Record<
  Exclude<ApprovalRefusal, "NOT_VISIBLE">,
  string
> = {
  SELF: "You cannot decide your own timesheet",
  SUBMITTER: "The person who submitted a timesheet cannot decide it",
  HR_ONLY: "This timesheet has no reporting manager, so only HR can decide it",
  AWAITING_HR: "This timesheet has its first approval and now waits for HR",
  SAME_APPROVER:
    "A different HR approver must give the second approval of this timesheet",
};

// ---------------------------------------------------------------------------
// The day as one unit
// ---------------------------------------------------------------------------

export type DayWorkflowStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Submit and every decision act on all rows of an employee-day together, so
 * the rows normally share a status. A returned (REJECTED) day can gain a new
 * draft row before it is resubmitted: the day is then still "returned". null
 * for a day with no rows. */
export function dayWorkflowStatus(
  statuses: readonly string[],
): DayWorkflowStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("SUBMITTED")) return "SUBMITTED";
  if (statuses.includes("REJECTED")) return "REJECTED";
  if (statuses.every((s) => s === "APPROVED")) return "APPROVED";
  return "DRAFT";
}

/** Who a submitted day is waiting for. */
export type ReviewStage = "MANAGER" | "HR";

export function reviewStage(day: {
  status: DayWorkflowStatus | null;
  approvalLevels: number;
  firstDecidedAt: Date | null;
}): ReviewStage | null {
  if (day.status !== "SUBMITTED") return null;
  if (day.approvalLevels === 2 && day.firstDecidedAt === null) return "MANAGER";
  return "HR";
}
