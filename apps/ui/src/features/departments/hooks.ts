"use client";

import type {
  CreateDepartmentInput,
  QueryDepartmentsInput,
  UpdateDepartmentInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "./api";

function departmentsKey(
  organizationId: number,
  query: QueryDepartmentsInput = {},
) {
  return orgScopedKey(organizationId, "departments", query);
}

export function useDepartments(query: QueryDepartmentsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: departmentsKey(organizationId ?? 0, query),
    queryFn: () => listDepartments(query),
    enabled: Boolean(organizationId),
  });
}

export function useDepartment(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "departments",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getDepartment(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "departments"),
      });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateDepartmentInput }) =>
      updateDepartment(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "departments"),
      });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "departments"),
      });
    },
  });
}
