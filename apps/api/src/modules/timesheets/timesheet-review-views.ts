import {
  dayWorkflowStatus,
  reviewStage,
  type DayWorkflowStatus,
  type ReviewStage,
} from "./timesheet-approval.js";
import { summarizeDay } from "./timesheet-views.js";
import type { ReviewRow } from "./timesheet-workflow.repository.js";

/**
 * Pure grouping of review rows into employee-days (no I/O; unit-tested in
 * timesheet-review-views.spec.ts). A day is the unit that is submitted and
 * decided, so a review list shows one line per employee per date.
 */

export interface DaySummary {
  employee: { id: number; code: string; name: string; team: string };
  date: string;
  status: DayWorkflowStatus;
  /** Who a submitted day is waiting for; null once decided. */
  stage: ReviewStage | null;
  approvalLevels: 1 | 2;
  approverBasis: string | null;
  submittedAt: Date | null;
  firstApprovedAt: Date | null;
  firstApprovalNote: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  totalMinutes: number;
  taskMinutes: number;
  customMinutes: number;
  rowCount: number;
  /** Some session on the day needs a reviewer's look (stale or flagged). */
  needsAttention: boolean;
  /** Recorded in this system (not imported legacy history): only native days
   * count as "not submitted yet". */
  native: boolean;
}

/** What the caller's authority is judged on — kept beside, never sent out. */
export interface DayFacts {
  employeeUserId: number | null;
  managerUserId: number | null;
  teamId: number;
  submittedBy: number | null;
  firstDecidedBy: number | null;
}

export interface GroupedDay {
  summary: DaySummary;
  facts: DayFacts;
}

const dateOf = (d: Date) => d.toISOString().slice(0, 10);

export function groupDays(rows: readonly ReviewRow[]): GroupedDay[] {
  const order: string[] = [];
  const byKey = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    const key = `${row.employeeId}|${dateOf(row.workDate)}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else {
      byKey.set(key, [row]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const day = byKey.get(key)!;
    const lead = day.find((r) => r.status === "SUBMITTED") ?? day[0]!;
    const status = dayWorkflowStatus(day.map((r) => r.status)) ?? "DRAFT";
    const totals = summarizeDay(
      day.map((r) => ({
        category: r.category,
        sessions: r.sessions,
        durationMinutes: r.durationMinutes,
        endedAt: r.endedAt,
      })),
    );
    const levels = lead.approvalLevels === 2 ? 2 : 1;
    return {
      summary: {
        employee: {
          id: lead.employee.id,
          code: lead.employee.employeeCode,
          name: lead.employee.fullName,
          team: lead.employee.team.name,
        },
        date: dateOf(lead.workDate),
        status,
        stage: reviewStage({
          status,
          approvalLevels: levels,
          firstDecidedAt: lead.firstDecidedAt,
        }),
        approvalLevels: levels,
        approverBasis: lead.approverBasis,
        submittedAt: lead.submittedAt,
        firstApprovedAt: lead.firstDecidedAt,
        firstApprovalNote: lead.firstDecisionNote,
        decidedAt: lead.decidedAt,
        decisionNote: lead.decisionNote,
        totalMinutes: totals.totalMinutes,
        taskMinutes: totals.taskMinutes,
        customMinutes: totals.customMinutes,
        rowCount: totals.rowCount,
        needsAttention: day.some((r) =>
          r.sessions.some((s) => s.reviewState !== "OK"),
        ),
        native: day.every((r) => r.origin === "NATIVE"),
      },
      facts: {
        employeeUserId: lead.employee.userId,
        // Only a day routed to the reporting manager (before team-lead
        // routing) is theirs to decide; newer days go to the team lead.
        managerUserId:
          lead.approverBasis === "REPORTING_MANAGER"
            ? (lead.employee.reportsTo?.userId ?? null)
            : null,
        teamId: lead.employee.teamId,
        submittedBy: lead.submittedBy,
        firstDecidedBy: lead.firstDecidedBy,
      },
    };
  });
}
