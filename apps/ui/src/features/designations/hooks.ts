"use client";

import type {
  CreateDesignationInput,
  QueryDesignationsInput,
  UpdateDesignationInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createDesignation,
  listDesignations,
  setDesignationActive,
  updateDesignation,
} from "./api";

function designationsKey(
  organizationId: number,
  query: QueryDesignationsInput = {},
) {
  return orgScopedKey(organizationId, "designations", query);
}

export function useDesignations(query: QueryDesignationsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: designationsKey(organizationId ?? 0, query),
    queryFn: () => listDesignations(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateDesignation() {
  return useOrgScopedMutation(
    ["designations"],
    (input: CreateDesignationInput) => createDesignation(input),
  );
}

export function useUpdateDesignation() {
  return useOrgScopedMutation(
    ["designations"],
    ({ id, input }: { id: number; input: UpdateDesignationInput }) =>
      updateDesignation(id, input),
  );
}

export function useSetDesignationActive() {
  return useOrgScopedMutation(
    ["designations"],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setDesignationActive(id, isActive),
  );
}
