"use client";

import type {
  CreateFinancePaymentMadeInput,
  QueryFinancePaymentsMadeInput,
  UpdateFinancePaymentMadeInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  confirmPaymentMade,
  createPaymentMade,
  deletePaymentMade,
  getPaymentMade,
  listActiveBankAccounts,
  listPaymentsMade,
  updatePaymentMade,
  voidPaymentMade,
} from "./api";

function paymentsMadeKey(
  organizationId: number,
  query: QueryFinancePaymentsMadeInput = {},
) {
  return orgScopedKey(organizationId, "finance-payments-made", query);
}

export function usePaymentsMade(query: QueryFinancePaymentsMadeInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: paymentsMadeKey(organizationId ?? 0, query),
    queryFn: () => listPaymentsMade(query),
    enabled: Boolean(organizationId),
  });
}

export function usePaymentMade(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-payments-made",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getPaymentMade(id as number),
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

export function useCreatePaymentMade() {
  return useOrgScopedMutation(
    [
      "finance-payments-made",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    (input: CreateFinancePaymentMadeInput) => createPaymentMade(input),
  );
}

export function useUpdatePaymentMade() {
  return useOrgScopedMutation(
    ["finance-payments-made"],
    ({ id, input }: { id: number; input: UpdateFinancePaymentMadeInput }) =>
      updatePaymentMade(id, input),
  );
}

export function useConfirmPaymentMade() {
  return useOrgScopedMutation(
    [
      "finance-payments-made",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    (id: number) => confirmPaymentMade(id),
  );
}

export function useVoidPaymentMade() {
  return useOrgScopedMutation(
    [
      "finance-payments-made",
      "finance-journal-entries",
      "finance-accounts",
      "finance-bank-accounts",
    ],
    (id: number) => voidPaymentMade(id),
  );
}

export function useDeletePaymentMade() {
  return useOrgScopedMutation(["finance-payments-made"], (id: number) =>
    deletePaymentMade(id),
  );
}
