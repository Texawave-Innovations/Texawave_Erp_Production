"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  addProjectMember,
  createExpense,
  createMilestone,
  createProject,
  createTask,
  deleteMilestone,
  deleteProject,
  deleteTask,
  getActiveTimer,
  getDashboardMetrics,
  getDepartmentBreakdown,
  getPointsConfig,
  getPointsLeaderboard,
  getProject,
  getResourceTracking,
  getTask,
  listExpenses,
  listMyWork,
  listProjects,
  listProjectTasks,
  removeProjectMember,
  startTimer,
  stopTimer,
  updateExpense,
  updateMilestone,
  updatePointsConfig,
  updateProject,
  updateTask,
} from "./api";

function baseKey(orgId: number, ...parts: unknown[]) {
  return ["org", orgId, "projects", ...parts];
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function useProjects(query: Record<string, unknown> = {}) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "list", query),
    queryFn: () => listProjects(query),
    enabled: Boolean(orgId),
  });
}

export function useProject(id: number | undefined) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "detail", id),
    queryFn: () => getProject(id as number),
    enabled: Boolean(orgId) && Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Record<string, unknown>;
    }) => updateProject(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "detail", id) });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "list") });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "list") });
    },
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: number;
      input: Record<string, unknown>;
    }) => addProjectMember(projectId, input),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "detail", projectId),
      });
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      projectId,
      employeeId,
    }: {
      projectId: number;
      employeeId: number;
    }) => removeProjectMember(projectId, employeeId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "detail", projectId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: number;
      input: Record<string, unknown>;
    }) => createMilestone(projectId, input),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "detail", projectId),
      });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      milestoneId,
      input,
    }: {
      milestoneId: number;
      input: Record<string, unknown>;
    }) => updateMilestone(milestoneId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (milestoneId: number) => deleteMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function useProjectTasks(projectId: number | undefined) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "tasks", projectId),
    queryFn: () => listProjectTasks(projectId as number),
    enabled: Boolean(orgId) && Boolean(projectId),
  });
}

export function useTask(taskId: number | undefined) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "task", taskId),
    queryFn: () => getTask(taskId as number),
    enabled: Boolean(orgId) && Boolean(taskId),
  });
}

export function useMyWork() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "my-work"),
    queryFn: () => listMyWork(),
    enabled: Boolean(orgId),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: number;
      input: Record<string, unknown>;
    }) => createTask(projectId, input),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "tasks", projectId),
      });
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "detail", projectId),
      });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "my-work") });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: number;
      input: Record<string, unknown>;
    }) => updateTask(taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Time Tracking & Stopwatch
// ---------------------------------------------------------------------------

export function useActiveTimer() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "timer", "active"),
    queryFn: () => getActiveTimer(),
    enabled: Boolean(orgId),
    refetchInterval: 30000, // poll every 30 seconds for background sync
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (taskId: number) => startTimer(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "timer") });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "my-work") });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({ taskId, notes }: { taskId: number; notes?: string }) =>
      stopTimer(taskId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "timer") });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export function useExpenses(query: Record<string, unknown> = {}) {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "expenses", query),
    queryFn: () => listExpenses(query),
    enabled: Boolean(orgId),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: number;
      input: Record<string, unknown>;
    }) => createExpense(projectId, input),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "expenses") });
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "detail", projectId),
      });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "analytics") });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: ({
      expenseId,
      input,
    }: {
      expenseId: number;
      input: Record<string, unknown>;
    }) => updateExpense(expenseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "expenses") });
      queryClient.invalidateQueries({ queryKey: baseKey(orgId, "analytics") });
    },
  });
}

// ---------------------------------------------------------------------------
// Analytics & Leaderboard
// ---------------------------------------------------------------------------

export function useDashboardMetrics() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "analytics", "dashboard"),
    queryFn: () => getDashboardMetrics(),
    enabled: Boolean(orgId),
  });
}

export function useResourceTracking() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "analytics", "resources"),
    queryFn: () => getResourceTracking(),
    enabled: Boolean(orgId),
  });
}

export function useDepartmentBreakdown() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "analytics", "departments"),
    queryFn: () => getDepartmentBreakdown(),
    enabled: Boolean(orgId),
  });
}

export function usePointsLeaderboard() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "points", "leaderboard"),
    queryFn: () => getPointsLeaderboard(),
    enabled: Boolean(orgId),
  });
}

export function usePointsConfig() {
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useQuery({
    queryKey: baseKey(orgId, "points", "config"),
    queryFn: () => getPointsConfig(),
    enabled: Boolean(orgId),
  });
}

export function useUpdatePointsConfig() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId) ?? 0;
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => updatePointsConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: baseKey(orgId, "points", "config"),
      });
    },
  });
}
