"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import {
  countRows,
  listAll,
  listDailyAttendance,
  listEmployees,
  listHolidays,
  listRecentExpenseClaims,
  listRecentTickets,
} from "./api";
import {
  absencesByWeekday,
  addDays,
  countAttendance,
  monthRange,
  workdayLookback,
} from "./metrics";
import type { DailyAttendanceRow, LeaveRequestRow } from "./types";

const KEY = "hr-dashboard";
const LEAVE_PATH = "/hr/leave-requests";

/** Every widget is its own query, so one failing endpoint only blanks its own card. */
function useOrgKey(...parts: (string | number)[]) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return {
    enabled: Boolean(organizationId),
    key: orgScopedKey(organizationId ?? 0, KEY, ...parts),
    /** Per-date keys for `useQueries`, built from the same organization. */
    keyFor: (...more: (string | number)[]) =>
      orgScopedKey(organizationId ?? 0, KEY, ...parts, ...more),
  };
}

export function useHeadcount(enabled: boolean) {
  const org = useOrgKey("headcount");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [total, active] = await Promise.all([
        countRows("/hr/employees", {}),
        countRows("/hr/employees", { status: "ACTIVE" }),
      ]);
      return { total, active };
    },
  });
}

/** Daily attendance for one IST date. Shared by the donut, heatmap and glance strip. */
export function useDailyAttendance(date: string, enabled: boolean) {
  const org = useOrgKey("attendance-daily", date);
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: () => listDailyAttendance(date),
    select: (rows: DailyAttendanceRow[]) => ({
      rows,
      counts: countAttendance(rows),
    }),
  });
}

/** Reuses the same `attendance-daily` keys as `useDailyAttendance`, so today is fetched once. */
export function useAbsenceLookback(todayDate: string, enabled: boolean) {
  const org = useOrgKey();
  const dates = workdayLookback(todayDate);
  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: org.keyFor("attendance-daily", date),
      enabled: enabled && org.enabled,
      queryFn: () => listDailyAttendance(date),
    })),
  });
  const settled = queries.every((q) => q.isSuccess || q.isError);
  const failed = queries.some((q) => q.isError);
  const perDate = dates.map((date, i) => {
    const rows = queries[i]?.data ?? [];
    return { date, absent: countAttendance(rows).absent };
  });
  return {
    isPending: !settled,
    isError: failed,
    days: absencesByWeekday(perDate),
  };
}

export function useLeaveBreakdown(
  mode: "month" | "all",
  todayDate: string,
  enabled: boolean,
) {
  const org = useOrgKey(
    "leave-breakdown",
    mode,
    mode === "month" ? todayDate.slice(0, 7) : "all",
  );
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async (): Promise<LeaveRequestRow[]> =>
      mode === "month"
        ? listAll<LeaveRequestRow>(LEAVE_PATH, monthRange(todayDate))
        : listAll<LeaveRequestRow>(LEAVE_PATH, {}),
  });
}

export function useApprovalsPending(enabled: boolean) {
  const org = useOrgKey("pending-approvals");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [leaves, corrections] = await Promise.all([
        countRows(LEAVE_PATH, { status: "PENDING" }),
        countRows("/hr/attendance/corrections", { status: "SUBMITTED" }),
      ]);
      return { leaves, corrections, total: leaves + corrections };
    },
  });
}

export function useTicketCounts(enabled: boolean) {
  const org = useOrgKey("ticket-counts");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [open, inProgress] = await Promise.all([
        countRows("/hr/tickets", { status: "OPEN" }),
        countRows("/hr/tickets", { status: "IN_PROGRESS" }),
      ]);
      return open + inProgress;
    },
  });
}

export function usePendingExpenseCount(enabled: boolean) {
  const org = useOrgKey("pending-expenses");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: () => countRows("/hr/expense-claims", { status: "PENDING" }),
  });
}

/**
 * Recruitment stages the API can count. There is no candidate table, so
 * "Applied" and "Hired" are not returned here (backend data gap).
 */
export function usePipelineCounts(enabled: boolean) {
  const org = useOrgKey("pipeline");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [scheduled, completed, selected, offered] = await Promise.all([
        countRows("/hr/interviews", { status: "SCHEDULED" }),
        countRows("/hr/interviews", { status: "COMPLETED" }),
        countRows("/hr/interviews", { status: "SELECTED" }),
        countRows("/hr/offer-letters", {}),
      ]);
      return { scheduled, interviewed: completed, selected, offered };
    },
  });
}

export function useActivityFeed(enabled: boolean) {
  const org = useOrgKey("activity");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [tickets, expenses] = await Promise.all([
        listRecentTickets(6),
        listRecentExpenseClaims(6),
      ]);
      return { tickets, expenses };
    },
  });
}

export function useGlanceSupport(todayDate: string, enabled: boolean) {
  const org = useOrgKey("glance", todayDate);
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [holidays, employees] = await Promise.all([
        listHolidays(todayDate, addDays(todayDate, 7)),
        listEmployees(),
      ]);
      return { holidays, employees };
    },
  });
}
