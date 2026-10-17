/**
 * Pure derivation of the legacy "Overall Data" daily tracker
 * (`useOverallDataLive.ts`): 9 fixed disposition rows x day-of-month, each
 * cell's count being exactly the number of real records behind it.
 * Day keys are bucketed in Asia/Kolkata (as legacy), so late-night IST work
 * never slips into the adjacent UTC day.
 */

export const OVERALL_ROWS = [
  { key: "accountsMined", label: "Accounts Mined" },
  { key: "emailsSent", label: "E-mails sent for the day" },
  { key: "meetingsScheduled", label: "Meeting Scheduled" },
  { key: "meetingsCompleted", label: "Meeting Completed" },
  { key: "meetingsCancelled", label: "Meeting Cancelled" },
  { key: "sendInfoCallBacks", label: "Send Info / Call Backs" },
  { key: "followUp", label: "Follow-up (Keep in Touch)" },
  { key: "notInterested", label: "Not Interested" },
  { key: "callsMade", label: "Calls made for the Day" },
] as const;

export type OverallRowKey = (typeof OVERALL_ROWS)[number]["key"];

/** Which owning entity a record belongs to — drives drill-down delete
 * routing (each entity keeps its own `*.delete` permission). `audit` rows
 * are never deletable (legacy: audit trail is immutable). */
export type OverallRecordType =
  "mining_row" | "cold_calling_entry" | "activity" | "meeting" | "audit";

export interface OverallActivityRecord {
  id: string;
  recordType: OverallRecordType;
  recordId: number;
  /** ISO timestamp the record is bucketed by. */
  at: string;
  time: string;
  owner: string;
  accountId?: number | undefined;
  accountName?: string | undefined;
  contactId?: number | undefined;
  contactName?: string | undefined;
  action: string;
  status?: string | undefined;
  source?: string | undefined;
  notes?: string | undefined;
  dueDate?: string | undefined;
  completedDate?: string | undefined;
  viewPath?: string | undefined;
}

export type RecordsByRowAndDay = Record<
  OverallRowKey,
  Record<string, OverallActivityRecord[]>
>;

// ---- raw inputs (already loaded + name-resolved by the repository) ----
export interface MiningInput {
  id: number;
  createdAt: Date;
  owner: string;
  companyName: string;
  keyDecisionMakers: string | null;
  followUpStatus: string | null;
  emailStatus: string | null;
  notes: string | null;
}
export interface ColdCallInput {
  id: number;
  createdAt: Date;
  owner: string;
  linkedAccountId: number | null;
  accountName: string;
  prospectName: string | null;
  status: string | null;
}
export interface ActivityInput {
  id: number;
  type: string;
  subject: string;
  direction: string | null;
  notes: string | null;
  occurredAt: Date;
  owner: string;
  accountId: number | undefined;
  accountName: string | undefined;
  contactId: number | undefined;
  contactName: string | undefined;
}
export interface MeetingInput {
  id: number;
  mode: string;
  status: string;
  meetingDate: Date;
  startTime: string | null;
  agenda: string | null;
  summary: string | null;
  nextStep: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  owner: string;
  accountId: number | undefined;
  accountName: string | undefined;
  contactId: number | undefined;
  contactName: string | undefined;
}
export interface StatusChangeInput {
  id: number;
  at: Date;
  owner: string;
  accountId: number;
  accountName: string | undefined;
  statusTag: string;
  reason: string | null;
  dueDate?: string | undefined;
}

export interface OverallSources {
  mining: MiningInput[];
  coldCalls: ColdCallInput[];
  activities: ActivityInput[];
  meetings: MeetingInput[];
  statusChanges: StatusChangeInput[];
}

const DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function istDayKey(d: Date): string {
  return DAY_FORMATTER.format(d);
}
function istTime(d: Date): string {
  return TIME_FORMATTER.format(d).toUpperCase();
}
function dmy(d: Date): string {
  const [y, m, day] = istDayKey(d).split("-") as [string, string, string];
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function emptyRecords(): RecordsByRowAndDay {
  return {
    accountsMined: {},
    emailsSent: {},
    meetingsScheduled: {},
    meetingsCompleted: {},
    meetingsCancelled: {},
    sendInfoCallBacks: {},
    followUp: {},
    notInterested: {},
    callsMade: {},
  };
}

/** UTC window that safely over-covers an IST calendar month — the
 * repository loads this range, `deriveOverallData` does the exact filter. */
export function monthQueryWindow(
  year: number,
  month: number,
): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1) - 86400000),
    to: new Date(Date.UTC(year, month, 1) + 86400000),
  };
}

export function monthDayKeys(year: number, month: number): string[] {
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return Array.from(
    { length: n },
    (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, "0")}`,
  );
}

export function deriveOverallData(
  src: OverallSources,
  year: number,
  month: number,
): RecordsByRowAndDay {
  const records = emptyRecords();
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const push = (
    row: OverallRowKey,
    at: Date,
    rec: Omit<OverallActivityRecord, "at" | "time">,
  ) => {
    const dayKey = istDayKey(at);
    if (!dayKey.startsWith(monthPrefix)) return;
    const bucket = records[row];
    (bucket[dayKey] ??= []).push({
      ...rec,
      at: at.toISOString(),
      time: istTime(at),
    });
  };
  const accountPath = (id: number | undefined) =>
    id ? `/crm/accounts/${id}` : undefined;

  for (const r of src.mining) {
    push("accountsMined", r.createdAt, {
      id: `mining_${r.id}`,
      recordType: "mining_row",
      recordId: r.id,
      owner: r.owner,
      accountName: r.companyName || "—",
      contactName: r.keyDecisionMakers ?? undefined,
      action: "Accounts Mined",
      status: r.followUpStatus ?? r.emailStatus ?? undefined,
      source: "Accounts Mining Sheet",
      notes: r.notes ?? undefined,
    });
  }

  for (const r of src.coldCalls) {
    push("callsMade", r.createdAt, {
      id: `coldCalling_${r.id}`,
      recordType: "cold_calling_entry",
      recordId: r.id,
      owner: r.owner,
      accountId: r.linkedAccountId ?? undefined,
      accountName: r.accountName || "—",
      contactName: r.prospectName ?? undefined,
      action: "Cold Call",
      status: r.status ?? undefined,
      source: "Cold Calling Status",
      notes: r.status ?? undefined,
      viewPath: r.linkedAccountId
        ? accountPath(r.linkedAccountId)
        : "/crm/cold-calling-status",
    });
  }

  for (const a of src.activities) {
    if (a.type !== "Email" && a.type !== "Call") continue;
    push(a.type === "Email" ? "emailsSent" : "callsMade", a.occurredAt, {
      id: `activity_${a.id}`,
      recordType: "activity",
      recordId: a.id,
      owner: a.owner,
      accountId: a.accountId,
      accountName: a.accountName,
      contactId: a.contactId,
      contactName: a.contactName,
      action: a.subject,
      status: a.direction ?? undefined,
      notes: a.notes ?? undefined,
      viewPath: accountPath(a.accountId),
    });
  }

  for (const m of src.meetings) {
    const shared = {
      recordType: "meeting" as const,
      recordId: m.id,
      owner: m.owner,
      accountId: m.accountId,
      accountName: m.accountName,
      contactId: m.contactId,
      contactName: m.contactName,
      viewPath: accountPath(m.accountId),
      dueDate: `${ymd(m.meetingDate)}${m.startTime ? " " + m.startTime : ""}`,
      action: `${m.mode} meeting`,
      status: m.status,
    };
    push("meetingsScheduled", m.createdAt, {
      ...shared,
      id: `meeting_sched_${m.id}`,
      notes: m.agenda ?? undefined,
    });
    if (m.status === "COMPLETED" && m.completedAt) {
      push("meetingsCompleted", m.completedAt, {
        ...shared,
        id: `meeting_done_${m.id}`,
        completedDate: dmy(m.completedAt),
        notes: m.summary ?? m.nextStep ?? undefined,
      });
    }
    if (m.status === "CANCELLED" && m.cancelledAt) {
      push("meetingsCancelled", m.cancelledAt, {
        ...shared,
        id: `meeting_cancel_${m.id}`,
        completedDate: dmy(m.cancelledAt),
        notes: m.summary ?? "Meeting cancelled",
      });
    }
  }

  for (const s of src.statusChanges) {
    let row: OverallRowKey | null = null;
    if (s.statusTag === "Not Interested") row = "notInterested";
    else if (s.statusTag === "Keep in Touch") row = "followUp";
    else if (s.statusTag === "Call Back" || s.statusTag === "Send Info")
      row = "sendInfoCallBacks";
    if (!row) continue;
    push(row, s.at, {
      id: `audit_${s.id}`,
      recordType: "audit",
      recordId: s.id,
      owner: s.owner,
      accountId: s.accountId,
      accountName: s.accountName,
      action: s.statusTag,
      status: s.statusTag,
      notes: s.reason ?? undefined,
      dueDate: s.dueDate,
      viewPath: accountPath(s.accountId),
    });
  }

  for (const key of Object.keys(records) as OverallRowKey[]) {
    for (const list of Object.values(records[key])) {
      list.sort((a, b) => b.at.localeCompare(a.at));
    }
  }
  return records;
}

export function countsFromRecords(records: RecordsByRowAndDay) {
  const daily = {} as Record<OverallRowKey, Record<string, number>>;
  const monthTotals = {} as Record<OverallRowKey, number>;
  for (const { key } of OVERALL_ROWS) {
    daily[key] = {};
    let total = 0;
    for (const [day, list] of Object.entries(records[key])) {
      daily[key][day] = list.length;
      total += list.length;
    }
    monthTotals[key] = total;
  }
  return { daily, monthTotals };
}
