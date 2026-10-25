"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { listFullMonthPresent } from "@/features/hr/full-month-present/api";
import {
  approveMonths,
  decideMonth,
  finalizeMonth,
  getDailyReport,
  importAttendanceCsv,
  listMissingPunches,
  listMonthLocks,
  type MissingPunchQuery,
  type MonthDecision,
  type MonthLockQuery,
  type PageQuery,
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

export function useAttendanceList(query: AttendanceListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listAttendance(query),
    enabled: orgId > 0 && enabled,
  });
}

/** Derived per-day statuses of one employee for one month (from the
 * full-month-present report, which also derives unmarked/off days). Kept
 * under the attendance key so attendance changes refresh it. */
export function useEmployeeMonthStatuses(
  month: string,
  employeeId: number | null,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "employee-month",
      month,
      employeeId ?? 0,
    ),
    queryFn: () =>
      listFullMonthPresent({
        page: 1,
        limit: 1,
        month,
        employeeId: employeeId as number,
      }),
    enabled: orgId > 0 && employeeId !== null,
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

export function useMyAttendance(query: AttendanceRangeQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyAttendance(query),
    enabled: orgId > 0 && enabled,
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

export function useDailyReport(query: PageQuery & { date: string }) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "daily", query),
    queryFn: () => getDailyReport(query),
    enabled: orgId > 0 && query.date !== "",
  });
}

export function useMissingPunches(query: MissingPunchQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "missing", query),
    queryFn: () => listMissingPunches(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useMonthLocks(query: MonthLockQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "month-locks", query),
    queryFn: () => listMonthLocks(query),
    enabled: orgId > 0,
  });
}

// Month-close and import results change what every attendance list shows
// (locks, new punches), so they invalidate the whole attendance key.
export function useFinalizeMonth() {
  return useOrgScopedMutation(
    [KEY],
    (body: { month: string; employeeIds?: number[] }) => finalizeMonth(body),
  );
}

export function useApproveMonths() {
  return useOrgScopedMutation([KEY], (body: { ids: number[]; note?: string }) =>
    approveMonths(body),
  );
}

export function useDecideMonth() {
  return useOrgScopedMutation(
    [KEY],
    ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: MonthDecision;
      note: string;
    }) => decideMonth(id, decision, note),
  );
}

export function useImportAttendance() {
  return useOrgScopedMutation(
    [KEY],
    ({ file, dryRun }: { file: File; dryRun: boolean }) =>
      importAttendanceCsv(file, dryRun),
  );
}
