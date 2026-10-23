// Wire types for the master-data/shifts module

export interface Shift {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  workingMinutes: number;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateShiftInput {
  code: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  workingMinutes: number;
}

/** `code` is immutable once created, so edits send only the remaining fields. */
export type UpdateShiftInput = Partial<Omit<CreateShiftInput, "code">>;

export interface QueryShiftsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
  isActive?: boolean;
  sortBy?: "name" | "code" | "createdAt";
}
