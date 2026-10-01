"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";

/**
 * A mutation that invalidates every cached query under `orgScopedKey(orgId,
 * ...keyPrefix)` on success — the create/update/delete shape every feature's
 * `hooks.ts` otherwise repeats (compare `features/_reference/tags/hooks.ts`).
 */
export function useOrgScopedMutation<TVariables, TData>(
  keyPrefix: readonly [string, ...string[]],
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, ...keyPrefix),
      });
    },
  });
}
