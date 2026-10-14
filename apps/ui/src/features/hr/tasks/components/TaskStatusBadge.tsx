"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";
import {
  PRIORITY_COLOR,
  PRIORITY_LABELS,
  STATUS_COLOR,
  STATUS_LABELS,
} from "../status";
import type { TaskPriority, TaskStatus } from "../types";

/** Status always renders as text, never color alone (Docs/DESIGN_SYSTEM.md). */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      colorToken={STATUS_COLOR[status]}
    />
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <StatusBadge
      label={PRIORITY_LABELS[priority]}
      colorToken={PRIORITY_COLOR[priority]}
    />
  );
}
