// CRM Core Domain — Meetings. Isolated Firebase path: `crm/meetings`.
import { ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import { CRM_MEETINGS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmMeeting, CrmMeetingInput, CrmMeetingStatus } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { logCrmActivitySilently } from "./activitiesService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmMeetings(
  callback: (meetings: CrmMeeting[]) => void,
): () => void {
  return subscribeCollection<CrmMeeting>(CRM_MEETINGS_PATH, (items) => {
    items.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    callback(items);
  });
}

export async function createCrmMeeting(
  input: CrmMeetingInput,
  createdBy: string,
): Promise<string> {
  const id = await createInCollection<CrmMeeting>(CRM_MEETINGS_PATH, {
    ...input,
    status: input.status || "REQUESTED",
    createdBy,
    createdAt: Date.now(),
  } as Omit<CrmMeeting, "id">);
  await writeCrmAuditLog({
    action: "meeting_scheduled",
    entityType: "meeting",
    entityId: id,
    companyKey: input.relatedId,
    details: `${input.mode} meeting scheduled for ${input.date}`,
    by: createdBy,
    at: Date.now(),
  });
  return id;
}

export async function updateCrmMeetingStatus(
  id: string,
  status: CrmMeetingStatus,
  by: string,
): Promise<void> {
  const now = Date.now();
  const extra =
    status === "COMPLETED"
      ? { completedAt: now }
      : status === "CANCELLED"
        ? { cancelledAt: now }
        : {};
  await updateInCollection(CRM_MEETINGS_PATH, id, { status, ...extra });
  const action =
    status === "CANCELLED"
      ? "meeting_cancelled"
      : status === "COMPLETED"
        ? "meeting_completed"
        : "meeting_updated";
  await writeCrmAuditLog({
    action,
    entityType: "meeting",
    entityId: id,
    newValue: status,
    details: `Meeting marked ${status.replace("_", " ")}`,
    by,
    at: now,
  });
}

/** Records the post-meeting outcome fields (summary, requirements, concerns, etc.) after completion. */
export async function completeCrmMeeting(
  meeting: Pick<CrmMeeting, "id" | "relatedType" | "relatedId">,
  outcome: Partial<CrmMeeting>,
  by: string,
): Promise<void> {
  const now = Date.now();
  await updateInCollection(CRM_MEETINGS_PATH, meeting.id, {
    ...outcome,
    status: "COMPLETED",
    completedAt: now,
  });
  await writeCrmAuditLog({
    action: "meeting_completed",
    entityType: "meeting",
    entityId: meeting.id,
    details: `Meeting completed — ${outcome.summary || "outcome recorded"}`,
    by,
    at: now,
  });
  await logCrmActivitySilently({
    relatedType: meeting.relatedType,
    relatedId: meeting.relatedId,
    type: "Meeting",
    subject: "Meeting Completed",
    notes: outcome.summary || outcome.nextStep,
    occurredAt: now,
    createdBy: by,
  });
}

/** Reschedules a meeting to a new date, appending the previous date to `rescheduleHistory`. */
export async function rescheduleCrmMeeting(
  id: string,
  previousDate: string,
  newDate: string,
  reason: string | undefined,
  by: string,
): Promise<void> {
  const historyEntry = {
    previousDate,
    reason: reason || "",
    rescheduledBy: by,
    rescheduledAt: Date.now(),
  };
  await update(ref(database), {
    [`${CRM_MEETINGS_PATH}/${id}/date`]: newDate,
    [`${CRM_MEETINGS_PATH}/${id}/status`]: "RESCHEDULED",
    [`${CRM_MEETINGS_PATH}/${id}/rescheduleHistory/h${Date.now()}`]:
      historyEntry,
  });
  await writeCrmAuditLog({
    action: "meeting_rescheduled",
    entityType: "meeting",
    entityId: id,
    previousValue: previousDate,
    newValue: newDate,
    details: `Meeting rescheduled from ${previousDate} to ${newDate}${reason ? ` — ${reason}` : ""}`,
    by,
    at: Date.now(),
  });
}

export async function updateCrmMeeting(
  id: string,
  data: Partial<CrmMeeting>,
): Promise<void> {
  await updateInCollection(CRM_MEETINGS_PATH, id, data);
}

export async function deleteCrmMeeting(
  id: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "meeting",
    "Meeting",
    CRM_MEETINGS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "meeting_deleted",
    entityType: "meeting",
    entityId: id,
    details: "Meeting moved to Recycle Bin",
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
