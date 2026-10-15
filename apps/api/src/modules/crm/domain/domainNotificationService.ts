// CRM Core Domain — notification generation for the new relational collections (meetings,
// follow-ups, opportunities, quotations). Mirrors `notifications/crmNotificationService.ts`'s
// idempotent, action-preserving diff/update approach exactly, but reads from the domain
// collections instead of the 6 legacy sheet tabs, and writes into the SAME
// `crm/notifications/feed` path — so the existing bell UI (`CrmNotificationBell.tsx`) shows both
// kinds of notification with no changes of its own.
import { ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import {
  CrmNotification,
  CrmNotificationFeed,
  CrmNotificationPriority,
  CrmNotificationType,
} from "../notifications/types";
import { diffInDays, parseLooseDate, toISO } from "../notifications/dateUtils";
import { CRM_NOTIFICATIONS_FEED_PATH } from "../notifications/crmNotificationService";
import { computeOpportunityHealth } from "./config";
import {
  CrmFollowUp,
  CrmMeeting,
  CrmOpportunity,
  CrmQuotation,
  CrmRelatedType,
} from "./types";

interface DomainCandidate {
  key: string;
  sourceTab:
    | "domainMeetings"
    | "domainFollowUps"
    | "domainOpportunities"
    | "domainQuotations";
  sourceRowId: string;
  sourceDueRaw: string;
  relatedTabLabel: string;
  type: CrmNotificationType;
  title: string;
  description: string;
  companyName?: string;
  /** The real CRM Core Domain Account id, threaded through to `CrmNotification.accountId` so
   *  `useNotificationAuditObserver.ts` can key its audit entries by the same id Company 360
   *  profiles actually use, instead of a slug of `companyName` that never matches a domain Account. */
  accountId?: string;
  dueDate: string;
  priority: CrmNotificationPriority;
  diffDays: number;
}

function makeKey(
  sourceTab: DomainCandidate["sourceTab"],
  sourceRowId: string,
  kind: string,
): string {
  return `${sourceTab}_${sourceRowId}_${kind}`;
}

function meetingCandidates(
  meetings: CrmMeeting[],
  accountName: (id: string) => string,
  resolveAccountId: (
    relatedType: CrmRelatedType,
    relatedId: string,
  ) => string | undefined,
): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  meetings.forEach((m) => {
    if (m.status === "CANCELLED" || m.status === "COMPLETED") return;
    const company = accountName(m.relatedId);
    const accountId = resolveAccountId(m.relatedType, m.relatedId);

    if (m.status === "RESCHEDULED") {
      out.push({
        key: makeKey("domainMeetings", m.id, "meeting-rescheduled"),
        sourceTab: "domainMeetings",
        sourceRowId: m.id,
        sourceDueRaw: m.date,
        relatedTabLabel: "Meetings",
        type: "meeting-rescheduled",
        title: `Meeting Rescheduled — ${company}`,
        description: `New date: ${m.date}${m.startTime ? ` at ${m.startTime}` : ""}`,
        companyName: company,
        accountId,
        dueDate: m.date,
        priority: "medium",
        diffDays: 0,
      });
      return;
    }

    const due = parseLooseDate(m.date);
    if (!due) return;
    const diffDays = diffInDays(due);
    if (diffDays > 1) return;
    const kind: CrmNotificationType =
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
      key: makeKey("domainMeetings", m.id, kind),
      sourceTab: "domainMeetings",
      sourceRowId: m.id,
      sourceDueRaw: m.date,
      relatedTabLabel: "Meetings",
      type: kind,
      title,
      description: `${m.mode} meeting${m.startTime ? ` at ${m.startTime}` : ""}`,
      companyName: company,
      accountId,
      dueDate: toISO(due),
      priority: "high",
      diffDays,
    });
  });
  return out;
}

function followUpCandidates(
  followUps: CrmFollowUp[],
  accountName: (id: string) => string,
  resolveAccountId: (
    relatedType: CrmRelatedType,
    relatedId: string,
  ) => string | undefined,
): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  followUps.forEach((f) => {
    if (f.status === "COMPLETED" || f.status === "CANCELLED") return;
    const due = parseLooseDate(f.scheduledAt);
    if (!due) return;
    const diffDays = diffInDays(due);
    if (diffDays > 1) return;
    const isOverdue = diffDays < 0;
    const company = accountName(f.relatedId);
    out.push({
      key: makeKey(
        "domainFollowUps",
        f.id,
        isOverdue ? "followup-overdue" : "followup-due",
      ),
      sourceTab: "domainFollowUps",
      sourceRowId: f.id,
      sourceDueRaw: f.scheduledAt,
      relatedTabLabel: "Follow-ups",
      type: isOverdue ? "followup-overdue" : "followup-due",
      title: isOverdue
        ? `Follow-up Overdue — ${company}`
        : `Follow-up Due — ${company}`,
      description: `${f.type} follow-up assigned to ${f.assignedTo}`,
      companyName: company,
      accountId: resolveAccountId(f.relatedType, f.relatedId),
      dueDate: toISO(due),
      priority: isOverdue ? "high" : "medium",
      diffDays,
    });
  });
  return out;
}

function opportunityCandidates(
  opportunities: CrmOpportunity[],
  accountName: (id: string) => string,
  slaFor: (stageId: string) => number | undefined,
): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  opportunities.forEach((o) => {
    if (o.status !== "OPEN") return;
    const company = accountName(o.accountId);

    const health = computeOpportunityHealth(
      o.stageEnteredAt,
      o.status,
      slaFor(o.stage),
    );
    if (health !== "Healthy") {
      out.push({
        key: makeKey("domainOpportunities", o.id, "opportunity-stuck"),
        sourceTab: "domainOpportunities",
        sourceRowId: o.id,
        sourceDueRaw: `${o.stage}_${health}`,
        relatedTabLabel: "Pipeline",
        type: "opportunity-stuck",
        title: `Opportunity Stuck (${health}) — ${o.title}`,
        description: `${company} · in "${o.stage.replace("_", " ")}" stage`,
        companyName: company,
        accountId: o.accountId,
        dueDate: toISO(new Date()),
        priority: health === "Critical" ? "high" : "medium",
        diffDays: 0,
      });
    }

    const closeDate = parseLooseDate(o.expectedCloseDate);
    if (closeDate) {
      const diffDays = diffInDays(closeDate);
      if (diffDays >= 0 && diffDays <= 3) {
        out.push({
          key: makeKey("domainOpportunities", o.id, "expected-close-near"),
          sourceTab: "domainOpportunities",
          sourceRowId: o.id,
          sourceDueRaw: o.expectedCloseDate || "",
          relatedTabLabel: "Pipeline",
          type: "expected-close-near",
          title: `Expected Close Approaching — ${o.title}`,
          description: `${company} · expected to close ${o.expectedCloseDate}`,
          companyName: company,
          accountId: o.accountId,
          dueDate: toISO(closeDate),
          priority: "medium",
          diffDays,
        });
      }
    }
  });
  return out;
}

function quotationCandidates(
  quotations: CrmQuotation[],
  accountName: (id: string) => string,
): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  const now = Date.now();
  quotations.forEach((q) => {
    if (q.status !== "Sent") return;
    const ageDays = (now - q.createdAt) / 86400000;
    if (ageDays < 3) return;
    const company = accountName(q.accountId);
    out.push({
      key: makeKey("domainQuotations", q.id, "quotation-pending"),
      sourceTab: "domainQuotations",
      sourceRowId: q.id,
      sourceDueRaw: q.status,
      relatedTabLabel: "Quotations",
      type: "quotation-pending",
      title: `Quotation Pending Response — ${q.quotationNumber}`,
      description: `${company} · sent ${Math.floor(ageDays)} day(s) ago, no response yet`,
      companyName: company,
      accountId: q.accountId,
      dueDate: toISO(new Date()),
      priority: "medium",
      diffDays: 0,
    });
  });
  return out;
}

export function buildDomainNotificationSyncUpdates(
  data: {
    meetings: CrmMeeting[];
    followUps: CrmFollowUp[];
    opportunities: CrmOpportunity[];
    quotations: CrmQuotation[];
    accountName: (id: string) => string;
    resolveAccountId: (
      relatedType: CrmRelatedType,
      relatedId: string,
    ) => string | undefined;
    slaFor?: (stageId: string) => number | undefined;
  },
  currentFeed: CrmNotificationFeed,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const now = Date.now();
  const candidates = [
    ...meetingCandidates(
      data.meetings,
      data.accountName,
      data.resolveAccountId,
    ),
    ...followUpCandidates(
      data.followUps,
      data.accountName,
      data.resolveAccountId,
    ),
    ...opportunityCandidates(
      data.opportunities,
      data.accountName,
      data.slaFor || (() => undefined),
    ),
    ...quotationCandidates(data.quotations, data.accountName),
  ];

  for (const c of candidates) {
    const existing = currentFeed[c.key];
    const base = `${CRM_NOTIFICATIONS_FEED_PATH}/${c.key}`;

    if (!existing) {
      const notif: CrmNotification = {
        id: c.key,
        sourceTab: c.sourceTab,
        sourceRowId: c.sourceRowId,
        sourceDueRaw: c.sourceDueRaw,
        relatedTabLabel: c.relatedTabLabel,
        type: c.type,
        title: c.title,
        description: c.description,
        companyName: c.companyName,
        // Firebase `update()` rejects `undefined` outright — `resolveAccountId` legitimately
        // returns undefined for non-domain relations (e.g. a lead), so that must become RTDB's
        // own "no value" idiom (`null`) here rather than reach the write as `undefined`.
        accountId: c.accountId ?? null,
        dueDate: c.dueDate,
        createdAt: now,
        updatedAt: now,
        status: c.diffDays < 0 ? "Overdue" : "Pending",
        priority: c.priority,
      };
      updates[base] = notif;
      continue;
    }

    if (existing.sourceDueRaw !== c.sourceDueRaw) {
      // The underlying row's due-date field was edited — treat as a fresh instance, same as
      // crmNotificationService.ts's equivalent branch: reset `isRead` too, or a materially new
      // alert (new title/description/due date) never re-flags the bell badge for a notification
      // that had already been marked read before the reschedule.
      updates[base] = {
        ...existing,
        sourceDueRaw: c.sourceDueRaw,
        title: c.title,
        description: c.description,
        accountId: c.accountId ?? null,
        dueDate: c.dueDate,
        priority: c.priority,
        status: c.diffDays < 0 ? "Overdue" : "Pending",
        updatedAt: now,
        acknowledgedAt: null,
        completedAt: null,
        snoozeUntil: null,
        isRead: false,
      };
      continue;
    }

    if (existing.status === "Done") continue;

    if (existing.status === "Snoozed") {
      if (existing.snoozeUntil && now >= existing.snoozeUntil) {
        updates[`${base}/status`] = c.diffDays < 0 ? "Overdue" : "Pending";
        updates[`${base}/snoozeUntil`] = null;
        updates[`${base}/updatedAt`] = now;
      }
      continue;
    }

    if (
      (existing.status === "Pending" || existing.status === "Acknowledged") &&
      c.diffDays < 0
    ) {
      updates[`${base}/status`] = "Overdue";
      updates[`${base}/priority`] = "high";
      updates[`${base}/updatedAt`] = now;
    }
  }

  return updates;
}

export async function syncDomainNotifications(
  data: {
    meetings: CrmMeeting[];
    followUps: CrmFollowUp[];
    opportunities: CrmOpportunity[];
    quotations: CrmQuotation[];
    accountName: (id: string) => string;
    resolveAccountId: (
      relatedType: CrmRelatedType,
      relatedId: string,
    ) => string | undefined;
    slaFor?: (stageId: string) => number | undefined;
  },
  currentFeed: CrmNotificationFeed,
): Promise<void> {
  const updates = buildDomainNotificationSyncUpdates(data, currentFeed);
  if (Object.keys(updates).length === 0) return;
  await update(ref(database), updates);
}
