import type { TaskPriority, TaskStatus } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

/** Color token per status, passed to the shared StatusBadge. */
export const STATUS_COLOR: Record<
  TaskStatus,
  "success" | "warning" | "error" | "brand" | "gray"
> = {
  PENDING: "warning",
  IN_PROGRESS: "brand",
  DONE: "success",
  CANCELLED: "error",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_COLOR: Record<
  TaskPriority,
  "success" | "warning" | "error" | "brand" | "gray"
> = {
  LOW: "gray",
  MEDIUM: "brand",
  HIGH: "warning",
  URGENT: "error",
};
