"use client";

import type {
  CreateFinanceAccountInput,
  QueryFinanceAccountsInput,
  UpdateFinanceAccountInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountTree,
  listAccounts,
  updateAccount,
} from "./api";

function accountsKey(
  organizationId: number,
  query: QueryFinanceAccountsInput = {},
) {
  return orgScopedKey(organizationId, "finance-accounts", query);
}

export function useAccounts(query: QueryFinanceAccountsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: accountsKey(organizationId ?? 0, query),
    queryFn: () => listAccounts(query),
    enabled: Boolean(organizationId),
  });
}

export function useAccount(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-accounts",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getAccount(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useAccountTree() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "finance-accounts", "tree"),
    queryFn: () => getAccountTree(),
    enabled: Boolean(organizationId),
  });
}

export function useCreateAccount() {
  return useOrgScopedMutation(
    ["finance-accounts"],
    (input: CreateFinanceAccountInput) => createAccount(input),
  );
}

export function useUpdateAccount() {
  return useOrgScopedMutation(
    ["finance-accounts"],
    ({ id, input }: { id: number; input: UpdateFinanceAccountInput }) =>
      updateAccount(id, input),
  );
}

export function useDeleteAccount() {
  return useOrgScopedMutation(["finance-accounts"], (id: number) =>
    deleteAccount(id),
  );
}
