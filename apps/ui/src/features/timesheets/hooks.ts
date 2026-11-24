"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  approveDay,
  correctSession,
  createCustomActivity,
  deleteCustomActivity,
  getActivityCategories,
  getDayReport,
  getEmployeeReport,
  getEmployeeMonth,
  getLinkableProjects,
  getMyDay,
  getMyMonth,
  getReviewDay,
  getReviewSummary,
  getTaskHistory,
  listAwaiting,
  listReviewDays,
  rejectDay,
  reopenDay,
  submitDay,
  submitWeek,
  updateCustomActivity,
  type ReportQuery,
  type ReviewListQuery,
} from "./api";
import type { CustomActivityInput } from "./types";

function baseKey(orgId: number, ...parts: unknown[]) {
  return ["org", orgId, "timesheets", ...parts];
}

/** The employee's own timesheet for one day. Refreshed every minute so a timer
 * that is running (or closed by a check-out) shows up without a reload. */
export function useMyDay(date: string) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "day", date),
    queryFn: () => getMyDay(date),
    enabled: Boolean(orgId) && Boolean(date),
    refetchInterval: 60_000,
  });
}

/** Several of the employee's own days at once (the week worksheet). Shares
 * the cache with `useMyDay`, so the selected day is not fetched twice. */
export function useMyDays(dates: readonly string[]) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: baseKey(orgId, "day", date),
      queryFn: () => getMyDay(date),
      enabled: Boolean(orgId),
      refetchInterval: 60_000,
    })),
  });
}

/** The employee's own month (attendance and logged time, day by day). */
export function useMyMonth(month: string) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "month", month),
    queryFn: () => getMyMonth(month),
    enabled: Boolean(orgId) && Boolean(month),
    refetchInterval: 60_000,
  });
}

/** A reviewer's view of one employee's month. */
export function useEmployeeMonth(employeeId: number | null, month: string) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "review", "month", employeeId, month),
    queryFn: () => getEmployeeMonth(employeeId as number, month),
    enabled: Boolean(orgId) && employeeId !== null && Boolean(month),
  });
}

/** One task day by day (worked days plus derived no-work days). */
export function useTaskHistory(
  taskId: number | null,
  from: string,
  to: string,
) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "task-history", taskId, from, to),
    queryFn: () => getTaskHistory(taskId as number, from, to),
    enabled: Boolean(orgId) && taskId !== null,
  });
}

/** The category list the form offers — served by the API. */
export function useActivityCategories() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "activity-categories"),
    queryFn: () => getActivityCategories(),
    enabled: Boolean(orgId),
    staleTime: 60 * 60 * 1000,
  });
}

/** Projects the employee may link an activity to. */
export function useLinkableProjects(enabled = true) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "linkable-projects"),
    queryFn: () => getLinkableProjects(),
    enabled: Boolean(orgId) && enabled,
  });
}

function useInvalidateTimesheets() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return () => queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
}

export function useCreateCustomActivity() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (input: CustomActivityInput) => createCustomActivity(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomActivity() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Partial<CustomActivityInput>;
    }) => updateCustomActivity(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomActivity() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (id: number) => deleteCustomActivity(id),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Submit and review
// ---------------------------------------------------------------------------

export function useSubmitDay() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (date: string) => submitDay(date),
    onSuccess: invalidate,
  });
}

export function useSubmitWeek() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (weekStart: string) => submitWeek(weekStart),
    onSuccess: invalidate,
  });
}

/** Days waiting for the caller's decision. */
export function useAwaitingDays(
  query: Pick<ReviewListQuery, "page" | "limit">,
  enabled = true,
) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "review", "awaiting", query),
    queryFn: () => listAwaiting(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useReviewDays(query: ReviewListQuery, enabled = true) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "review", "list", query),
    queryFn: () => listReviewDays(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useReviewDay(
  employeeId: number | null,
  date: string | null,
  includeDrafts = false,
) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "review", "day", employeeId, date, includeDrafts),
    queryFn: () =>
      getReviewDay(employeeId as number, date as string, includeDrafts),
    enabled: Boolean(orgId) && employeeId !== null && date !== null,
  });
}

export function useDecideDay() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (input: {
      employeeId: number;
      date: string;
      decision: "approve" | "reject";
      note?: string;
    }) =>
      input.decision === "approve"
        ? approveDay(input.employeeId, input.date, input.note)
        : rejectDay(input.employeeId, input.date, input.note ?? ""),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Counts, reopen, correction, reports
// ---------------------------------------------------------------------------

export function useReviewSummary(enabled = true) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "review", "summary"),
    queryFn: () => getReviewSummary(),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useReopenDay() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (input: { employeeId: number; date: string; note: string }) =>
      reopenDay(input.employeeId, input.date, input.note),
    onSuccess: invalidate,
  });
}

export function useCorrectSession() {
  const invalidate = useInvalidateTimesheets();
  return useMutation({
    mutationFn: (input: {
      sessionId: number;
      endTime: string;
      reason: string;
    }) =>
      correctSession(input.sessionId, {
        endTime: input.endTime,
        reason: input.reason,
      }),
    onSuccess: invalidate,
  });
}

export function useEmployeeReport(query: ReportQuery | null) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "report", query),
    queryFn: () => getEmployeeReport(query as ReportQuery),
    enabled: Boolean(orgId) && query !== null,
  });
}

/** The Week grid's data: one range (a week) of per-day summaries. */
export function useDayReport(query: ReportQuery | null) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "report", "days", query),
    queryFn: () => getDayReport(query as ReportQuery),
    enabled: Boolean(orgId) && query !== null,
  });
}
