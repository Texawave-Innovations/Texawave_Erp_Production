// CRM — live derivation of the Overall Data tab from real Core CRM activity.
//
// Overall Data used to be pure manual entry (crm/overallData / crm/overallReport). This hook
// replaces that with numbers AND actual detail records computed from the real domain records/
// events that already exist elsewhere in the CRM, so Core CRM remains the single source of truth
// and nothing here is a second, independently-maintained counter or a duplicate dataset. Every
// day-cell's count is always exactly `records[row][dayKey].length` — never a separately
// maintained number — so the UI, its drill-down modal, and the Excel export can never drift out
// of sync with each other. See each row's mapping below for exactly which collection/field/
// timestamp it is derived from and why (chosen to make every count immune to double-counting from
// edits, re-renders, or repeated status transitions).
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { subscribeCrmMeetings } from "./domain/meetingsService";
import { subscribeCrmActivities } from "./domain/activitiesService";
import { subscribeCrmAccounts } from "./domain/accountsService";
import { subscribeCrmContacts } from "./domain/contactsService";
import { subscribeCrmOpportunities } from "./domain/opportunitiesService";
import { subscribeCollection } from "./domain/firebaseCollection";
import { subscribeCrmAuditLogs } from "./intelligence/auditService";
import { resolveAccountId } from "./domain/relatedLookup";
import {
  CrmMeeting,
  CrmActivity,
  CrmAccount,
  CrmContact,
  CrmOpportunity,
} from "./domain/types";
import { CrmAuditLogEntry } from "./intelligence/types";
import {
  AccountsMiningRow,
  ColdCallingRow,
  OverallActivityRecord,
  OverallDataMonth,
  OverallReportMonth,
  TrackingRowKey,
} from "./types";

const ACCOUNTS_MINING_PATH = "crm/accountsMiningSheet";
const COLD_CALLING_PATH = "crm/coldCallingStatus";

/** Formats an epoch-ms timestamp as a yyyy-MM-dd day key in Asia/Kolkata, so an action performed
 *  late at night IST is never bucketed into the UTC-shifted adjacent day. `en-CA` is the one
 *  built-in locale that formats as yyyy-MM-dd directly — no date-arithmetic or extra dependency. */
const IST_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function istDayKey(epochMs: number): string {
  return IST_DAY_FORMATTER.format(new Date(epochMs));
}

/** Formats an epoch-ms timestamp as a local (Asia/Kolkata) 12-hour time, e.g. "09:42 AM" — the
 *  per-record time shown in the Overall Data drill-down and Excel export. */
const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
function istTime(epochMs: number): string {
  return IST_TIME_FORMATTER.format(new Date(epochMs)).toUpperCase();
}

type RecordsByRowAndDay = Record<
  TrackingRowKey,
  Record<string, OverallActivityRecord[]>
>;

function emptyDailyValues(): OverallDataMonth {
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

function emptyRecords(): RecordsByRowAndDay {
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

function pushRecord(
  records: RecordsByRowAndDay,
  row: TrackingRowKey,
  dayKey: string,
  record: OverallActivityRecord,
) {
  const bucket = records[row]!;
  (bucket[dayKey] || (bucket[dayKey] = [])).push(record);
}

export interface OverallDataLive {
  loading: boolean;
  /** This month's per-day counts, one bucket per TrackingRowKey — always `records[row][day].length`. */
  daily: OverallDataMonth;
  /** Sum of every day in the month, per TrackingRowKey — feeds the Weekly/Monthly report cards. */
  monthTotals: OverallReportMonth;
  /** The real records behind every (row, day) count — feeds the drill-down view and Excel export. */
  records: RecordsByRowAndDay;
}

/** Live, derived replacement for the old manual `crm/overallData`/`crm/overallReport` reads.
 *  Opens exactly 8 collection listeners total (meetings, activities, accountsMiningSheet,
 *  coldCallingStatus, auditLogs, accounts, contacts, opportunities) regardless of how many
 *  days/cells are rendered — filtering by month/day, and joining account/contact names, is a
 *  cheap in-memory pass over already-subscribed data, not a new fetch per cell. */
export function useOverallDataLive(monthDate: Date): OverallDataLive {
  const [meetings, setMeetings] = useState<CrmMeeting[] | null>(null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [miningRows, setMiningRows] = useState<
    (AccountsMiningRow & { id: string })[] | null
  >(null);
  const [coldCallingRows, setColdCallingRows] = useState<
    (ColdCallingRow & { id: string })[] | null
  >(null);
  const [auditLogs, setAuditLogs] = useState<CrmAuditLogEntry[] | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[] | null>(null);
  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[] | null>(
    null,
  );

  useEffect(() => {
    const unsubs = [
      subscribeCrmMeetings(setMeetings),
      subscribeCrmActivities(setActivities),
      subscribeCollection<AccountsMiningRow & { id: string }>(
        ACCOUNTS_MINING_PATH,
        setMiningRows,
      ),
      subscribeCollection<ColdCallingRow & { id: string }>(
        COLD_CALLING_PATH,
        setColdCallingRows,
      ),
      subscribeCrmAuditLogs(setAuditLogs),
      subscribeCrmAccounts(setAccounts),
      subscribeCrmContacts(setContacts),
      subscribeCrmOpportunities(setOpportunities),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const loading =
    !meetings ||
    !activities ||
    !miningRows ||
    !coldCallingRows ||
    !auditLogs ||
    !accounts ||
    !contacts ||
    !opportunities;

  // `monthDate` already IS the intended calendar year/month — the caller (OverallData.tsx) only
  // ever produces it via `startOfMonth`/`addMonths`, local-calendar-field arithmetic that never
  // touches a specific instant's timezone. Converting it through `istDayKey(monthDate.getTime())`
  // instead re-interprets its LOCAL midnight as an IST wall-clock instant, which lands on the
  // previous calendar day (and month) for any viewer whose timezone is ahead of IST by more than
  // 5.5 hours — rolling the entire "this month" range back a full month for those viewers, every
  // month. Reading `monthDate`'s own calendar fields sidesteps the conversion entirely; only the
  // per-record day keys below need the IST conversion, since those come from real timestamps.
  const istYear = monthDate.getFullYear();
  const istMonth = monthDate.getMonth() + 1;
  const monthKeyIST = `${istYear}-${String(istMonth).padStart(2, "0")}`;
  const daysInIstMonth = new Date(istYear, istMonth, 0).getDate();
  const monthStartKey = `${monthKeyIST}-01`;
  const monthEndKey = `${monthKeyIST}-${String(daysInIstMonth).padStart(2, "0")}`;

  return useMemo(() => {
    const records = emptyRecords();
    const inMonth = (dayKey: string) =>
      dayKey >= monthStartKey && dayKey <= monthEndKey;

    const accountName = (id: string | undefined): string | undefined =>
      id ? accounts?.find((a) => a.id === id)?.name : undefined;
    const accountViewPath = (id: string | undefined): string | undefined =>
      id ? `/crm/accounts/${id}` : undefined;

    // --- Accounts Mined — crm/accountsMiningSheet, by row creation date. ---
    (miningRows || []).forEach((row) => {
      if (!row.createdAt) return;
      const dayKey = istDayKey(row.createdAt);
      if (!inMonth(dayKey)) return;
      pushRecord(records, "accountsMined", dayKey, {
        id: `mining_${row.id}`,
        atMs: row.createdAt,
        time: istTime(row.createdAt),
        owner: row.assignedTo || row.createdBy || "—",
        accountName: row.companyName || "—",
        contactName: row.keyDecisionMakers || undefined,
        action: "Accounts Mined",
        status: row.followUpStatus || row.emailStatus || undefined,
        source: "Accounts Mining Sheet",
        notes: row.notes,
        recordId: row.id,
      });
    });

    // --- Calls Made — crm/coldCallingStatus, by row creation date. Additive alongside the
    // crm/activities Call-type records below: a Cold Calling Status row is a distinct call log
    // (from the cold-calling sheet, not a manually logged Activity), so both sources are summed
    // into the same 'callsMade' bucket rather than one replacing the other — mirrors how
    // 'accountsMined' above is derived purely from Accounts Mining Sheet row creation. ---
    (coldCallingRows || []).forEach((row) => {
      if (!row.createdAt) return;
      const dayKey = istDayKey(row.createdAt);
      if (!inMonth(dayKey)) return;
      pushRecord(records, "callsMade", dayKey, {
        id: `coldCalling_${row.id}`,
        atMs: row.createdAt,
        time: istTime(row.createdAt),
        owner: row.createdBy || "—",
        accountId: row.linkedAccountId,
        accountName: row.linkedAccountName || row.companyName || "—",
        contactName: row.prospectName || undefined,
        action: "Cold Call",
        status: row.status,
        source: "Cold Calling Status",
        notes: row.status,
        recordId: row.id,
        viewPath: row.linkedAccountId
          ? `/crm/accounts/${row.linkedAccountId}`
          : "/crm/cold-calling-status",
      });
    });

    // --- Emails Sent / Calls Made — crm/activities, by occurredAt. ---
    (activities || []).forEach((activity) => {
      if (!activity.occurredAt) return;
      const dayKey = istDayKey(activity.occurredAt);
      if (!inMonth(dayKey)) return;
      if (activity.type !== "Email" && activity.type !== "Call") return;

      const accountId = resolveAccountId(
        activity.relatedType,
        activity.relatedId,
        contacts || [],
        opportunities || [],
      );
      const contact =
        activity.relatedType === "contact"
          ? contacts?.find((c) => c.id === activity.relatedId)
          : undefined;
      const record: OverallActivityRecord = {
        id: `activity_${activity.id}`,
        atMs: activity.occurredAt,
        time: istTime(activity.occurredAt),
        owner: activity.createdBy,
        accountId,
        accountName: accountName(accountId),
        contactId: contact?.id,
        contactName: contact?.name,
        action: activity.subject,
        status: activity.direction,
        notes: activity.notes,
        recordId: activity.id,
        viewPath: accountViewPath(accountId),
      };
      if (activity.type === "Email")
        pushRecord(records, "emailsSent", dayKey, record);
      else pushRecord(records, "callsMade", dayKey, record);
    });

    // --- Meetings Scheduled/Completed/Cancelled — crm/meetings, by createdAt/completedAt/cancelledAt. ---
    (meetings || []).forEach((meeting) => {
      const accountId = resolveAccountId(
        meeting.relatedType,
        meeting.relatedId,
        contacts || [],
        opportunities || [],
      );
      const contact =
        meeting.relatedType === "contact"
          ? contacts?.find((c) => c.id === meeting.relatedId)
          : undefined;
      const shared = {
        accountId,
        accountName: accountName(accountId),
        contactId: contact?.id,
        contactName: contact?.name,
        owner: meeting.createdBy,
        recordId: meeting.id,
        viewPath: accountViewPath(accountId),
        dueDate: meeting.date
          ? `${meeting.date}${meeting.startTime ? " " + meeting.startTime : ""}`
          : undefined,
        action: `${meeting.mode} meeting`,
      };

      if (meeting.createdAt) {
        const dayKey = istDayKey(meeting.createdAt);
        if (inMonth(dayKey)) {
          pushRecord(records, "meetingsScheduled", dayKey, {
            ...shared,
            id: `meeting_sched_${meeting.id}`,
            atMs: meeting.createdAt,
            time: istTime(meeting.createdAt),
            status: meeting.status,
            notes: meeting.agenda,
          });
        }
      }
      if (meeting.status === "COMPLETED" && meeting.completedAt) {
        const dayKey = istDayKey(meeting.completedAt);
        if (inMonth(dayKey)) {
          pushRecord(records, "meetingsCompleted", dayKey, {
            ...shared,
            id: `meeting_done_${meeting.id}`,
            atMs: meeting.completedAt,
            time: istTime(meeting.completedAt),
            status: meeting.status,
            completedDate: format(new Date(meeting.completedAt), "dd-MMM-yyyy"),
            notes: meeting.summary || meeting.nextStep,
          });
        }
      }
      if (meeting.status === "CANCELLED" && meeting.cancelledAt) {
        const dayKey = istDayKey(meeting.cancelledAt);
        if (inMonth(dayKey)) {
          pushRecord(records, "meetingsCancelled", dayKey, {
            ...shared,
            id: `meeting_cancel_${meeting.id}`,
            atMs: meeting.cancelledAt,
            time: istTime(meeting.cancelledAt),
            status: meeting.status,
            completedDate: format(new Date(meeting.cancelledAt), "dd-MMM-yyyy"),
            notes: meeting.summary || "Meeting cancelled",
          });
        }
      }
    });

    // --- Send Info/Call Backs, Follow-up (Keep in Touch), Not Interested — crm/auditLogs
    //     'account_status_tag_changed' entries, by their `at` timestamp. ---
    (auditLogs || []).forEach((entry) => {
      if (entry.action !== "account_status_tag_changed" || !entry.newValue)
        return;
      const dayKey = istDayKey(entry.at);
      if (!inMonth(dayKey)) return;

      const accountId = entry.entityId;
      const shared = {
        atMs: entry.at,
        time: istTime(entry.at),
        owner: entry.by,
        accountId,
        accountName: accountName(accountId) || entry.companyName,
        status: entry.newValue,
        notes: entry.details,
        recordId: entry.id,
        viewPath: accountViewPath(accountId),
      };
      if (entry.newValue === "Not Interested") {
        pushRecord(records, "notInterested", dayKey, {
          ...shared,
          id: `audit_${entry.id}`,
          action: "Not Interested",
        });
      } else if (entry.newValue === "Keep in Touch") {
        pushRecord(records, "followUp", dayKey, {
          ...shared,
          id: `audit_${entry.id}`,
          action: "Keep in Touch",
        });
      } else if (
        entry.newValue === "Call Back" ||
        entry.newValue === "Send Info"
      ) {
        pushRecord(records, "sendInfoCallBacks", dayKey, {
          ...shared,
          id: `audit_${entry.id}`,
          action: entry.newValue,
        });
      }
    });

    // Newest-first within each day, and counts always derived from the records themselves.
    const daily = emptyDailyValues();
    (Object.keys(records) as TrackingRowKey[]).forEach((key) => {
      Object.entries(records[key]).forEach(([dayKey, list]) => {
        list.sort((a, b) => b.atMs - a.atMs);
        daily[key]![dayKey] = list.length;
      });
    });

    const monthTotals: OverallReportMonth = {};
    (Object.keys(daily) as TrackingRowKey[]).forEach((key) => {
      monthTotals[key] = Object.values(daily[key] || {}).reduce(
        (sum, v) => sum + v,
        0,
      );
    });

    return { loading, daily, monthTotals, records };
  }, [
    meetings,
    activities,
    miningRows,
    coldCallingRows,
    auditLogs,
    accounts,
    contacts,
    opportunities,
    monthStartKey,
    monthEndKey,
    loading,
  ]);
}
