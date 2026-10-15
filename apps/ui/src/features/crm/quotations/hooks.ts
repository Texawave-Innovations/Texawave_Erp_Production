"use client";

import type {
  QueryQuotationsInput,
  QuotationPayloadInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createQuotation,
  deleteQuotation,
  getQuotation,
  listQuotations,
  replaceQuotation,
} from "./api";

function quotationsKey(organizationId: number, query?: QueryQuotationsInput) {
  return query === undefined
    ? orgScopedKey(organizationId, "crm-quotations")
    : orgScopedKey(organizationId, "crm-quotations", query);
}

export function useQuotations(query: QueryQuotationsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: quotationsKey(organizationId ?? 0, query),
    queryFn: () => listQuotations(query),
    enabled: Boolean(organizationId),
  });
}

export function useQuotation(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-quotation")
        : orgScopedKey(organizationId ?? 0, "crm-quotation", id),
    queryFn: () => getQuotation(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateQuotations() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () => {
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-quotations"),
    });
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-quotation"),
    });
  };
}

export function useCreateQuotation() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: (input: QuotationPayloadInput) => createQuotation(input),
    onSuccess: invalidate,
  });
}

export function useReplaceQuotation() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: QuotationPayloadInput }) =>
      replaceQuotation(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteQuotation() {
  const invalidate = useInvalidateQuotations();
  return useMutation({
    mutationFn: (id: number) => deleteQuotation(id),
    onSuccess: invalidate,
  });
}
