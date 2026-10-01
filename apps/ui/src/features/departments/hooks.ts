"use client";

import type {
  CreateDepartmentInput,
  QueryDepartmentsInput,
  UpdateDepartmentInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
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
  return useOrgScopedMutation(["departments"], (input: CreateDepartmentInput) =>
    createDepartment(input),
  );
}

export function useUpdateDepartment() {
  return useOrgScopedMutation(
    ["departments"],
    ({ id, input }: { id: number; input: UpdateDepartmentInput }) =>
      updateDepartment(id, input),
  );
}

export function useDeleteDepartment() {
  return useOrgScopedMutation(["departments"], (id: number) =>
    deleteDepartment(id),
  );
}
