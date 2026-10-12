"use client";

import type {
  CreateAccountInput,
  QueryAccountsInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createAccount, listAccounts } from "./api";

function accountsKey(organizationId: number, query: QueryAccountsInput) {
  return orgScopedKey(organizationId, "crm-accounts", query);
}

export function useAccounts(query: QueryAccountsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: accountsKey(organizationId ?? 0, query),
    queryFn: () => listAccounts(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-accounts"),
      });
    },
  });
}
