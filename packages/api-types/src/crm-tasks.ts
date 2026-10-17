// HANDWRITTEN — mirrors apps/api/src/modules/crm/tasks/dto/task.dto.ts and
// apps/api/src/modules/crm/tasks/tasks.controller.ts. See
// packages/api-types/README.md.

import type { RelatedType } from "./crm-related-entity.js";

export const CRM_TASK_PRIORITIES = ["High", "Medium", "Low"] as const;
export type CrmTaskPriority = (typeof CRM_TASK_PRIORITIES)[number];

/** Mirrors legacy `CrmTask.status` exactly — only two states, unlike HR's
 * `Task`. */
export const CRM_TASK_STATUSES = ["Open", "Completed"] as const;
export type CrmTaskStatus = (typeof CRM_TASK_STATUSES)[number];

export interface CrmTask {
  /** Resolved server-side from users.full_name (list responses). */
  createdByName?: string | null | undefined;
  updatedByName?: string | null | undefined;
  id: number;
  organizationId: number;
  relatedType: RelatedType;
  relatedId: number;
  title: string;
  dueDate: string;
  assignedTo: string;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCrmTaskInput {
  relatedType: RelatedType;
  relatedId: number;
  title: string;
  dueDate: string;
  assignedTo: string;
  priority?: CrmTaskPriority | undefined;
  notes?: string | undefined;
}

export type UpdateCrmTaskInput = Partial<
  Omit<CreateCrmTaskInput, "relatedType" | "relatedId">
>;

export interface UpdateCrmTaskStatusInput {
  status: CrmTaskStatus;
}

export interface QueryCrmTasksInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  relatedType?: RelatedType | undefined;
  relatedId?: number | undefined;
  /** Account roll-up: the account's own records plus those of its contacts and opportunities. */
  rollupAccountId?: number | undefined;
  status?: CrmTaskStatus | undefined;
}
