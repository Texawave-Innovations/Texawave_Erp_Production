"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveLeaveRequest,
  cancelMyLeaveRequest,
  createMyLeaveRequest,
  hrLeaveBalances,
  type CreateLeaveRequestBody,
  type DecideLeaveBody,
  type LeaveListQuery,
  listLeaveRequests,
  listMyLeaveRequests,
  myLeaveBalances,
  rejectLeaveRequest,
  resubmitMyLeaveRequest,
} from "./api";

const KEY = "hr-leave-requests" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** HR/approver view: own/team/all, scoped server-side. */
export function useLeaveRequests(query: LeaveListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listLeaveRequests(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useHrLeaveBalances(employeeId: number | null, year?: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "hr-balances",
      employeeId ?? 0,
      year ?? 0,
    ),
    queryFn: () => hrLeaveBalances(employeeId as number, year),
    enabled: orgId > 0 && Boolean(employeeId),
  });
}

export function useApproveLeaveRequest() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideLeaveBody }) =>
      approveLeaveRequest(id, body),
  );
}

export function useRejectLeaveRequest() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: { note: string } }) =>
      rejectLeaveRequest(id, body),
  );
}

// ---- self-service ----------------------------------------------------------

export function useMyLeaveRequests(query: Omit<LeaveListQuery, "employeeId">) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyLeaveRequests(query),
    enabled: orgId > 0,
  });
}

export function useMyLeaveBalances(year?: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "my-balances", year ?? 0),
    queryFn: () => myLeaveBalances(year),
    enabled: orgId > 0,
  });
}

export function useCreateMyLeaveRequest() {
  return useOrgScopedMutation([KEY], (body: CreateLeaveRequestBody) =>
    createMyLeaveRequest(body),
  );
}

export function useCancelMyLeaveRequest() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: { note?: string } }) =>
      cancelMyLeaveRequest(id, body),
  );
}

export function useResubmitMyLeaveRequest() {
  return useOrgScopedMutation([KEY], (id: number) =>
    resubmitMyLeaveRequest(id),
  );
}
