"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMyExpenseClaim,
  listMyExpenseClaims,
  type CreateExpenseClaimInput,
} from "./api";

function key(organizationId: number) {
  return orgScopedKey(organizationId, "self-service-expense-claims", "list");
}

export function useMyExpenseClaims() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: key(organizationId ?? 0),
    queryFn: listMyExpenseClaims,
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyExpenseClaim() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateExpenseClaimInput) => createMyExpenseClaim(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: key(organizationId ?? 0),
      });
    },
  });
}
