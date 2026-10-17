"use client";

import type {
  AccountPriority,
  AccountTemperature,
  ChangeAccountStatusTagInput,
  CreateAccountInput,
  QueryAccountsInput,
  UpdateAccountInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  changeAccountPriority,
  changeAccountStatusTag,
  changeAccountTemperature,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  listAccountTimelineEvents,
  updateAccount,
} from "./api";

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

export function useAccount(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-account")
        : orgScopedKey(organizationId ?? 0, "crm-account", id),
    queryFn: () => getAccount(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return (id?: number) => {
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-accounts"),
    });
    if (id !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-account", id),
      });
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-account-timeline", id),
      });
    }
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAccountInput }) =>
      updateAccount(id, input),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

export function useChangeAccountStatusTag() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: ChangeAccountStatusTagInput;
    }) => changeAccountStatusTag(id, input),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useChangeAccountPriority() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: AccountPriority }) =>
      changeAccountPriority(id, priority),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

export function useChangeAccountTemperature() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({
      id,
      temperature,
    }: {
      id: number;
      temperature: AccountTemperature;
    }) => changeAccountTemperature(id, temperature),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

/** Audit-backed Timeline events (priority/temperature/status changes, edits, deletes). */
export function useAccountTimelineEvents(id: number) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-account-timeline", id),
    queryFn: () => listAccountTimelineEvents(id),
    enabled: Boolean(organizationId),
  });
}
