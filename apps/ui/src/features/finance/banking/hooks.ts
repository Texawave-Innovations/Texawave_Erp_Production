"use client";

import type {
  CreateFinanceBankAccountInput,
  CreateFinanceBankTransactionInput,
  QueryFinanceBankAccountsInput,
  QueryFinanceBankTransactionsInput,
  ReconcileBankTransactionInput,
  UpdateFinanceBankAccountInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createBankAccount,
  createBankTransaction,
  deleteBankAccount,
  getBankAccount,
  getBankTransaction,
  listBankAccounts,
  listBankTransactions,
  reconcileBankTransaction,
  unreconcileBankTransaction,
  updateBankAccount,
} from "./api";

function bankAccountsKey(
  organizationId: number,
  query: QueryFinanceBankAccountsInput = {},
) {
  return orgScopedKey(organizationId, "finance-bank-accounts", query);
}

function bankTransactionsKey(
  organizationId: number,
  query: QueryFinanceBankTransactionsInput = {},
) {
  return orgScopedKey(organizationId, "finance-bank-transactions", query);
}

export function useBankAccounts(query: QueryFinanceBankAccountsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: bankAccountsKey(organizationId ?? 0, query),
    queryFn: () => listBankAccounts(query),
    enabled: Boolean(organizationId),
  });
}

export function useBankAccount(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-bank-accounts",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getBankAccount(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useBankTransactions(
  query: QueryFinanceBankTransactionsInput = {},
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: bankTransactionsKey(organizationId ?? 0, query),
    queryFn: () => listBankTransactions(query),
    enabled: Boolean(organizationId),
  });
}

export function useBankTransaction(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-bank-transactions",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getBankTransaction(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useCreateBankAccount() {
  return useOrgScopedMutation(
    ["finance-bank-accounts"],
    (input: CreateFinanceBankAccountInput) => createBankAccount(input),
  );
}

export function useUpdateBankAccount() {
  return useOrgScopedMutation(
    ["finance-bank-accounts"],
    ({ id, input }: { id: number; input: UpdateFinanceBankAccountInput }) =>
      updateBankAccount(id, input),
  );
}

export function useDeleteBankAccount() {
  return useOrgScopedMutation(["finance-bank-accounts"], (id: number) =>
    deleteBankAccount(id),
  );
}

export function useRecordBankTransaction() {
  return useOrgScopedMutation(
    [
      "finance-bank-transactions",
      "finance-bank-accounts",
      "finance-journal-entries",
      "finance-accounts",
    ],
    (input: CreateFinanceBankTransactionInput) => createBankTransaction(input),
  );
}

export function useReconcileBankTransaction() {
  return useOrgScopedMutation(
    ["finance-bank-transactions", "finance-bank-accounts"],
    ({ id, input }: { id: number; input?: ReconcileBankTransactionInput }) =>
      reconcileBankTransaction(id, input),
  );
}

export function useUnreconcileBankTransaction() {
  return useOrgScopedMutation(
    ["finance-bank-transactions", "finance-bank-accounts"],
    (id: number) => unreconcileBankTransaction(id),
  );
}
