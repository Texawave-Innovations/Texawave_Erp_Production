"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import { listEmployees, type QueryEmployeesInput } from "./api";

export function useEmployees(query: QueryEmployeesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "employees", query),
    queryFn: () => listEmployees(query),
    enabled: Boolean(organizationId),
  });
}
