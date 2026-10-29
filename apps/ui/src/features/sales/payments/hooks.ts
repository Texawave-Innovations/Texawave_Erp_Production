"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createPayment,
  deletePayment,
  getNextPaymentNumber,
  getPaymentAlerts,
  listPayments,
  updatePayment,
  type PaymentListQuery,
} from "./api";
import type { CreatePaymentBody, PaymentBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function usePayments(query: PaymentListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "payments", "list", query),
    queryFn: () => listPayments(query),
    enabled: enabled && orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function usePaymentAlerts(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "payments", "alerts"),
    queryFn: getPaymentAlerts,
    enabled: enabled && orgId > 0,
  });
}

export function useNextPaymentNumber(date: string, enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "payments", "next", date),
    queryFn: () => getNextPaymentNumber(date),
    enabled: enabled && orgId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date),
  });
}

// Payments move invoice balances and dashboard figures: invalidate all Sales.
export function useCreatePayment() {
  return useOrgScopedMutation([SALES_KEY], (body: CreatePaymentBody) =>
    createPayment(body),
  );
}

export function useUpdatePayment() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: PaymentBody }) =>
      updatePayment(id, body),
  );
}

export function useDeletePayment() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deletePayment(id));
}
