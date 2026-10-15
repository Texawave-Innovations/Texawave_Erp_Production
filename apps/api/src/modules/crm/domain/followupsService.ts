// CRM Core Domain — Follow-ups. Isolated Firebase path: `crm/followups`.
import { ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import { CRM_FOLLOWUPS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmFollowUp, CrmFollowUpInput, CrmFollowUpStatus } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmFollowUps(
  callback: (followUps: CrmFollowUp[]) => void,
): () => void {
  return subscribeCollection<CrmFollowUp>(CRM_FOLLOWUPS_PATH, (items) => {
    items.sort((a, b) =>
      (a.scheduledAt || "").localeCompare(b.scheduledAt || ""),
    );
    callback(items);
  });
}

export async function createCrmFollowUp(
  input: CrmFollowUpInput,
  createdBy: string,
): Promise<string> {
  const id = await createInCollection<CrmFollowUp>(CRM_FOLLOWUPS_PATH, {
    ...input,
    status: input.status || "PENDING",
    createdBy,
    createdAt: Date.now(),
  } as Omit<CrmFollowUp, "id">);
  await writeCrmAuditLog({
    action: "followup_created",
    entityType: "followup",
    entityId: id,
    companyKey: input.relatedId,
    details: `${input.type} follow-up scheduled for ${input.scheduledAt}`,
    by: createdBy,
    at: Date.now(),
  });
  return id;
}

export async function updateCrmFollowUpStatus(
  id: string,
  status: CrmFollowUpStatus,
  by: string,
  outcome?: string,
  nextFollowUpAt?: string,
): Promise<void> {
  await updateInCollection(CRM_FOLLOWUPS_PATH, id, {
    status,
    ...(outcome !== undefined ? { outcome } : {}),
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
  });
  const action =
    status === "COMPLETED"
      ? "followup_completed"
      : status === "MISSED"
        ? "followup_missed"
        : status === "CANCELLED"
          ? "followup_cancelled"
          : "followup_created";
  await writeCrmAuditLog({
    action,
    entityType: "followup",
    entityId: id,
    newValue: status,
    details: `Follow-up marked ${status}${outcome ? ` — ${outcome}` : ""}`,
    by,
    at: Date.now(),
  });
}

/** Reschedules a follow-up to a new date, appending the previous date to `rescheduleHistory` so
 *  nothing about the original schedule is lost — an append-only trail of every reschedule. */
export async function rescheduleCrmFollowUp(
  id: string,
  previousScheduledAt: string,
  newScheduledAt: string,
  reason: string | undefined,
  by: string,
): Promise<void> {
  const historyEntry = {
    previousDate: previousScheduledAt,
    reason: reason || "",
    rescheduledBy: by,
    rescheduledAt: Date.now(),
  };
  await update(ref(database), {
    [`${CRM_FOLLOWUPS_PATH}/${id}/scheduledAt`]: newScheduledAt,
    [`${CRM_FOLLOWUPS_PATH}/${id}/status`]: "PENDING",
    [`${CRM_FOLLOWUPS_PATH}/${id}/rescheduleHistory/h${Date.now()}`]:
      historyEntry,
  });
  await writeCrmAuditLog({
    action: "followup_rescheduled",
    entityType: "followup",
    entityId: id,
    previousValue: previousScheduledAt,
    newValue: newScheduledAt,
    details: `Follow-up rescheduled from ${previousScheduledAt} to ${newScheduledAt}${reason ? ` — ${reason}` : ""}`,
    by,
    at: Date.now(),
  });
}

export async function updateCrmFollowUp(
  id: string,
  data: Partial<CrmFollowUp>,
): Promise<void> {
  await updateInCollection(CRM_FOLLOWUPS_PATH, id, data);
}

export async function deleteCrmFollowUp(
  id: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "followup",
    "Follow-up",
    CRM_FOLLOWUPS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "followup_deleted",
    entityType: "followup",
    entityId: id,
    details: "Follow-up moved to Recycle Bin",
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
