/**
 * Pure rules for the CRM notification generator - a port of legacy
 * `domain/domainNotificationService.ts` + `notifications/crmNotificationService.ts`
 * (candidate building and the idempotent diff/transition logic), reading the
 * relational model instead of Firebase. No I/O here so it is unit-testable.
 *
 * Day maths is done on UTC calendar days (legacy used the browser's local day).
 * `dueDate` is always stored as a UTC-midnight day so the DB dedupe key
 * (org, sourceType, sourceId, type, dueDate) is stable across refreshes.
 */

export const DAY_MS = 86_400_000;

export const NOTIFICATION_TYPES = [
  "meeting-tomorrow",
  "meeting-today",
  "meeting-overdue",
  "meeting-rescheduled",
  "followup-due",
  "followup-overdue",
  "task-due",
  "task-overdue",
  "callback-due",
  "callback-overdue",
  "keepintouch-due",
  "keepintouch-overdue",
  "opportunity-stuck",
  "quotation-pending",
  "expected-close-near",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SOURCE_TYPES = [
  "meeting",
  "followUp",
  "task",
  "opportunity",
  "quotation",
  "account",
] as const;
export type NotificationSourceType = (typeof NOTIFICATION_SOURCE_TYPES)[number];

export type NotificationStatus =
  "Pending" | "Acknowledged" | "Done" | "Snoozed" | "Overdue";
export type NotificationPriority = "high" | "medium" | "low";

export function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}
/** UTC midnight of the date's calendar day. */
export function dayStart(d: Date): Date {
  return new Date(dayIndex(d) * DAY_MS);
}
export function diffInDays(due: Date, now: Date): number {
  return dayIndex(due) - dayIndex(now);
}
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface NotificationCandidate {
  sourceType: NotificationSourceType;
  sourceId: number;
  type: NotificationType;
  title: string;
  description: string;
  accountId: number | null;
  companyName: string | null;
  prospectName: string | null;
  dueDate: Date;
  priority: NotificationPriority;
  /** Days from today to the due day (negative = overdue). */
  diffDays: number;
}

export interface RelatedRef {
  companyName: string;
  accountId: number | null;
}

export interface ScanData {
  now: Date;
  meetings: {
    id: number;
    relatedType: string;
    relatedId: number;
    mode: string;
    meetingDate: Date;
    startTime: string | null;
    status: string;
  }[];
  followUps: {
    id: number;
    relatedType: string;
    relatedId: number;
    type: string;
    scheduledAt: Date;
    assignedTo: string;
    status: string;
  }[];
  tasks: {
    id: number;
    relatedType: string;
    relatedId: number;
    title: string;
    dueDate: Date;
    assignedTo: string;
    status: string;
  }[];
  opportunities: {
    id: number;
    accountId: number;
    title: string;
    status: string;
    stageEnteredAt: Date;
    expectedCloseDate: Date | null;
    stage: { label: string; slaDays: number | null };
  }[];
  quotations: {
    id: number;
    accountId: number;
    quotationNumber: string;
    status: string;
    createdAt: Date;
  }[];
  accounts: {
    id: number;
    name: string;
    statusTag: string | null;
    statusDate: Date | null;
  }[];
  accountName: (accountId: number) => string;
  resolveRelated: (relatedType: string, relatedId: number) => RelatedRef;
}

export const STUCK_THRESHOLD_DAYS = { delayed: 7, critical: 14 };

export type OpportunityHealth = "Healthy" | "Delayed" | "Critical";

/** Legacy `computeOpportunityHealth` (a stage's `slaDays` overrides the global thresholds). */
export function computeOpportunityHealth(
  stageEnteredAt: Date,
  status: string,
  now: Date,
  slaDays: number | null,
): { health: OpportunityHealth; delayedAfter: number; criticalAfter: number } {
  const delayedAfter = slaDays ?? STUCK_THRESHOLD_DAYS.delayed;
  const criticalAfter = slaDays ? slaDays * 2 : STUCK_THRESHOLD_DAYS.critical;
  if (status !== "OPEN")
    return { health: "Healthy", delayedAfter, criticalAfter };
  const ageDays = (now.getTime() - stageEnteredAt.getTime()) / DAY_MS;
  const health: OpportunityHealth =
    ageDays >= criticalAfter
      ? "Critical"
      : ageDays >= delayedAfter
        ? "Delayed"
        : "Healthy";
  return { health, delayedAfter, criticalAfter };
}

function timeSuffix(time: string | null) {
  return time ? ` at ${time}` : "";
}

export function buildCandidates(data: ScanData): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];
  const { now } = data;

  // --- Meetings (legacy meetingCandidates) ---
  for (const m of data.meetings) {
    if (m.status === "CANCELLED" || m.status === "COMPLETED") continue;
    const rel = data.resolveRelated(m.relatedType, m.relatedId);
    const company = rel.companyName;
    const due = dayStart(m.meetingDate);
    if (m.status === "RESCHEDULED") {
      out.push({
        sourceType: "meeting",
        sourceId: m.id,
        type: "meeting-rescheduled",
        title: `Meeting Rescheduled — ${company}`,
        description: `New date: ${isoDay(due)}${timeSuffix(m.startTime)}`,
        accountId: rel.accountId,
        companyName: company,
        prospectName: null,
        dueDate: due,
        priority: "medium",
        diffDays: 0,
      });
      continue;
    }
    const diffDays = diffInDays(due, now);
    if (diffDays > 1) continue;
    const type: NotificationType =
      diffDays === 1
        ? "meeting-tomorrow"
        : diffDays === 0
          ? "meeting-today"
          : "meeting-overdue";
    const title =
      diffDays === 1
        ? `Meeting Reminder — ${company} has a meeting tomorrow`
        : diffDays === 0
          ? `Meeting Today — ${company}`
          : `Meeting Overdue — ${company}'s meeting has passed`;
    out.push({
      sourceType: "meeting",
      sourceId: m.id,
      type,
      title,
      description: `${m.mode} meeting${timeSuffix(m.startTime)}`,
      accountId: rel.accountId,
      companyName: company,
      prospectName: null,
      dueDate: due,
      priority: "high",
      diffDays,
    });
  }

  // --- Follow-ups (legacy followUpCandidates) ---
  for (const f of data.followUps) {
    if (f.status === "COMPLETED" || f.status === "CANCELLED") continue;
    const due = dayStart(f.scheduledAt);
    const diffDays = diffInDays(due, now);
    if (diffDays > 1) continue;
    const overdue = diffDays < 0;
    const rel = data.resolveRelated(f.relatedType, f.relatedId);
    out.push({
      sourceType: "followUp",
      sourceId: f.id,
      type: overdue ? "followup-overdue" : "followup-due",
      title: overdue
        ? `Follow-up Overdue — ${rel.companyName}`
        : `Follow-up Due — ${rel.companyName}`,
      description: `${f.type} follow-up assigned to ${f.assignedTo}`,
      accountId: rel.accountId,
      companyName: rel.companyName,
      prospectName: null,
      dueDate: due,
      priority: overdue ? "high" : "medium",
      diffDays,
    });
  }

  // --- Tasks (same shape as follow-ups; open tasks only) ---
  for (const t of data.tasks) {
    if (t.status !== "Open") continue;
    const due = dayStart(t.dueDate);
    const diffDays = diffInDays(due, now);
    if (diffDays > 1) continue;
    const overdue = diffDays < 0;
    const rel = data.resolveRelated(t.relatedType, t.relatedId);
    out.push({
      sourceType: "task",
      sourceId: t.id,
      type: overdue ? "task-overdue" : "task-due",
      title: overdue ? `Task Overdue — ${t.title}` : `Task Due — ${t.title}`,
      description: `${rel.companyName} · assigned to ${t.assignedTo}`,
      accountId: rel.accountId,
      companyName: rel.companyName,
      prospectName: null,
      dueDate: due,
      priority: overdue ? "high" : "medium",
      diffDays,
    });
  }

  // --- Opportunities (legacy opportunityCandidates) ---
  for (const o of data.opportunities) {
    if (o.status !== "OPEN") continue;
    const company = data.accountName(o.accountId);
    const { health, delayedAfter, criticalAfter } = computeOpportunityHealth(
      o.stageEnteredAt,
      o.status,
      now,
      o.stage.slaDays,
    );
    if (health !== "Healthy") {
      // Legacy dated this "today" and detected change via `${stage}_${health}`;
      // here the due day is the day the current health level was reached, which
      // is stable per (stage entry, health) and changes when either changes.
      const threshold = health === "Critical" ? criticalAfter : delayedAfter;
      out.push({
        sourceType: "opportunity",
        sourceId: o.id,
        type: "opportunity-stuck",
        title: `Opportunity Stuck (${health}) — ${o.title}`,
        description: `${company} · in "${o.stage.label}" stage`,
        accountId: o.accountId,
        companyName: company,
        prospectName: null,
        dueDate: dayStart(
          new Date(o.stageEnteredAt.getTime() + threshold * DAY_MS),
        ),
        priority: health === "Critical" ? "high" : "medium",
        diffDays: 0,
      });
    }
    if (o.expectedCloseDate) {
      const close = dayStart(o.expectedCloseDate);
      const diffDays = diffInDays(close, now);
      if (diffDays >= 0 && diffDays <= 3) {
        out.push({
          sourceType: "opportunity",
          sourceId: o.id,
          type: "expected-close-near",
          title: `Expected Close Approaching — ${o.title}`,
          description: `${company} · expected to close ${isoDay(close)}`,
          accountId: o.accountId,
          companyName: company,
          prospectName: null,
          dueDate: close,
          priority: "medium",
          diffDays,
        });
      }
    }
  }

  // --- Quotations (legacy quotationCandidates: "Sent" for 3+ days) ---
  for (const q of data.quotations) {
    if (q.status !== "Sent") continue;
    const ageDays = (now.getTime() - q.createdAt.getTime()) / DAY_MS;
    if (ageDays < 3) continue;
    const company = data.accountName(q.accountId);
    out.push({
      sourceType: "quotation",
      sourceId: q.id,
      type: "quotation-pending",
      title: `Quotation Pending Response — ${q.quotationNumber}`,
      description: `${company} · sent ${Math.floor(ageDays)} day(s) ago, no response yet`,
      accountId: q.accountId,
      companyName: company,
      prospectName: null,
      // Stable: the day the quotation crossed the 3-day mark.
      dueDate: dayStart(new Date(q.createdAt.getTime() + 3 * DAY_MS)),
      priority: "medium",
      diffDays: 0,
    });
  }

  // --- Account status-tag follow-ups (legacy Call Back-Send Info / Keep in Touch) ---
  for (const a of data.accounts) {
    if (!a.statusDate) continue;
    const isCallback =
      a.statusTag === "Call Back" || a.statusTag === "Send Info";
    const isKeep = a.statusTag === "Keep in Touch";
    if (!isCallback && !isKeep) continue;
    const due = dayStart(a.statusDate);
    const diffDays = diffInDays(due, now);
    if (diffDays > 1) continue;
    const overdue = diffDays < 0;
    const label = isCallback ? "Callback" : "Keep in Touch";
    out.push({
      sourceType: "account",
      sourceId: a.id,
      type: isCallback
        ? overdue
          ? "callback-overdue"
          : "callback-due"
        : overdue
          ? "keepintouch-overdue"
          : "keepintouch-due",
      title: overdue
        ? `${label} Overdue — ${a.name}`
        : `${label} Due Today — ${a.name}`,
      description: `Follow up with ${a.name}. Next follow-up: ${isoDay(due)}`,
      accountId: a.id,
      companyName: a.name,
      prospectName: null,
      dueDate: due,
      priority: overdue ? "high" : "medium",
      diffDays,
    });
  }

  return out;
}

export interface ExistingNotification {
  id: number;
  dueDate: Date;
  status: string;
  snoozeUntil: Date | null;
  deletedAt: Date | null;
}

export type ReconcileResult = {
  kind: "reset" | "patch";
  data: Record<string, unknown>;
} | null;

const statusFor = (diffDays: number): NotificationStatus =>
  diffDays < 0 ? "Overdue" : "Pending";

/**
 * Idempotent diff of one candidate against its existing row (same identity:
 * org + sourceType + sourceId + type). Never touches a Done row, never
 * resurrects a recycled one, and treats a changed due day as a fresh instance
 * (legacy `sourceDueRaw` mismatch branch).
 */
export function reconcile(
  existing: ExistingNotification,
  c: NotificationCandidate,
  now: Date,
): ReconcileResult {
  if (dayIndex(existing.dueDate) !== dayIndex(c.dueDate)) {
    return {
      kind: "reset",
      data: {
        dueDate: c.dueDate,
        title: c.title,
        description: c.description,
        accountId: c.accountId,
        companyName: c.companyName,
        prospectName: c.prospectName,
        priority: c.priority,
        status: statusFor(c.diffDays),
        acknowledgedAt: null,
        completedAt: null,
        snoozeUntil: null,
        isRead: false,
        deletedAt: null,
      },
    };
  }
  if (existing.deletedAt) return null;
  if (existing.status === "Done") return null;
  if (existing.status === "Snoozed") {
    if (
      existing.snoozeUntil &&
      now.getTime() >= existing.snoozeUntil.getTime()
    ) {
      return {
        kind: "patch",
        data: { status: statusFor(c.diffDays), snoozeUntil: null },
      };
    }
    return null;
  }
  if (
    (existing.status === "Pending" || existing.status === "Acknowledged") &&
    c.diffDays < 0
  ) {
    return { kind: "patch", data: { status: "Overdue", priority: "high" } };
  }
  return null;
}
