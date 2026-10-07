/** Mirrors apps/api/src/modules/hr/tasks/tasks.rules.ts. */
export const TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Ref {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/tasks and GET /hr/tasks/:id
 * (apps/api/src/modules/hr/tasks/tasks.repository.ts `TaskView`). */
export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  awaitingApproval: boolean;
  assignee: Ref;
  assignedBy: Ref;
  isEmployeeCreated: boolean;
  requestToAdmin: boolean;
  adminApproved: boolean;
  approvedBy: Ref | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
