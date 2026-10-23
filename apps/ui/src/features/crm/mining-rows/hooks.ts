"use client";

import type {
  CreateCrmMiningRowInput,
  QueryCrmMiningRowsInput,
  UpdateCrmMiningRowInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMiningRow,
  deleteMiningRow,
  listMiningRows,
  promoteMiningRowToLead,
  updateMiningRow,
} from "./api";

export function useMiningRows(query: QueryCrmMiningRowsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-mining-rows", query),
    queryFn: () => listMiningRows(query),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateMiningRows() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-mining-rows"),
    });
}

export function useCreateMiningRow() {
  const invalidate = useInvalidateMiningRows();
  return useMutation({
    mutationFn: (input: CreateCrmMiningRowInput) => createMiningRow(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMiningRow() {
  const invalidate = useInvalidateMiningRows();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateCrmMiningRowInput;
    }) => updateMiningRow(id, input),
    onSuccess: invalidate,
  });
}

/** Promoting also creates a Lead, so the Leads list is invalidated too. */
export function usePromoteMiningRow() {
  const invalidate = useInvalidateMiningRows();
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => promoteMiningRowToLead(id),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useDeleteMiningRow() {
  const invalidate = useInvalidateMiningRows();
  return useMutation({
    mutationFn: (id: number) => deleteMiningRow(id),
    onSuccess: invalidate,
  });
}
