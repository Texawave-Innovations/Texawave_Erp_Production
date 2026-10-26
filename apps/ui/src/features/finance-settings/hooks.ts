"use client";

import type {
  CreateFinanceMasterListItemInput,
  QueryFinanceMasterListItemsInput,
  UpdateFinanceMasterListItemInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createMasterListItem,
  deleteMasterListItem,
  listMasterListItems,
  updateMasterListItem,
} from "./api";

/**
 * React Query hooks — mirrors
 * apps/ui/src/features/sales-settings/hooks.ts's master-list-items section.
 * Query keys are org-scoped via `orgScopedKey`; mutations invalidate every
 * query under the resource's key prefix via `useOrgScopedMutation`.
 */
function masterListItemsKey(
  organizationId: number,
  query: QueryFinanceMasterListItemsInput,
) {
  return orgScopedKey(
    organizationId,
    "finance-settings-master-list-items",
    query,
  );
}

export function useMasterListItems(query: QueryFinanceMasterListItemsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: masterListItemsKey(organizationId ?? 0, query),
    queryFn: () => listMasterListItems(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateMasterListItem() {
  return useOrgScopedMutation(
    ["finance-settings-master-list-items"],
    (input: CreateFinanceMasterListItemInput) => createMasterListItem(input),
  );
}

export function useUpdateMasterListItem() {
  return useOrgScopedMutation(
    ["finance-settings-master-list-items"],
    ({ id, input }: { id: number; input: UpdateFinanceMasterListItemInput }) =>
      updateMasterListItem(id, input),
  );
}

export function useDeleteMasterListItem() {
  return useOrgScopedMutation(
    ["finance-settings-master-list-items"],
    (id: number) => deleteMasterListItem(id),
  );
}
