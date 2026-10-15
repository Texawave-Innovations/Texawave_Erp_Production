// CRM Intelligence Layer — read-only Overall Data performance aggregation.
//
// "Overall Data" (crm/overallData/{month}/{trackingRow}/{date} -> number) is a daily numeric
// counter sheet with a structure fundamentally different from the 8 company/lead row-level
// source tabs aggregated by useCrmSourceData.ts + unify.ts. That is why it is intentionally
// excluded from buildActivities(), Company 360, Global Search, and the Calendar — nothing here
// changes that.
//
// This hook is a SEPARATE, purely additive bridge that only feeds the Dashboard's "Today's
// Performance" section and the Analytics "Overall Data Performance" section. It only ever reads
// `crm/overallData` (via onValue, mirroring the read pattern already used by
// useCrmSourceData.ts/OverallData.tsx) and never calls set/update/push/remove against it — it
// never writes anywhere. It does not read or touch `crm/overallReport` or any of the 8 source
// tabs, and it is never wired into unify.ts, CrmSearch.tsx, CrmCalendar.tsx, or CompanyDetail.tsx.
//
// The tracking rows below mirror OverallData.tsx's TRACKING_ROWS exactly (same keys, same
// labels, same set — nothing invented). They are duplicated here, rather than imported, so that
// OverallData.tsx itself never needs to change. If the tracking rows in OverallData.tsx ever
// change, update this list to match.
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "@/services/firebase";
import {
  eachDayOfInterval,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { OverallDataMonth, TrackingRowDef, TrackingRowKey } from "../types";

/** Mirrors OverallData.tsx's TRACKING_ROWS exactly — do not add, remove, or rename rows here independently. */
export const OVERALL_DATA_TRACKING_ROWS: TrackingRowDef[] = [
  { key: "accountsMined", label: "Accounts Mined" },
  { key: "emailsSent", label: "E-mails sent for the day" },
  { key: "meetingsScheduled", label: "Meeting Scheduled" },
  { key: "meetingsCompleted", label: "Meeting Completed" },
  { key: "meetingsCancelled", label: "Meeting Cancelled" },
  { key: "sendInfoCallBacks", label: "Send Info / Call Backs" },
  { key: "followUp", label: "Follow-up (Keep in Touch)" },
  { key: "notInterested", label: "Not Interested" },
  { key: "callsMade", label: "Calls made for the Day" },
];

export type OverallDataTotals = Record<TrackingRowKey, number>;

const ZERO_TOTALS: OverallDataTotals = {
  accountsMined: 0,
  emailsSent: 0,
  meetingsScheduled: 0,
  meetingsCompleted: 0,
  meetingsCancelled: 0,
  sendInfoCallBacks: 0,
  followUp: 0,
  notInterested: 0,
  callsMade: 0,
};

export interface OverallDataDayPoint {
  dateKey: string;
  label: string;
  totals: OverallDataTotals;
}

export interface OverallDataAnalytics {
  loading: boolean;
  /** Same tracking rows as OverallData.tsx, exposed for reuse (labels, order). */
  trackingRows: TrackingRowDef[];
  todayDateKey: string;
  today: OverallDataTotals;
  /** Monday (start of ISO week) through today, inclusive. */
  weekToDate: OverallDataTotals;
  /** 1st of the current month through today, inclusive. */
  monthToDate: OverallDataTotals;
  /** Last 14 days (oldest to newest), each day's totals — for a daily activity trend chart. */
  dailyTrend: OverallDataDayPoint[];
}

/** Read-only subscription to `crm/overallData/{monthKey}`. Never calls set/update/push/remove. */
function useOverallDataMonth(monthKey: string): {
  data: OverallDataMonth;
  loaded: boolean;
} {
  const [data, setData] = useState<OverallDataMonth>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const monthRef = ref(database, `crm/overallData/${monthKey}`);
    const unsubscribe = onValue(monthRef, (snap) => {
      setData(snap.val() || {});
      setLoaded(true);
    });
    return () => unsubscribe();
  }, [monthKey]);

  return { data, loaded };
}

/**
 * Read-only aggregation of the existing `crm/overallData` counters for the Dashboard/Analytics
 * "Performance" sections. Loads the current month plus the previous month (so a trailing 14-day
 * trend and a Monday-start week that spans a month boundary still resolve correctly), and never
 * writes to Firebase.
 */
export function useOverallDataAnalytics(): OverallDataAnalytics {
  // `now` must stay live for as long as the Dashboard/Analytics screen stays mounted — computing
  // it once at mount froze "today"/"this week"/"this month" bucketing at whatever moment the page
  // first loaded, so a browser tab left open across midnight (or an overnight shift) kept showing
  // yesterday's "Today's Performance" until the page was reloaded. Re-ticks every minute, which is
  // plenty for date-level (not second-level) bucketing.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const currentMonthKey = format(now, "yyyy-MM");
  const previousMonthKey = format(subMonths(now, 1), "yyyy-MM");

  const current = useOverallDataMonth(currentMonthKey);
  const previous = useOverallDataMonth(previousMonthKey);

  const monthsByKey = useMemo<Record<string, OverallDataMonth>>(
    () => ({
      [currentMonthKey]: current.data,
      [previousMonthKey]: previous.data,
    }),
    [current.data, previous.data, currentMonthKey, previousMonthKey],
  );

  return useMemo(() => {
    const getValue = (date: Date, rowKey: TrackingRowKey): number => {
      const monthKey = format(date, "yyyy-MM");
      const dateKey = format(date, "yyyy-MM-dd");
      return monthsByKey[monthKey]?.[rowKey]?.[dateKey] ?? 0;
    };

    const totalsForDates = (dates: Date[]): OverallDataTotals => {
      const totals: OverallDataTotals = { ...ZERO_TOTALS };
      dates.forEach((date) => {
        OVERALL_DATA_TRACKING_ROWS.forEach((row) => {
          totals[row.key] += getValue(date, row.key);
        });
      });
      return totals;
    };

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const trendStart = subDays(now, 13);

    const dailyTrend: OverallDataDayPoint[] = eachDayOfInterval({
      start: trendStart,
      end: now,
    }).map((date) => ({
      dateKey: format(date, "yyyy-MM-dd"),
      label: format(date, "dd MMM"),
      totals: totalsForDates([date]),
    }));

    return {
      loading: !current.loaded || !previous.loaded,
      trackingRows: OVERALL_DATA_TRACKING_ROWS,
      todayDateKey: format(now, "yyyy-MM-dd"),
      today: totalsForDates([now]),
      weekToDate: totalsForDates(
        eachDayOfInterval({ start: weekStart, end: now }),
      ),
      monthToDate: totalsForDates(
        eachDayOfInterval({ start: monthStart, end: now }),
      ),
      dailyTrend,
    };
  }, [monthsByKey, now, current.loaded, previous.loaded]);
}
