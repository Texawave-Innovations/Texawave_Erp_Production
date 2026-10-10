"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMyTask,
  listMyTasks,
  TASK_STATUSES,
  updateMyTaskStatus,
  type CreateTaskInput,
} from "./api";

function key(organizationId: number) {
  return orgScopedKey(organizationId, "self-service-tasks", "list");
}

export function useMyTasks() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: key(organizationId ?? 0),
    queryFn: listMyTasks,
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyTask() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createMyTask(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: key(organizationId ?? 0),
      });
    },
  });
}

export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: (typeof TASK_STATUSES)[number];
    }) => updateMyTaskStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: key(organizationId ?? 0),
      });
    },
  });
}
