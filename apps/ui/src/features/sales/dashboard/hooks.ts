"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createActionItem,
  deleteActionItem,
  getSalesDashboard,
  listActionItems,
  setActionItemDone,
} from "./api";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useSalesDashboard(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "dashboard"),
    queryFn: getSalesDashboard,
    enabled: enabled && orgId > 0,
  });
}

export function useOpenActionItems(enabled: boolean) {
  const orgId = useOrgId();
  const query = { page: 1, limit: 50, state: "open" as const };
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "action-items", query),
    queryFn: () => listActionItems(query),
    enabled: enabled && orgId > 0,
  });
}

// Checklist writes also move the dashboard's checklist counts, so they
// invalidate the whole Sales cache.
export function useCreateActionItem() {
  return useOrgScopedMutation(
    [SALES_KEY],
    (body: { title: string; dueDate?: string }) => createActionItem(body),
  );
}

export function useSetActionItemDone() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, done }: { id: number; done: boolean }) =>
      setActionItemDone(id, done),
  );
}

export function useDeleteActionItem() {
  return useOrgScopedMutation([SALES_KEY], (id: number) =>
    deleteActionItem(id),
  );
}
