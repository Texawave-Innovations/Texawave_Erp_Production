"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { scmGet, scmList } from "./scm-api";

/** All SCM query keys live under `["scm", ...]` (after the organization id),
 * so any SCM mutation can invalidate related lists with one prefix — stock
 * moves touch overview, ledger, documents and dashboards at once. */
const SCM = "scm";

export function useScmOrgId() {
  return useAuthStore((s) => s.organizationId);
}

export function useScmList<T>(
  resource: string,
  path: string,
  query: object,
  enabled = true,
) {
  const organizationId = useScmOrgId();
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, SCM, resource, "list", query),
    queryFn: () => scmList<T>(path, query),
    enabled: Boolean(organizationId) && enabled,
  });
}

export function useScmOne<T>(
  resource: string,
  path: string,
  id: number | string | null,
  enabled = true,
) {
  const organizationId = useScmOrgId();
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, SCM, resource, "one", id ?? 0),
    queryFn: () => scmGet<T>(path),
    enabled: Boolean(organizationId) && id !== null && enabled,
  });
}

export function useScmData<T>(
  resource: string,
  key: ReadonlyArray<string | number | object>,
  fn: () => Promise<T>,
  enabled = true,
) {
  const organizationId = useScmOrgId();
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, SCM, resource, ...key),
    queryFn: fn,
    enabled: Boolean(organizationId) && enabled,
  });
}

/** Mutation that invalidates every SCM query for the organization on
 * success — simplest correct rule given how interlinked stock documents are. */
export function useScmMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
) {
  const queryClient = useQueryClient();
  const organizationId = useScmOrgId();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, SCM),
      });
    },
  });
}
