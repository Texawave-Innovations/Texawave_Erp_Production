"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveTask,
  createTask,
  listTasks,
  reassignTask,
  reopenTask,
  setTaskStatus,
  type CreateTaskBody,
  type TaskListQuery,
} from "./api";
import type { TaskStatus } from "./types";

const KEY = "hr-tasks" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useTasks(query: TaskListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listTasks(query),
    enabled: orgId > 0,
  });
}

export function useCreateTask() {
  return useOrgScopedMutation([KEY], (body: CreateTaskBody) =>
    createTask(body),
  );
}

export function useReassignTask() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, assigneeId }: { id: number; assigneeId: number }) =>
      reassignTask(id, assigneeId),
  );
}

export function useSetTaskStatus() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, status }: { id: number; status: TaskStatus }) =>
      setTaskStatus(id, status),
  );
}

export function useApproveTask() {
  return useOrgScopedMutation([KEY], (id: number) => approveTask(id));
}

export function useReopenTask() {
  return useOrgScopedMutation([KEY], (id: number) => reopenTask(id));
}
