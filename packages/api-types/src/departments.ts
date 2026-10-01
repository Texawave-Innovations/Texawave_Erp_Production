// Wire types for Departments module

export interface Department {
  id: number;
  organizationId: number;
  name: string;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDepartmentInput {
  name: string;
  isActive?: boolean;
  customFields?: Record<string, unknown>;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export interface QueryDepartmentsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
