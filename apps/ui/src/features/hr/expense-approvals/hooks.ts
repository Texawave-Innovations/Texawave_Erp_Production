"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createMyExpenseClaim,
  decideExpenseClaim,
  type CreateExpenseClaimBody,
  type DecideExpenseClaimBody,
  type ExpenseClaimListQuery,
  listExpenseClaims,
  listMyExpenseClaims,
} from "./api";

const KEY = "hr-expense-claims" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** HR/approver view: own/team/all, scoped server-side. */
export function useExpenseClaims(query: ExpenseClaimListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listExpenseClaims(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useDecideExpenseClaim() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideExpenseClaimBody }) =>
      decideExpenseClaim(id, body),
  );
}

// ---- self-service -----------------------------------------------------------

export function useMyExpenseClaims(
  query: Omit<ExpenseClaimListQuery, "employeeId">,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyExpenseClaims(query),
    enabled: orgId > 0,
  });
}

export function useCreateMyExpenseClaim() {
  return useOrgScopedMutation([KEY], (body: CreateExpenseClaimBody) =>
    createMyExpenseClaim(body),
  );
}
