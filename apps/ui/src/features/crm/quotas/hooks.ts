"use client";

import type {
  CreateCrmQuotaInput,
  CrmQuotaLiveSummaryInput,
  QueryCrmQuotasInput,
  UpdateCrmQuotaInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createQuota,
  deleteQuota,
  getQuotaLiveSummary,
  listQuotas,
  updateQuota,
} from "./api";

export function useQuotas(query: QueryCrmQuotasInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-quotas", query),
    queryFn: () => listQuotas(query),
    enabled: Boolean(organizationId),
  });
}

/** Live summary for the Set-Target form's read-only panel; `null` input =
 * not enough valid data yet (legacy shows a hint instead). */
export function useQuotaLiveSummary(input: CrmQuotaLiveSummaryInput | null) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "crm-quota-live-summary",
      input ?? {},
    ),
    queryFn: () => getQuotaLiveSummary(input as CrmQuotaLiveSummaryInput),
    enabled: Boolean(organizationId) && input !== null,
  });
}

function useInvalidateQuotas() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-quotas"),
    });
}

export function useCreateQuota() {
  const invalidate = useInvalidateQuotas();
  return useMutation({
    mutationFn: (input: CreateCrmQuotaInput) => createQuota(input),
    onSuccess: invalidate,
  });
}

export function useUpdateQuota() {
  const invalidate = useInvalidateQuotas();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCrmQuotaInput }) =>
      updateQuota(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteQuota() {
  const invalidate = useInvalidateQuotas();
  return useMutation({
    mutationFn: (id: number) => deleteQuota(id),
    onSuccess: invalidate,
  });
}
