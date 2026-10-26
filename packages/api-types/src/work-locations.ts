// Wire types for the master-data/work-locations module

export interface WorkLocation {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateWorkLocationInput {
  code: string;
  name: string;
  description?: string;
}

/** `code` is immutable once created, so edits send only name and description. */
export type UpdateWorkLocationInput = Partial<
  Omit<CreateWorkLocationInput, "code">
>;

export interface QueryWorkLocationsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
  isActive?: boolean;
  sortBy?: "name" | "code" | "createdAt";
}
