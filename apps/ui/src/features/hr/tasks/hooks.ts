"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveTask,
  createMyTask,
  createTask,
  listMyTasks,
  listTasks,
  reassignTask,
  reopenTask,
  setMyTaskStatus,
  setTaskStatus,
  type CreateMyTaskBody,
  type CreateTaskBody,
  type MyTaskListQuery,
  type MyTaskStatus,
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

// ---- self-service: tasks assigned to or created by the caller -------------

export function useMyTasks(query: MyTaskListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyTasks(query),
    enabled: orgId > 0,
  });
}

export function useCreateMyTask() {
  return useOrgScopedMutation([KEY], (body: CreateMyTaskBody) =>
    createMyTask(body),
  );
}

export function useSetMyTaskStatus() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, status }: { id: number; status: MyTaskStatus }) =>
      setMyTaskStatus(id, status),
  );
}
