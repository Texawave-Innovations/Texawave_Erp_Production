// CRM Core Domain — Tasks. Isolated Firebase path: `crm/tasks`.
import { CRM_TASKS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmTask, CrmTaskInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmTasks(
  callback: (tasks: CrmTask[]) => void,
): () => void {
  return subscribeCollection<CrmTask>(CRM_TASKS_PATH, (items) => {
    items.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    callback(items);
  });
}

export async function createCrmTask(
  input: CrmTaskInput,
  createdBy: string,
): Promise<string> {
  const id = await createInCollection<CrmTask>(CRM_TASKS_PATH, {
    ...input,
    status: input.status || "Open",
    createdBy,
    createdAt: Date.now(),
  } as Omit<CrmTask, "id">);
  await writeCrmAuditLog({
    action: "task_created",
    entityType: "task",
    entityId: id,
    companyKey: input.relatedId,
    details: `Task "${input.title}" created`,
    by: createdBy,
    at: Date.now(),
  });
  return id;
}

export async function setCrmTaskStatus(
  id: string,
  status: CrmTask["status"],
  by: string,
  title?: string,
): Promise<void> {
  await updateInCollection(CRM_TASKS_PATH, id, { status });
  if (status === "Completed") {
    await writeCrmAuditLog({
      action: "task_completed",
      entityType: "task",
      entityId: id,
      details: `Task${title ? ` "${title}"` : ""} completed`,
      by,
      at: Date.now(),
    });
  }
}

export async function updateCrmTask(
  id: string,
  data: Partial<CrmTask>,
): Promise<void> {
  await updateInCollection(CRM_TASKS_PATH, id, data);
}

export async function deleteCrmTask(
  id: string,
  title: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "task",
    title,
    CRM_TASKS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "task_deleted",
    entityType: "task",
    entityId: id,
    details: `Task "${title}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
