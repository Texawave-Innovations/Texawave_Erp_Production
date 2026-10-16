"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getNextCustomerCode,
  listCustomers,
  updateCustomer,
  type CustomerListQuery,
} from "./api";
import type { CustomerBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useCustomers(query: CustomerListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "customers", "list", query),
    queryFn: () => listCustomers(query),
    enabled: orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "customers", "detail", id ?? 0),
    queryFn: () => getCustomer(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useNextCustomerCode(
  mobileCountryCode: string,
  enabled: boolean,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      SALES_KEY,
      "customers",
      "next-code",
      mobileCountryCode,
    ),
    queryFn: () => getNextCustomerCode(mobileCountryCode),
    enabled: enabled && orgId > 0,
  });
}

// Every Sales mutation invalidates the whole Sales cache: a customer change
// moves dashboard counts and document pickers too.
export function useCreateCustomer() {
  return useOrgScopedMutation([SALES_KEY], (body: CustomerBody) =>
    createCustomer(body),
  );
}

export function useUpdateCustomer() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: Partial<CustomerBody> }) =>
      updateCustomer(id, body),
  );
}

export function useDeleteCustomer() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteCustomer(id));
}
