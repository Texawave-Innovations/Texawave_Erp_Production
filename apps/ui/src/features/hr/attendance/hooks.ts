"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveAttendanceCorrection,
  checkIn,
  checkOut,
  getAttendance,
  listAttendance,
  listAttendanceCorrections,
  listMyAttendance,
  manualEditAttendance,
  rejectAttendanceCorrection,
  submitAttendanceCorrection,
  type AttendanceListQuery,
  type AttendanceRangeQuery,
  type CorrectionListQuery,
  type DecideCorrectionBody,
  type ManualEditAttendanceBody,
  type SubmitCorrectionBody,
} from "./api";

const KEY = "hr-attendance" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useAttendanceList(query: AttendanceListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listAttendance(query),
    enabled: orgId > 0,
  });
}

export function useAttendanceRecord(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "detail", id ?? 0),
    queryFn: () => getAttendance(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useMyAttendance(query: AttendanceRangeQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyAttendance(query),
    enabled: orgId > 0,
  });
}

export function useManualEditAttendance() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: ManualEditAttendanceBody }) =>
      manualEditAttendance(id, body),
  );
}

export function useCheckIn() {
  return useOrgScopedMutation([KEY], () => checkIn());
}

export function useCheckOut() {
  return useOrgScopedMutation([KEY], () => checkOut());
}

const CORRECTIONS_KEY = "hr-attendance-corrections" as const;

export function useAttendanceCorrections(query: CorrectionListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, CORRECTIONS_KEY, "list", query),
    queryFn: () => listAttendanceCorrections(query),
    enabled: orgId > 0,
  });
}

export function useSubmitAttendanceCorrection() {
  return useOrgScopedMutation([CORRECTIONS_KEY], (body: SubmitCorrectionBody) =>
    submitAttendanceCorrection(body),
  );
}

/** Approving/rejecting a correction can change the underlying attendance
 * record (approval applies the punch change transactionally server-side), so
 * both the corrections list and the attendance list/detail caches need to be
 * invalidated — unlike the other mutations here, one `keyPrefix` is not
 * enough. */
function useDecideCorrectionMutation(
  decide: (id: number, body: DecideCorrectionBody) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DecideCorrectionBody }) =>
      decide(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, CORRECTIONS_KEY),
      });
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, KEY),
      });
    },
  });
}

export function useApproveAttendanceCorrection() {
  return useDecideCorrectionMutation(approveAttendanceCorrection);
}

export function useRejectAttendanceCorrection() {
  return useDecideCorrectionMutation(rejectAttendanceCorrection);
}
