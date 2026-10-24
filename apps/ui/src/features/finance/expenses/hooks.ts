"use client";

import type {
  CreateExpenseFromClaimInput,
  CreateFinanceExpenseInput,
  QueryFinanceExpensesInput,
  RecordExpensePaymentInput,
  UpdateFinanceExpenseInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveExpense,
  cancelExpense,
  createExpense,
  createExpenseFromClaim,
  deleteExpense,
  getExpense,
  listActiveBankAccounts,
  listExpenses,
  payExpense,
  rejectExpense,
  submitExpense,
  updateExpense,
} from "./api";

function expensesKey(
  organizationId: number,
  query: QueryFinanceExpensesInput = {},
) {
  return orgScopedKey(organizationId, "finance-expenses", query);
}

export function useExpenses(query: QueryFinanceExpensesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: expensesKey(organizationId ?? 0, query),
    queryFn: () => listExpenses(query),
    enabled: Boolean(organizationId),
  });
}

export function useExpense(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-expenses",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getExpense(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useActiveBankAccounts() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-bank-accounts",
      "active",
    ),
    queryFn: () => listActiveBankAccounts(),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useCreateExpense() {
  return useOrgScopedMutation(
    [
      "finance-expenses",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    (input: CreateFinanceExpenseInput) => createExpense(input),
  );
}

export function useUpdateExpense() {
  return useOrgScopedMutation(
    ["finance-expenses"],
    ({ id, input }: { id: number; input: UpdateFinanceExpenseInput }) =>
      updateExpense(id, input),
  );
}

export function useSubmitExpense() {
  return useOrgScopedMutation(["finance-expenses"], (id: number) =>
    submitExpense(id),
  );
}

export function useApproveExpense() {
  return useOrgScopedMutation(["finance-expenses"], (id: number) =>
    approveExpense(id),
  );
}

export function useRejectExpense() {
  return useOrgScopedMutation(["finance-expenses"], (id: number) =>
    rejectExpense(id),
  );
}

export function usePayExpense() {
  return useOrgScopedMutation(
    [
      "finance-expenses",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    ({ id, input }: { id: number; input: RecordExpensePaymentInput }) =>
      payExpense(id, input),
  );
}

export function useCancelExpense() {
  return useOrgScopedMutation(
    [
      "finance-expenses",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    (id: number) => cancelExpense(id),
  );
}

export function useCreateExpenseFromClaim() {
  return useOrgScopedMutation(
    [
      "finance-expenses",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
      "hr-expense-claims",
    ],
    ({
      claimId,
      input,
    }: {
      claimId: number;
      input: CreateExpenseFromClaimInput;
    }) => createExpenseFromClaim(claimId, input),
  );
}

export function useDeleteExpense() {
  return useOrgScopedMutation(["finance-expenses"], (id: number) =>
    deleteExpense(id),
  );
}
