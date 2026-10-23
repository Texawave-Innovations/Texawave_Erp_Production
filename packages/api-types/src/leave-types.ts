// Wire types for the hr/leave-types module

export interface LeaveType {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  description: string | null;
  isPaid: boolean;
  annualEntitlement: number;
  carryForwardLimit: number;
  approvalLevels: 1 | 2;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateLeaveTypeInput {
  code: string;
  name: string;
  description?: string;
  isPaid?: boolean;
  annualEntitlement?: number;
  carryForwardLimit?: number;
  approvalLevels?: 1 | 2;
}

/** `code` is immutable once created, so edits send only the remaining fields. */
export type UpdateLeaveTypeInput = Partial<Omit<CreateLeaveTypeInput, "code">>;

export interface QueryLeaveTypesInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
  isActive?: boolean;
  sortBy?: "name" | "code" | "createdAt";
}
