import type { PaginationMeta } from "@texawave-erp/api-types";

/** Mirrors apps/api/src/modules/hr/employees/employee-status.policy.ts. */
export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "RESIGNED",
  "TERMINATED",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export interface Ref {
  id: number;
  name: string;
}

/** Row shape of GET /hr/employees — deliberately no phone, e-mail or exit reason. */
export interface EmployeeListItem {
  id: number;
  employeeCode: string;
  fullName: string;
  status: EmployeeStatus;
  dateOfJoining: string;
  team: Ref;
  designation: Ref;
  employmentType: Ref;
  reportsToId: number | null;
  hasLogin: boolean;
  /**
   * Self-onboarding progress, written only by the employee-self-service
   * module (apps/api/.../employee-mappers.ts). Only ever "PENDING_ACTIVATION"
   * or "COMPLETE" — see OnboardingStatusBadge.
   */
  onboardingStatus: string;
}

/** Shape of GET /hr/employees/:id. `version` is sent back on every update. */
export interface EmployeeDetail extends EmployeeListItem {
  workEmail: string | null;
  phone: string | null;
  department: Ref | null;
  workLocation: Ref | null;
  reportsTo: { id: number; employeeCode: string; fullName: string } | null;
  userId: number | null;
  dateOfExit: string | null;
  exitReason: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Raw row of GET /hr/employees/:id/status-history (no response mapper). */
export interface EmployeeStatusHistoryRow {
  id: number | string;
  fromStatus: EmployeeStatus | null;
  toStatus: EmployeeStatus;
  changeType: "transition" | "correction";
  effectiveDate: string;
  reason: string | null;
  at: string;
  changer: { id: number; fullName: string } | null;
}

/** Rows of the master-data lists (designations, employment types, work locations, departments). */
export interface LookupItem {
  id: number;
  name: string;
  isActive?: boolean;
}

export type { PaginationMeta };
