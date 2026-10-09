"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import {
  approveRun,
  cancelPeriod,
  type CreatePeriodBody,
  type CreateRunBody,
  createPeriod,
  createRun,
  type EntryListQuery,
  finalizePeriod,
  getEntry,
  getPeriod,
  listAllRunEntries,
  listEntries,
  listPeriods,
  listRuns,
  type PeriodListQuery,
  type RunListQuery,
} from "./api";

/** One root for every payroll query: a period/run change also changes runs,
 * entries and payslips, so mutations invalidate the whole subtree. */
const KEY = "hr-payroll" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

// ---- periods --------------------------------------------------------------

export function usePeriods(query: PeriodListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "periods", query),
    queryFn: () => listPeriods(query),
    enabled: orgId > 0 && enabled,
  });
}

export function usePeriod(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "period", id ?? 0),
    queryFn: () => getPeriod(id as number),
    enabled: orgId > 0 && Boolean(id),
  });
}

export function useCreatePeriod() {
  return useOrgScopedMutation([KEY], (body: CreatePeriodBody) =>
    createPeriod(body),
  );
}

export function useCancelPeriod() {
  return useOrgScopedMutation([KEY], (id: number) => cancelPeriod(id));
}

export function useFinalizePeriod() {
  return useOrgScopedMutation([KEY], (id: number) => finalizePeriod(id));
}

// ---- runs -----------------------------------------------------------------

export function useRuns(query: RunListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "runs", query),
    queryFn: () => listRuns(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateRun() {
  return useOrgScopedMutation([KEY], (body: CreateRunBody) => createRun(body));
}

export function useApproveRun() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, notes }: { id: number; notes?: string }) =>
      approveRun(id, notes ? { notes } : {}),
  );
}

// ---- entries --------------------------------------------------------------

export function useEntries(query: EntryListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "entries", query),
    queryFn: () => listEntries(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useEntry(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "entry", id ?? 0),
    queryFn: () => getEntry(id as number),
    enabled: orgId > 0 && Boolean(id),
  });
}

export function useAllRunEntries(runId: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "run-entries-all", runId ?? 0),
    queryFn: () => listAllRunEntries(runId as number),
    enabled: orgId > 0 && Boolean(runId),
  });
}
