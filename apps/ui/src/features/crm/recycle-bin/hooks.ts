"use client";

import type {
  CrmRecycleBinEntityType,
  QueryCrmRecycleBinInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  getRecycleBinSummary,
  listRecycleBin,
  purgeRecycleBinItem,
  restoreRecycleBinItem,
} from "./api";

export function useRecycleBin(query: QueryCrmRecycleBinInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-recycle-bin", query),
    queryFn: () => listRecycleBin(query),
    enabled: Boolean(organizationId),
  });
}

export function useRecycleBinSummary() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-recycle-bin-summary"),
    queryFn: getRecycleBinSummary,
    enabled: Boolean(organizationId),
  });
}

/** Restoring/purging changes the bin and, for restore, every live CRM list. */
function useInvalidateAfterChange() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return (restored: boolean) => {
    const org = organizationId ?? 0;
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(org, "crm-recycle-bin"),
    });
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(org, "crm-recycle-bin-summary"),
    });
    if (restored) void queryClient.invalidateQueries();
  };
}

export function useRestoreRecycleBinItem() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: (v: { entityType: CrmRecycleBinEntityType; id: number }) =>
      restoreRecycleBinItem(v.entityType, v.id),
    onSuccess: () => invalidate(true),
  });
}

export function usePurgeRecycleBinItem() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: (v: { entityType: CrmRecycleBinEntityType; id: number }) =>
      purgeRecycleBinItem(v.entityType, v.id),
    onSuccess: () => invalidate(false),
  });
}
