// CRM Core Domain — unified Activity system (Call/Email/WhatsApp/Meeting/Demo/Note/Task/
// Follow-up/Proposal/LinkedIn). Isolated Firebase path: `crm/activities`. Each activity links to
// exactly one Lead/Account/Contact/Opportunity via `relatedType`/`relatedId`.
import { CRM_ACTIVITIES_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmActivity, CrmActivityInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmActivities(
  callback: (activities: CrmActivity[]) => void,
): () => void {
  return subscribeCollection<CrmActivity>(CRM_ACTIVITIES_PATH, (items) => {
    items.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
    callback(items);
  });
}

export async function logCrmActivity(input: CrmActivityInput): Promise<string> {
  const id = await createInCollection<CrmActivity>(CRM_ACTIVITIES_PATH, {
    ...input,
    createdAt: Date.now(),
  } as Omit<CrmActivity, "id">);
  await writeCrmAuditLog({
    action: "activity_logged",
    entityType: "activity",
    entityId: id,
    companyKey: input.relatedId,
    details: `${input.type} activity logged — ${input.subject}`,
    by: input.createdBy,
    at: Date.now(),
  });
  return id;
}

/**
 * Records a `CrmActivity` for an event a domain service (opportunitiesService,
 * meetingsService, etc.) is already writing its own domain-specific audit-log entry for — so
 * the Timeline shows the event without a second, generic "activity logged" audit line
 * duplicating the one the caller already wrote.
 */
export async function logCrmActivitySilently(
  input: CrmActivityInput,
): Promise<string> {
  return createInCollection<CrmActivity>(CRM_ACTIVITIES_PATH, {
    ...input,
    createdAt: Date.now(),
  } as Omit<CrmActivity, "id">);
}

export async function updateCrmActivity(
  id: string,
  updates: Partial<CrmActivityInput>,
  user: User | null | undefined,
): Promise<void> {
  await updateInCollection(CRM_ACTIVITIES_PATH, id, {
    ...updates,
    updatedAt: Date.now(),
  });
  await writeCrmAuditLog({
    action: "activity_updated",
    entityType: "activity",
    entityId: id,
    details: `Activity updated — ${updates.subject || ""}`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

export async function deleteCrmActivity(
  id: string,
  subject: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "activity",
    subject,
    CRM_ACTIVITIES_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "record_deleted",
    entityType: "activity",
    entityId: id,
    details: `Activity "${subject}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
