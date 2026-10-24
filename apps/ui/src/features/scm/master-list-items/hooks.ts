"use client";

import type {
  CreateScmMasterListItemInput,
  QueryScmMasterListItemsInput,
  UpdateScmMasterListItemInput,
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
 * React Query hooks — mirrors apps/ui/src/features/finance-settings/hooks.ts.
 * Query keys are org-scoped via `orgScopedKey`; mutations invalidate every
 * query under the resource's key prefix via `useOrgScopedMutation`.
 */
function masterListItemsKey(
  organizationId: number,
  query: QueryScmMasterListItemsInput,
) {
  return orgScopedKey(organizationId, "scm-master-list-items", query);
}

export function useMasterListItems(query: QueryScmMasterListItemsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: masterListItemsKey(organizationId ?? 0, query),
    queryFn: () => listMasterListItems(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateMasterListItem() {
  return useOrgScopedMutation(
    ["scm-master-list-items"],
    (input: CreateScmMasterListItemInput) => createMasterListItem(input),
  );
}

export function useUpdateMasterListItem() {
  return useOrgScopedMutation(
    ["scm-master-list-items"],
    ({ id, input }: { id: number; input: UpdateScmMasterListItemInput }) =>
      updateMasterListItem(id, input),
  );
}

export function useDeleteMasterListItem() {
  return useOrgScopedMutation(["scm-master-list-items"], (id: number) =>
    deleteMasterListItem(id),
  );
}
