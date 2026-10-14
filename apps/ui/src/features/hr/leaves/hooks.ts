"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  type AwaitingQuery,
  type BalanceReportQuery,
  type CreateDelegationBody,
  createLeaveDelegation,
  createLeaveOnBehalf,
  hrCancelLeaveRequest,
  importLeaveEntitlementsCsv,
  leaveBalanceReport,
  listAwaitingLeave,
  listDelegationCandidates,
  listLeaveDelegations,
  revokeLeaveDelegation,
  approveLeaveRequest,
  cancelMyLeaveRequest,
  createLeaveType,
  createMyLeaveRequest,
  hrLeaveBalances,
  type CreateLeaveRequestBody,
  type DecideLeaveBody,
  type LeaveListQuery,
  type LeaveTypeBody,
  type LeaveTypeListQuery,
  listLeaveRequests,
  listLeaveTypes,
  listMyLeaveRequests,
  myLeaveBalances,
  rejectLeaveRequest,
  resubmitMyLeaveRequest,
  setLeaveEntitlement,
  setLeaveTypeActive,
  updateLeaveType,
} from "./api";

const KEY = "hr-leave-requests" as const;
const LEAVE_TYPES_KEY = "hr-leave-types" as const;
const DELEGATIONS_KEY = "hr-leave-delegations" as const;

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

// ---- leave type administration ---------------------------------------------

export function useLeaveTypes(query: LeaveTypeListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, LEAVE_TYPES_KEY, "list", query),
    queryFn: () => listLeaveTypes(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateLeaveType() {
  return useOrgScopedMutation(
    [LEAVE_TYPES_KEY],
    (body: LeaveTypeBody & { code: string }) => createLeaveType(body),
  );
}

export function useUpdateLeaveType() {
  return useOrgScopedMutation(
    [LEAVE_TYPES_KEY],
    ({ id, body }: { id: number; body: Omit<LeaveTypeBody, "code"> }) =>
      updateLeaveType(id, body),
  );
}

export function useSetLeaveTypeActive() {
  return useOrgScopedMutation(
    [LEAVE_TYPES_KEY],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setLeaveTypeActive(id, isActive),
  );
}

/** Per-employee entitlement override (Docs/HR_LEAVE.md §6, D11). Also
 * invalidates `KEY` so an open balances view (self-service or HR) reflects
 * the new entitlement without a manual refresh. */
export function useSetLeaveEntitlement() {
  return useOrgScopedMutation(
    [KEY],
    ({
      employeeId,
      leaveTypeId,
      year,
      annualEntitlement,
    }: {
      employeeId: number;
      leaveTypeId: number;
      year: number;
      annualEntitlement: number | null;
    }) => setLeaveEntitlement(employeeId, leaveTypeId, year, annualEntitlement),
  );
}

// ---- approval queue and HR actions -----------------------------------------

/** What waits for the caller's decision (GET /hr/leave-requests/approvals). */
export function useAwaitingLeave(query: AwaitingQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "awaiting", query),
    queryFn: () => listAwaitingLeave(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateLeaveOnBehalf() {
  return useOrgScopedMutation(
    [KEY],
    (body: CreateLeaveRequestBody & { employeeId: number }) =>
      createLeaveOnBehalf(body),
  );
}

export function useHrCancelLeave() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, note }: { id: number; note: string }) =>
      hrCancelLeaveRequest(id, { note }),
  );
}

/** Totals per status for the stat cards: one `limit=1` call each, reading
 * only `meta.total`, with every other filter applied. */
export function useLeaveStatusCounts(
  query: Omit<LeaveListQuery, "page" | "limit" | "status">,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "status-counts", query),
    queryFn: async () => {
      const statuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ] as const;
      const [all, ...each] = await Promise.all([
        listLeaveRequests({ ...query, page: 1, limit: 1 }),
        ...statuses.map((status) =>
          listLeaveRequests({ ...query, status, page: 1, limit: 1 }),
        ),
      ]);
      return {
        total: all.meta.total,
        PENDING: each[0]?.meta.total ?? 0,
        APPROVED: each[1]?.meta.total ?? 0,
        REJECTED: each[2]?.meta.total ?? 0,
        CANCELLED: each[3]?.meta.total ?? 0,
      };
    },
    enabled: orgId > 0 && enabled,
  });
}

// ---- allotment / balance report --------------------------------------------

export function useLeaveBalanceReport(
  query: BalanceReportQuery,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "balance-report", query),
    queryFn: () => leaveBalanceReport(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useImportLeaveEntitlements() {
  return useOrgScopedMutation(
    [KEY],
    ({ file, dryRun }: { file: File; dryRun: boolean }) =>
      importLeaveEntitlementsCsv(file, dryRun),
  );
}

// ---- delegations -----------------------------------------------------------

export function useLeaveDelegations(
  query: { page: number; limit: number; activeOnly?: boolean },
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DELEGATIONS_KEY, "list", query),
    queryFn: () => listLeaveDelegations(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useDelegationCandidates(search: string, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DELEGATIONS_KEY, "candidates", search),
    queryFn: () => listDelegationCandidates(search),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateLeaveDelegation() {
  return useOrgScopedMutation([DELEGATIONS_KEY], (body: CreateDelegationBody) =>
    createLeaveDelegation(body),
  );
}

export function useRevokeLeaveDelegation() {
  return useOrgScopedMutation([DELEGATIONS_KEY], (id: number) =>
    revokeLeaveDelegation(id),
  );
}
