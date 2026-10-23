// HANDWRITTEN — mirrors apps/api/src/modules/projects-master/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

/** Tab 1: Project Master — project type/category registry (e.g. ME, SW, EC)
 * used to seed project-code generation. Not a full project record —
 * department/manager/status/dates are a separate, not-yet-built module. */
export interface Project {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  description: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string | undefined;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface QueryProjectsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
  search?: string | undefined;
}

/** Tab 2: Project Code Master — the project-code format generator
 * (`[Prefix]/[Category]/[Project Code]/[Year]/[Sequence]`). One row per
 * org; `id`/`organizationId` are absent on the unsaved-default response. */
export interface ProjectCodeMaster {
  id?: number;
  organizationId?: number;
  companyPrefix: string;
  moduleIdentifier: string;
  defaultProjectCode: string;
  financialYear: string;
  sequenceDigits: number;
  updatedBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProjectCodeMasterInput {
  companyPrefix?: string | undefined;
  moduleIdentifier?: string | undefined;
  defaultProjectCode?: string | undefined;
  financialYear?: string | undefined;
  sequenceDigits?: number | undefined;
}

/** Tab 3: Task Running Number Master — the task running-number format
 * generator (`[Project Code][Separator][Task Tag][Sequence]`). One row per
 * org; `id`/`organizationId` are absent on the unsaved-default response. */
export interface TaskRunningNumberMaster {
  id?: number;
  organizationId?: number;
  taskPrefix: string;
  separator: string;
  sequenceDigits: number;
  updatedBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateTaskRunningNumberMasterInput {
  taskPrefix?: string | undefined;
  separator?: string | undefined;
  sequenceDigits?: number | undefined;
}
