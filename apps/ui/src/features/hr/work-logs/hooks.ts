"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveWorkLog,
  createMyWorkLog,
  listMyWorkLogs,
  listWorkLogApprovals,
  listWorkLogs,
  rejectWorkLog,
  type CreateWorkLogBody,
  type DecideWorkLogBody,
  type WorkLogListQuery,
} from "./api";

const KEY = "hr-work-logs" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useWorkLogs(query: WorkLogListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listWorkLogs(query),
    enabled: orgId > 0,
  });
}

export function useWorkLogApprovals(
  query: Omit<WorkLogListQuery, "employeeId">,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "approvals", query),
    queryFn: () => listWorkLogApprovals(query),
    enabled: orgId > 0,
  });
}

export function useMyWorkLogs(query: Omit<WorkLogListQuery, "employeeId">) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyWorkLogs(query),
    enabled: orgId > 0,
  });
}

export function useApproveWorkLog() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideWorkLogBody }) =>
      approveWorkLog(id, body),
  );
}

export function useRejectWorkLog() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideWorkLogBody }) =>
      rejectWorkLog(id, body),
  );
}

export function useCreateMyWorkLog() {
  return useOrgScopedMutation([KEY], (body: CreateWorkLogBody) =>
    createMyWorkLog(body),
  );
}
