"use client";

import type {
  CreateFinancePaymentReceivedInput,
  CreatePaymentAllocationInput,
  QueryFinancePaymentsReceivedInput,
  UpdateFinancePaymentReceivedInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  addPaymentAllocation,
  confirmPaymentReceived,
  createPaymentReceived,
  deletePaymentReceived,
  getPaymentReceived,
  listActiveBankAccounts,
  listPaymentsReceived,
  removePaymentAllocation,
  updatePaymentReceived,
  voidPaymentReceived,
} from "./api";

function paymentsReceivedKey(
  organizationId: number,
  query: QueryFinancePaymentsReceivedInput = {},
) {
  return orgScopedKey(organizationId, "finance-payments-received", query);
}

export function usePaymentsReceived(
  query: QueryFinancePaymentsReceivedInput = {},
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: paymentsReceivedKey(organizationId ?? 0, query),
    queryFn: () => listPaymentsReceived(query),
    enabled: Boolean(organizationId),
  });
}

export function usePaymentReceived(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-payments-received",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getPaymentReceived(id as number),
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

export function useCreatePaymentReceived() {
  return useOrgScopedMutation(
    [
      "finance-payments-received",
      "finance-journal-entries",
      "finance-accounts",
    ],
    (input: CreateFinancePaymentReceivedInput) => createPaymentReceived(input),
  );
}

export function useUpdatePaymentReceived() {
  return useOrgScopedMutation(
    ["finance-payments-received"],
    ({ id, input }: { id: number; input: UpdateFinancePaymentReceivedInput }) =>
      updatePaymentReceived(id, input),
  );
}

export function useConfirmPaymentReceived() {
  return useOrgScopedMutation(
    [
      "finance-payments-received",
      "finance-journal-entries",
      "finance-accounts",
    ],
    (id: number) => confirmPaymentReceived(id),
  );
}

export function useVoidPaymentReceived() {
  return useOrgScopedMutation(
    [
      "finance-payments-received",
      "finance-journal-entries",
      "finance-accounts",
    ],
    (id: number) => voidPaymentReceived(id),
  );
}

export function useAddPaymentAllocation() {
  return useOrgScopedMutation(
    ["finance-payments-received"],
    ({ id, input }: { id: number; input: CreatePaymentAllocationInput }) =>
      addPaymentAllocation(id, input),
  );
}

export function useRemovePaymentAllocation() {
  return useOrgScopedMutation(
    ["finance-payments-received"],
    ({ id, allocationId }: { id: number; allocationId: number }) =>
      removePaymentAllocation(id, allocationId),
  );
}

export function useDeletePaymentReceived() {
  return useOrgScopedMutation(["finance-payments-received"], (id: number) =>
    deletePaymentReceived(id),
  );
}
