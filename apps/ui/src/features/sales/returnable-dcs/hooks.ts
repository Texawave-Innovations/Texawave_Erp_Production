"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createRdc,
  deleteRdc,
  getRdc,
  listRdcs,
  markRdcReturned,
  reopenRdc,
  updateRdc,
  type RdcListQuery,
} from "./api";
import type { ReturnableDcBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useRdcs(query: RdcListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "rdcs", "list", query),
    queryFn: () => listRdcs(query),
    enabled: enabled && orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useRdc(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "rdcs", "detail", id ?? 0),
    queryFn: () => getRdc(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useCreateRdc() {
  return useOrgScopedMutation([SALES_KEY], (body: ReturnableDcBody) =>
    createRdc(body),
  );
}

export function useUpdateRdc() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: ReturnableDcBody }) =>
      updateRdc(id, body),
  );
}

export function useMarkRdcReturned() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, returnedDate }: { id: number; returnedDate: string }) =>
      markRdcReturned(id, returnedDate),
  );
}

export function useReopenRdc() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => reopenRdc(id));
}

export function useDeleteRdc() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteRdc(id));
}
