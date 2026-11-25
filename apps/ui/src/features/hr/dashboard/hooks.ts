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
  listLatestLeaveRequests,
  listOpenTasks,
  listRecentExpenseClaims,
  listRecentTickets,
} from "./api";
import { listDepartments } from "@/features/departments/api";
import {
  absencesByWeekday,
  addDays,
  countAttendance,
  istToday,
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
  const today = istToday();
  const currentMonth = monthRange(today);
  const lastMonthDate = addDays(`${today.slice(0, 7)}-01`, -1);
  const lastMonth = monthRange(lastMonthDate);

  return useQuery({
    queryKey: org.keyFor(today.slice(0, 7)),
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [total, active, newJoinersThisMonth, newJoinersLastMonth] =
        await Promise.all([
          countRows("/hr/employees", {}),
          countRows("/hr/employees", { status: "ACTIVE" }),
          countRows("/hr/employees", {
            joinedFrom: currentMonth.from,
            joinedTo: currentMonth.to,
          }),
          countRows("/hr/employees", {
            joinedFrom: lastMonth.from,
            joinedTo: lastMonth.to,
          }),
        ]);
      return { total, active, newJoinersThisMonth, newJoinersLastMonth };
    },
  });
}

export interface DepartmentMetric {
  id: number;
  name: string;
  count: number;
}

export function useDepartmentMetrics(enabled: boolean) {
  const org = useOrgKey("department-metrics");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async (): Promise<DepartmentMetric[]> => {
      const res = await listDepartments({ limit: 50 });
      const departments = res.data ?? [];
      const metrics = await Promise.all(
        departments.map(async (d) => {
          const count = await countRows("/hr/employees", {
            departmentId: d.id,
          });
          return { id: d.id, name: d.name, count };
        }),
      );
      return metrics;
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

/** Employees who have left: resigned + terminated, for the Workforce category. */
export function useSeparationCount(enabled: boolean) {
  const org = useOrgKey("separations");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [resigned, terminated] = await Promise.all([
        countRows("/hr/employees", { status: "RESIGNED" }),
        countRows("/hr/employees", { status: "TERMINATED" }),
      ]);
      return resigned + terminated;
    },
  });
}

export function useOpenTaskCount(enabled: boolean) {
  const org = useOrgKey("open-tasks-count");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [pending, inProgress, overdue] = await Promise.all([
        countRows("/hr/tasks", { status: "PENDING" }),
        countRows("/hr/tasks", { status: "IN_PROGRESS" }),
        countRows("/hr/tasks", { overdue: true }),
      ]);
      return { open: pending + inProgress, overdue };
    },
  });
}

export function useOpenExitCount(enabled: boolean) {
  const org = useOrgKey("open-exits-count");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const [submitted, review] = await Promise.all([
        countRows("/hr/exit-requests", { status: "SUBMITTED" }),
        countRows("/hr/exit-requests", { status: "UNDER_REVIEW" }),
      ]);
      return submitted + review;
    },
  });
}

/**
 * Daily attendance for the last seven calendar days (oldest first). Shares the
 * `attendance-daily` keys with `useDailyAttendance`, so today is fetched once.
 */
export function useWeekAttendance(todayDate: string, enabled: boolean) {
  const org = useOrgKey();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(todayDate, i - 6));
  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: org.keyFor("attendance-daily", date),
      enabled: enabled && org.enabled,
      queryFn: () => listDailyAttendance(date),
    })),
  });
  return {
    // isLoading, not isPending: a disabled query stays "pending" forever.
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    hasData: queries.every((q) => q.data !== undefined),
    refetch: () => queries.forEach((q) => void q.refetch()),
    days: dates.map((date, i) => {
      const rows = queries[i]?.data ?? [];
      return { date, total: rows.length, ...countAttendance(rows) };
    }),
  };
}

export function useLatestLeaveRequests(enabled: boolean) {
  const org = useOrgKey("latest-leaves");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: () => listLatestLeaveRequests(4),
  });
}

export function useOpenTasks(enabled: boolean) {
  const org = useOrgKey("open-tasks");
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: () => listOpenTasks(5),
  });
}

/** Active holidays in the next 60 days, soonest first. */
export function useUpcomingHolidays(todayDate: string, enabled: boolean) {
  const org = useOrgKey("upcoming-holidays", todayDate);
  return useQuery({
    queryKey: org.key,
    enabled: enabled && org.enabled,
    queryFn: async () => {
      const rows = await listHolidays(todayDate, addDays(todayDate, 60));
      return [...rows].sort((a, b) =>
        a.holidayDate.localeCompare(b.holidayDate),
      );
    },
  });
}
