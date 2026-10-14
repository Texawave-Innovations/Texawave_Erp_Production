export interface Designation {
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

export interface CreateDesignationInput {
  code: string;
  name: string;
  description?: string;
}

/** `code` is immutable once created, so edits send only name and description. */
export type UpdateDesignationInput = Partial<
  Omit<CreateDesignationInput, "code">
>;

export interface QueryDesignationsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
