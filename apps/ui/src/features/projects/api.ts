import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  AttendanceGateStatus,
  EmployeeWorkView,
  TimeSummary,
  ExpenseVendor,
  ActiveTimer,
  DashboardMetrics,
  DepartmentSpendItem,
  PointsConfig,
  PointsLeaderboardEntry,
  Project,
  ProjectExpense,
  ProjectMilestone,
  ProjectTask,
  ResourceTracking,
  TaskTimeEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(
  query: Record<string, unknown> = {},
): Promise<{
  data: Project[];
  meta?: { total: number; page: number; limit: number };
}> {
  const res = await withAuthRetry(() =>
    apiClient.get<Project[]>("/projects", { query }),
  );
  return res as {
    data: Project[];
    meta?: { total: number; page: number; limit: number };
  };
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Project>(`/projects/${id}`),
  );
  return data;
}

export async function createProject(
  input: Record<string, unknown>,
): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Project>("/projects", input),
  );
  return data;
}

export async function updateProject(
  id: number,
  input: Record<string, unknown>,
): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Project>(`/projects/${id}`, input),
  );
  return data;
}

export async function deleteProject(
  id: number,
): Promise<{ success: boolean; message: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.delete<{ success: boolean; message: string }>(`/projects/${id}`),
  );
  return data;
}

export async function addProjectMember(
  projectId: number,
  input: Record<string, unknown>,
) {
  const { data } = await withAuthRetry(() =>
    apiClient.post(`/projects/${projectId}/members`, input),
  );
  return data;
}

export async function removeProjectMember(
  projectId: number,
  employeeId: number,
) {
  const { data } = await withAuthRetry(() =>
    apiClient.delete(`/projects/${projectId}/members/${employeeId}`),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function createMilestone(
  projectId: number,
  input: Record<string, unknown>,
): Promise<ProjectMilestone> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProjectMilestone>(
      `/projects/${projectId}/milestones`,
      input,
    ),
  );
  return data;
}

export async function updateMilestone(
  milestoneId: number,
  input: Record<string, unknown>,
): Promise<ProjectMilestone> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ProjectMilestone>(
      `/projects/milestones/${milestoneId}`,
      input,
    ),
  );
  return data;
}

export async function deleteMilestone(
  milestoneId: number,
): Promise<{ success: boolean }> {
  const { data } = await withAuthRetry(() =>
    apiClient.delete<{ success: boolean }>(
      `/projects/milestones/${milestoneId}`,
    ),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listProjectTasks(
  projectId: number,
): Promise<ProjectTask[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProjectTask[]>(`/projects/${projectId}/tasks`),
  );
  return data;
}

export async function getTask(taskId: number): Promise<ProjectTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProjectTask>(`/projects/tasks/${taskId}`),
  );
  return data;
}

export async function listMyWork(): Promise<ProjectTask[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProjectTask[]>("/projects/tasks/my-work"),
  );
  return data;
}

export async function createTask(
  projectId: number,
  input: Record<string, unknown>,
): Promise<ProjectTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProjectTask>(`/projects/${projectId}/tasks`, input),
  );
  return data;
}

export async function updateTask(
  taskId: number,
  input: Record<string, unknown>,
): Promise<ProjectTask> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ProjectTask>(`/projects/tasks/${taskId}`, input),
  );
  return data;
}

export async function deleteTask(
  taskId: number,
): Promise<{ success: boolean }> {
  const { data } = await withAuthRetry(() =>
    apiClient.delete<{ success: boolean }>(`/projects/tasks/${taskId}`),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Time Tracking & Stopwatch
// ---------------------------------------------------------------------------

export async function getMyTimeSummary(): Promise<TimeSummary> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TimeSummary>("/projects/tasks/time-summary/me"),
  );
  return data;
}

export async function getMyAttendanceStatus(): Promise<AttendanceGateStatus> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<AttendanceGateStatus>("/projects/tasks/attendance/me"),
  );
  return data;
}

export async function getEmployeeWork(
  employeeId: number,
): Promise<EmployeeWorkView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeWorkView>(`/projects/tasks/work/${employeeId}`),
  );
  return data;
}

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ActiveTimer | null>("/projects/tasks/timer/active"),
  );
  return data;
}

export async function startTimer(taskId: number): Promise<ActiveTimer> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ActiveTimer>(`/projects/tasks/${taskId}/timer/start`, {}),
  );
  return data;
}

export async function stopTimer(
  taskId: number,
  notes?: string,
): Promise<{ id: number; durationMinutes: number; endedAt: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ id: number; durationMinutes: number; endedAt: string }>(
      `/projects/tasks/${taskId}/timer/stop`,
      { notes },
    ),
  );
  return data;
}

export async function createManualTimeEntry(
  taskId: number,
  input: Record<string, unknown>,
) {
  const { data } = await withAuthRetry(() =>
    apiClient.post(`/projects/tasks/${taskId}/time-entries`, input),
  );
  return data;
}

export async function getTaskTimeEntries(
  taskId: number,
): Promise<TaskTimeEntry[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaskTimeEntry[]>(`/projects/tasks/${taskId}/time-entries`),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(
  query: Record<string, unknown> = {},
): Promise<ProjectExpense[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProjectExpense[]>("/projects/expenses", { query }),
  );
  return data;
}

export async function listExpenseVendors(): Promise<ExpenseVendor[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ExpenseVendor[]>("/projects/expenses/vendors"),
  );
  return data;
}

export async function createExpense(
  projectId: number,
  input: Record<string, unknown>,
): Promise<ProjectExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ProjectExpense>(`/projects/${projectId}/expenses`, input),
  );
  return data;
}

export async function updateExpense(
  expenseId: number,
  input: Record<string, unknown>,
): Promise<ProjectExpense> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ProjectExpense>(`/projects/expenses/${expenseId}`, input),
  );
  return data;
}

export async function deleteExpense(expenseId: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<{ success: boolean }>(`/projects/expenses/${expenseId}`),
  );
}

// ---------------------------------------------------------------------------
// Analytics & Gamification
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<DashboardMetrics>("/projects/analytics/dashboard"),
  );
  return data;
}

export async function getResourceTracking(): Promise<ResourceTracking> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ResourceTracking>("/projects/analytics/resources"),
  );
  return data;
}

export async function getDepartmentBreakdown(): Promise<{
  breakdown: DepartmentSpendItem[];
}> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ breakdown: DepartmentSpendItem[] }>(
      "/projects/analytics/department-breakdown",
    ),
  );
  return data;
}

export async function getPointsLeaderboard(): Promise<
  PointsLeaderboardEntry[]
> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PointsLeaderboardEntry[]>("/projects/points/leaderboard"),
  );
  return data;
}

export async function getPointsConfig(): Promise<PointsConfig> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PointsConfig>("/projects/points/config"),
  );
  return data;
}

export async function updatePointsConfig(
  input: Partial<PointsConfig>,
): Promise<PointsConfig> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PointsConfig>("/projects/points/config", input),
  );
  return data;
}
