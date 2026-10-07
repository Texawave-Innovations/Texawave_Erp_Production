"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  checkIn,
  checkOut,
  getAttendance,
  listAttendance,
  listMyAttendance,
  manualEditAttendance,
  type AttendanceListQuery,
  type AttendanceRangeQuery,
  type ManualEditAttendanceBody,
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
