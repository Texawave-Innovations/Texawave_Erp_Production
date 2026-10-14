import type { PaginationMeta } from "@texawave-erp/api-types";

/** Mirrors apps/api/src/modules/hr/employees/employee-status.policy.ts. */
export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "RESIGNED",
  "TERMINATED",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Mirrors apps/api/src/modules/hr/employees/onboarding-review.policy.ts. */
export const ONBOARDING_REVIEW_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
] as const;
export type OnboardingReviewStatus =
  (typeof ONBOARDING_REVIEW_STATUSES)[number];

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
  /** HR's review of the submitted profile — see OnboardingReviewBadge. */
  onboardingReviewStatus: OnboardingReviewStatus;
}

/** Shape of GET /hr/employees/:id. `version` is sent back on every update. */
export interface EmployeeDetail extends EmployeeListItem {
  workEmail: string | null;
  phone: string | null;
  department: Ref | null;
  workLocation: Ref | null;
  reportsTo: { id: number; employeeCode: string; fullName: string } | null;
  userId: number | null;
  probationEndDate: string | null;
  confirmationDate: string | null;
  referredBy: string | null;
  workDomain: string | null;
  onboardingSubmittedAt: string | null;
  onboardingReviewedAt: string | null;
  onboardingReviewedBy: number | null;
  /** On CHANGES_REQUESTED: what the employee must correct. */
  onboardingReviewNote: string | null;
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

/** GET /hr/employees/stats — counts within the caller's read scope. */
export interface EmployeeStats {
  total: number;
  byStatus: Partial<Record<EmployeeStatus, number>>;
  onboarding: {
    profileIncomplete: number;
    pendingReview: number;
    changesRequested: number;
  };
  withoutLogin: number;
  joinedThisMonth: number;
  byTeam: Array<{ teamId: number; teamName: string; count: number }>;
}

/** POST /hr/employees/import — all rows are created, or none. */
export interface EmployeeImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  created: Array<{ row: number; id: number; employeeCode: string }>;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    errorCode?: string;
  }>;
}
