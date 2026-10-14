"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createMyExitRequest,
  listExitRequests,
  listMyExitRequests,
  updateExitRequest,
  type CreateExitRequestBody,
  type ExitRequestListQuery,
  type UpdateExitRequestBody,
} from "./api";

const KEY = "hr-exit-requests" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** HR view: own/team/all, scoped server-side. */
export function useExitRequests(query: ExitRequestListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listExitRequests(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useUpdateExitRequest() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UpdateExitRequestBody }) =>
      updateExitRequest(id, body),
  );
}

// ---- self-service -----------------------------------------------------------

export function useMyExitRequests(
  query: Omit<ExitRequestListQuery, "employeeId">,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyExitRequests(query),
    enabled: orgId > 0,
  });
}

export function useCreateMyExitRequest() {
  return useOrgScopedMutation([KEY], (body: CreateExitRequestBody) =>
    createMyExitRequest(body),
  );
}
