import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface EmployeeListRow {
  id: number;
  employeeCode: string;
  fullName: string;
  dateOfJoining: string;
  team: { id: number; name: string };
  designation: { id: number; name: string };
  hasLogin: boolean;
  onboardingStatus: string;
}

export interface QueryEmployeesInput {
  page?: number;
  limit?: number;
  search?: string;
}

export function listEmployees(
  query: QueryEmployeesInput = {},
): Promise<PaginatedEnvelope<EmployeeListRow>> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeListRow[]>("/hr/employees", { query }),
  ) as Promise<PaginatedEnvelope<EmployeeListRow>>;
}
