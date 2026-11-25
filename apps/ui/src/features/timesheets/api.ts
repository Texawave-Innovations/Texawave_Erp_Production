import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { fetchFile } from "@/lib/fetch-file";
import { downloadBlob } from "@/features/hr/payroll/download";
import type {
  ActivityCategory,
  CustomActivity,
  CustomActivityInput,
  CorrectSessionResult,
  DayReport,
  DayWorkflowStatus,
  EmployeeMonth,
  EmployeeReport,
  LinkableProject,
  MyTimesheetDay,
  ReviewDayDetail,
  ReviewDaySummary,
  ReviewDecisionResult,
  ReviewEmployeeMonth,
  ReviewSummary,
  SubmitDayResult,
  SubmitWeekResult,
  TaskHistory,
} from "./types";

/** The signed-in employee's timesheet for one IST day (`YYYY-MM-DD`). */
export async function getMyDay(date: string): Promise<MyTimesheetDay> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyTimesheetDay>(`/timesheets/my/${date}`),
  );
  return data;
}

/** The signed-in employee's month (`YYYY-MM`): attendance, check-in/out, hours
 * and approved permissions per day, beside what was logged. */
export async function getMyMonth(month: string): Promise<EmployeeMonth> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeMonth>("/timesheets/my-month", { query: { month } }),
  );
  return data;
}

/** One task day by day over a range (at most 62 days). */
export async function getTaskHistory(
  taskId: number,
  from: string,
  to: string,
): Promise<TaskHistory> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaskHistory>(`/timesheets/tasks/${taskId}/history`, {
      query: { from, to },
    }),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Custom activities (meetings, discussions, research ...)
// ---------------------------------------------------------------------------

export async function getActivityCategories(): Promise<ActivityCategory[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ActivityCategory[]>("/timesheets/activity-categories"),
  );
  return data;
}

export async function getLinkableProjects(): Promise<LinkableProject[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<LinkableProject[]>("/timesheets/linkable-projects"),
  );
  return data;
}

export async function createCustomActivity(
  input: CustomActivityInput,
): Promise<CustomActivity> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CustomActivity>("/timesheets/custom-activities", input),
  );
  return data;
}

export async function updateCustomActivity(
  id: number,
  input: Partial<CustomActivityInput>,
): Promise<CustomActivity> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CustomActivity>(
      `/timesheets/custom-activities/${id}`,
      input,
    ),
  );
  return data;
}

export async function deleteCustomActivity(
  id: number,
): Promise<{ success: boolean }> {
  const { data } = await withAuthRetry(() =>
    apiClient.delete<{ success: boolean }>(
      `/timesheets/custom-activities/${id}`,
    ),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Submit (employee)
// ---------------------------------------------------------------------------

export async function submitDay(date: string): Promise<SubmitDayResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SubmitDayResult>(`/timesheets/my/${date}/submit`, {}),
  );
  return data;
}

export async function submitWeek(weekStart: string): Promise<SubmitWeekResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SubmitWeekResult>("/timesheets/my/submit-week", {
      weekStart,
    }),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Review (team lead, then HR) — scoped server-side
// ---------------------------------------------------------------------------

export interface ReviewListQuery {
  page: number;
  limit: number;
  status?: Exclude<DayWorkflowStatus, "DRAFT">;
  from?: string;
  to?: string;
  employeeId?: number;
}

/** Days waiting for the caller's decision. */
export function listAwaiting(
  query: Pick<ReviewListQuery, "page" | "limit">,
): Promise<PaginatedEnvelope<ReviewDaySummary>> {
  return withAuthRetry(() =>
    apiClient.get<ReviewDaySummary[]>("/timesheets/review/awaiting", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<ReviewDaySummary>>;
}

/** Submitted, approved and returned days in the caller's reach. */
export function listReviewDays(
  query: ReviewListQuery,
): Promise<PaginatedEnvelope<ReviewDaySummary>> {
  return withAuthRetry(() =>
    apiClient.get<ReviewDaySummary[]>("/timesheets/review", { query }),
  ) as Promise<PaginatedEnvelope<ReviewDaySummary>>;
}

/** One employee-day for a reviewer. `includeDrafts` also opens a day the
 * employee has not submitted (read-only, for the employee drill-down). */
export async function getReviewDay(
  employeeId: number,
  date: string,
  includeDrafts = false,
): Promise<ReviewDayDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ReviewDayDetail>(`/timesheets/review/${employeeId}/${date}`, {
      query: includeDrafts ? { drafts: "true" } : {},
    }),
  );
  return data;
}

/** One employee's month for a reviewer (inside their `hr.timesheet.read` reach). */
export async function getEmployeeMonth(
  employeeId: number,
  month: string,
): Promise<ReviewEmployeeMonth> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ReviewEmployeeMonth>(
      `/timesheets/employees/${employeeId}/month`,
      { query: { month } },
    ),
  );
  return data;
}

export async function approveDay(
  employeeId: number,
  date: string,
  note?: string,
): Promise<ReviewDecisionResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReviewDecisionResult>(
      `/timesheets/review/${employeeId}/${date}/approve`,
      note ? { note } : {},
    ),
  );
  return data;
}

export async function rejectDay(
  employeeId: number,
  date: string,
  note: string,
): Promise<ReviewDecisionResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReviewDecisionResult>(
      `/timesheets/review/${employeeId}/${date}/reject`,
      { note },
    ),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Counts, reopen, correction, reports
// ---------------------------------------------------------------------------

export async function getReviewSummary(): Promise<ReviewSummary> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ReviewSummary>("/timesheets/review/summary"),
  );
  return data;
}

/** HR sends an approved day back to the employee (a reason is required). */
export async function reopenDay(
  employeeId: number,
  date: string,
  note: string,
): Promise<ReviewDecisionResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReviewDecisionResult>(
      `/timesheets/review/${employeeId}/${date}/reopen`,
      { note },
    ),
  );
  return data;
}

/** HR confirms the real end (IST `HH:mm`) of a timer closed with no time. */
export async function correctSession(
  sessionId: number,
  input: { endTime: string; reason: string },
): Promise<CorrectSessionResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CorrectSessionResult>(
      `/timesheets/sessions/${sessionId}/correct`,
      input,
    ),
  );
  return data;
}

export interface ReportQuery {
  from: string;
  to: string;
  teamId?: number;
  employeeId?: number;
}

export async function getEmployeeReport(
  query: ReportQuery,
): Promise<EmployeeReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeReport>("/timesheets/reports/employees", { query }),
  );
  return data;
}

function reportParams(query: ReportQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.teamId !== undefined) params.set("teamId", String(query.teamId));
  if (query.employeeId !== undefined) {
    params.set("employeeId", String(query.employeeId));
  }
  return params.toString();
}

/** Downloads the per-employee or the per-day report as a CSV file. */
export async function downloadReportCsv(
  kind: "employees" | "days",
  query: ReportQuery,
): Promise<void> {
  const blob = await fetchFile(
    `/timesheets/reports/${kind}.csv?${reportParams(query)}`,
  );
  downloadBlob(
    `timesheets-by-${kind === "days" ? "day" : "employee"}-${query.from}-to-${query.to}.csv`,
    blob,
  );
}

/** Per employee per day with work (drafts included), for the Week grid. */
export async function getDayReport(query: ReportQuery): Promise<DayReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<DayReport>("/timesheets/reports/days", { query }),
  );
  return data;
}
