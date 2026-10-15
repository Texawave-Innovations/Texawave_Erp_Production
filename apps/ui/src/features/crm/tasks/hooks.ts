"use client";

import type {
  CreateCrmTaskInput,
  QueryCrmTasksInput,
  UpdateCrmTaskInput,
  UpdateCrmTaskStatusInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createCrmTask,
  deleteCrmTask,
  getCrmTask,
  listCrmTasks,
  updateCrmTask,
  updateCrmTaskStatus,
} from "./api";

function tasksKey(organizationId: number, query: QueryCrmTasksInput) {
  return orgScopedKey(organizationId, "crm-tasks", query);
}

export function useCrmTasks(query: QueryCrmTasksInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: tasksKey(organizationId ?? 0, query),
    queryFn: () => listCrmTasks(query),
    enabled: Boolean(organizationId),
  });
}

export function useCrmTask(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-task")
        : orgScopedKey(organizationId ?? 0, "crm-task", id),
    queryFn: () => getCrmTask(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateCrmTasks() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-tasks"),
    });
}

export function useCreateCrmTask() {
  const invalidate = useInvalidateCrmTasks();
  return useMutation({
    mutationFn: (input: CreateCrmTaskInput) => createCrmTask(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCrmTask() {
  const invalidate = useInvalidateCrmTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCrmTaskInput }) =>
      updateCrmTask(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCrmTaskStatus() {
  const invalidate = useInvalidateCrmTasks();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateCrmTaskStatusInput;
    }) => updateCrmTaskStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCrmTask() {
  const invalidate = useInvalidateCrmTasks();
  return useMutation({
    mutationFn: (id: number) => deleteCrmTask(id),
    onSuccess: invalidate,
  });
}
