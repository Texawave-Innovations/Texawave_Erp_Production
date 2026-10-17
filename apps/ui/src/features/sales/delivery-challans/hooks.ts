"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createChallan,
  deleteChallan,
  getChallan,
  listChallans,
  updateChallan,
  type ChallanListQuery,
} from "./api";
import type { DeliveryChallanBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useChallans(query: ChallanListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "challans", "list", query),
    queryFn: () => listChallans(query),
    enabled: enabled && orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useChallan(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "challans", "detail", id ?? 0),
    queryFn: () => getChallan(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useCreateChallan() {
  return useOrgScopedMutation([SALES_KEY], (body: DeliveryChallanBody) =>
    createChallan(body),
  );
}

export function useUpdateChallan() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: DeliveryChallanBody }) =>
      updateChallan(id, body),
  );
}

export function useDeleteChallan() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteChallan(id));
}
