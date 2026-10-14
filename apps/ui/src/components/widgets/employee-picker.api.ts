"use client";

import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

/** The slice of a `GET /hr/employees` row a picker needs. */
export interface EmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
}

/** Team-scoped: the server returns only employees inside the caller's scope. */
export const EMPLOYEE_READ_ANY_SCOPE = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
] as const;

const PAGE_SIZE = 20;

function searchEmployees(
  search: string,
): Promise<PaginatedEnvelope<EmployeeOption>> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeOption[]>("/hr/employees", {
      query: {
        page: 1,
        limit: PAGE_SIZE,
        sortBy: "fullName",
        ...(search ? { search } : {}),
      },
    }),
  ) as Promise<PaginatedEnvelope<EmployeeOption>>;
}

export function useEmployeeOptions(search: string, enabled: boolean) {
  const orgId = useAuthStore((s) => s.organizationId ?? 0);
  return useQuery({
    queryKey: orgScopedKey(orgId, "employee-picker", search),
    queryFn: () => searchEmployees(search),
    enabled: orgId > 0 && enabled,
  });
}
