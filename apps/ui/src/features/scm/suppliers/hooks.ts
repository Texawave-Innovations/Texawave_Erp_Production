"use client";

import type {
  CreateSupplierInput,
  QuerySuppliersInput,
  SupplierProcurementSummary,
  UpdateSupplierInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { scmDelete, scmGet } from "../shared/scm-api";
import {
  createSupplier,
  getNextSupplierCode,
  getSupplier,
  listSupplierActivity,
  listSupplierTypes,
  listSuppliers,
  updateSupplier,
} from "./api";

const KEY = "scm-suppliers";

export function useSuppliers(query: QuerySuppliersInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "list", query),
    queryFn: () => listSuppliers(query),
    enabled: Boolean(organizationId),
  });
}

export function useSupplier(id: number) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "detail", id),
    queryFn: () => getSupplier(id),
    enabled: Boolean(organizationId),
  });
}

export function useSupplierTypes() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "types"),
    queryFn: listSupplierTypes,
    enabled: Boolean(organizationId),
  });
}

/** Fetched fresh each time the create form opens (`enabled` is driven by the
 * dialog) so the suggested VEND-NNNN is never stale. */
export function useNextSupplierCode(enabled: boolean) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "next-code"),
    queryFn: getNextSupplierCode,
    enabled: Boolean(organizationId) && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSupplierActivity(id: number, enabled: boolean) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "activity", id),
    queryFn: () => listSupplierActivity(id),
    enabled: Boolean(organizationId) && enabled,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateSupplierInput) => createSupplier(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, KEY),
      });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSupplierInput }) =>
      updateSupplier(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, KEY),
      });
    },
  });
}

export function useSupplierProcurement(id: number) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, KEY, "procurement", id),
    queryFn: () =>
      scmGet<SupplierProcurementSummary>(`/scm/suppliers/${id}/procurement`),
    enabled: Boolean(organizationId),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => scmDelete(`/scm/suppliers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, KEY),
      });
    },
  });
}
