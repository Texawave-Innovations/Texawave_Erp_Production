"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import {
  listEmployeeDocuments,
  removeEmployeeDocument,
  uploadEmployeeDocument,
} from "./api";

const KEY = "hr-employee-documents" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useEmployeeDocuments(employeeId: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", employeeId),
    queryFn: () => listEmployeeDocuments(employeeId),
    enabled: orgId > 0 && employeeId > 0,
  });
}

export function useUploadEmployeeDocument(employeeId: number) {
  return useOrgScopedMutation(
    [KEY],
    ({ label, file }: { label: string; file: File }) =>
      uploadEmployeeDocument(employeeId, label, file),
  );
}

export function useRemoveEmployeeDocument(employeeId: number) {
  return useOrgScopedMutation([KEY], (id: number) =>
    removeEmployeeDocument(employeeId, id),
  );
}
