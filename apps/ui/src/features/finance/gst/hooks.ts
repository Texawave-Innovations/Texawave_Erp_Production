"use client";

import type {
  CreateFinanceGstEntryInput,
  FinanceGstEntryType,
  QueryFinanceGstEntriesInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createGstEntry,
  getGstEntry,
  getGstReconciliationSummary,
  getGstr1Summary,
  getGstr3bSummary,
  getHsnSummary,
  listGstEntries,
  reconcileGst,
  type ReconcileGstInput,
} from "./api";

function gstEntriesKey(
  organizationId: number,
  query: QueryFinanceGstEntriesInput = {},
) {
  return orgScopedKey(organizationId, "finance-gst-entries", query);
}

export function useGstEntries(query: QueryFinanceGstEntriesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: gstEntriesKey(organizationId ?? 0, query),
    queryFn: () => listGstEntries(query),
    enabled: Boolean(organizationId),
  });
}

export function useGstEntry(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-gst-entries",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getGstEntry(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useGstr1Summary(period: string) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-gstr1-summary",
      period,
    ),
    queryFn: () => getGstr1Summary(period),
    enabled: Boolean(organizationId) && Boolean(period),
  });
}

export function useGstr3bSummary(period: string) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-gstr3b-summary",
      period,
    ),
    queryFn: () => getGstr3bSummary(period),
    enabled: Boolean(organizationId) && Boolean(period),
  });
}

export function useHsnSummary(query: {
  period?: string;
  startDate?: string;
  endDate?: string;
  entryType?: FinanceGstEntryType;
}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "finance-hsn-summary", query),
    queryFn: () => getHsnSummary(query),
    enabled: Boolean(organizationId),
  });
}

export function useGstReconciliationSummary(period: string) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-gst-reconciliation-summary",
      period,
    ),
    queryFn: () => getGstReconciliationSummary(period),
    enabled: Boolean(organizationId) && Boolean(period),
  });
}

export function useCreateGstEntry() {
  return useOrgScopedMutation(
    [
      "finance-gst-entries",
      "finance-gstr1-summary",
      "finance-gstr3b-summary",
      "finance-hsn-summary",
      "finance-gst-reconciliation-summary",
    ],
    (input: CreateFinanceGstEntryInput) => createGstEntry(input),
  );
}

export function useReconcileGst() {
  return useOrgScopedMutation(
    [
      "finance-gst-entries",
      "finance-gst-reconciliation-summary",
      "finance-gstr3b-summary",
    ],
    (input: ReconcileGstInput) => reconcileGst(input),
  );
}
