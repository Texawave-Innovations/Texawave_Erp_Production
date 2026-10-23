// CRM Core Domain — Accounts / Clients. Isolated Firebase path: `crm/accounts`.
import { CRM_ACCOUNTS_PATH, CRM_STAGE_HISTORY_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmAccount, CrmAccountInput, CrmStatusTag, CrmTask } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { logCrmActivitySilently } from "./activitiesService";
import { createCrmTask, updateCrmTask } from "./tasksService";
import {
  softDeleteCrmRecord,
  softDeleteCrmRecordWithRelated,
} from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmAccounts(
  callback: (accounts: CrmAccount[]) => void,
): () => void {
  return subscribeCollection<CrmAccount>(CRM_ACCOUNTS_PATH, (items) => {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(items);
  });
}

export async function createCrmAccount(
  input: CrmAccountInput,
): Promise<string> {
  const now = Date.now();
  const id = await createInCollection<CrmAccount>(CRM_ACCOUNTS_PATH, {
    ...input,
    createdAt: now,
  } as Omit<CrmAccount, "id">);
  await writeCrmAuditLog({
    action: "account_created",
    entityType: "account",
    entityId: id,
    companyKey: id,
    companyName: input.name,
    details: `Account "${input.name}" created`,
    by: input.createdBy,
    at: now,
  });
  return id;
}

/** Fields worth calling out individually in the audit log when they change — the rest are still
 *  saved but folded into one generic "details updated" entry to avoid flooding the log. */
const ACCOUNT_AUDIT_FIELDS: Array<keyof CrmAccount> = [
  "name",
  "ownerName",
  "accountType",
  "industry",
  "phone",
  "email",
];

export async function updateCrmAccount(
  id: string,
  data: Partial<CrmAccount>,
  updatedBy: string,
  previous?: Partial<CrmAccount>,
): Promise<void> {
  await updateInCollection(CRM_ACCOUNTS_PATH, id, {
    ...data,
    updatedBy,
    updatedAt: Date.now(),
  });
  const now = Date.now();
  const changedFields: string[] = [];
  if (previous) {
    for (const field of ACCOUNT_AUDIT_FIELDS) {
      const prevVal = previous[field];
      const newVal = data[field as keyof typeof data];
      if (newVal === undefined || prevVal === newVal) continue;
      changedFields.push(field);
      await writeCrmAuditLog({
        action: "account_field_changed",
        entityType: "account",
        entityId: id,
        previousValue:
          prevVal !== undefined && prevVal !== null ? String(prevVal) : "",
        newValue: newVal !== undefined && newVal !== null ? String(newVal) : "",
        details: `${field} changed from "${prevVal ?? "—"}" to "${newVal ?? "—"}"`,
        by: updatedBy,
        at: now,
      });
    }
  }
  if (changedFields.length === 0) {
    await writeCrmAuditLog({
      action: "account_updated",
      entityType: "account",
      entityId: id,
      details: "Account details updated",
      by: updatedBy,
      at: now,
    });
  }
}

/**
 * Changes an Account's unified status tag, enforcing the same "reason required" discipline the
 * Opportunity Lost/Hold flows already use, and — for the two tags that imply a promised future
 * touch point — auto-creating a trackable `CrmTask` so the follow-up isn't just a status label
 * that gets forgotten. Every change is audit-logged and recorded as a Timeline activity.
 */
export async function changeCrmAccountStatusTag(
  account: Pick<CrmAccount, "id" | "name">,
  tag: CrmStatusTag,
  options: { reason?: string; date?: string; infoType?: string },
  by: string,
  /** Open tasks already on this account — when a Call Back/Keep in Touch/Send Info follow-up
   *  task already exists and is still Open, its date is updated in place instead of creating a
   *  second task, so re-saving the same status (e.g. rescheduling) never duplicates the task. */
  openTasks: Pick<CrmTask, "id" | "title" | "status">[] = [],
): Promise<void> {
  if (tag === "Not Interested" && !options.reason?.trim())
    throw new Error(
      "A reason is required to mark this account Not Interested.",
    );
  if (tag === "Keep in Touch" && !options.date)
    throw new Error("A re-engage date is required for Keep in Touch.");
  if (tag === "Call Back" && !options.date)
    throw new Error("A call-back date and time are required.");
  if (tag === "Send Info" && !options.infoType?.trim())
    throw new Error("The type of information to send is required.");

  const now = Date.now();
  await updateInCollection(CRM_ACCOUNTS_PATH, account.id, {
    statusTag: tag,
    statusReason: tag === "Not Interested" ? options.reason : null,
    statusDate:
      tag === "Keep in Touch" || tag === "Call Back" ? options.date : null,
    statusInfoType: tag === "Send Info" ? options.infoType : null,
    statusUpdatedBy: by,
    statusUpdatedAt: now,
  });

  const detail =
    tag === "Not Interested"
      ? `${tag} — ${options.reason}`
      : tag === "Keep in Touch"
        ? `${tag} — re-engage ${options.date}`
        : tag === "Call Back"
          ? `${tag} — ${options.date}`
          : tag === "Send Info"
            ? `${tag} — ${options.infoType}`
            : tag;

  await writeCrmAuditLog({
    action: "account_status_tag_changed",
    entityType: "account",
    entityId: account.id,
    newValue: tag,
    details: `Status set to ${detail}`,
    by,
    at: now,
  });
  await logCrmActivitySilently({
    relatedType: "account",
    relatedId: account.id,
    type: "Note",
    subject: `Status: ${tag}`,
    notes: detail,
    occurredAt: now,
    createdBy: by,
  });

  if ((tag === "Keep in Touch" || tag === "Call Back") && options.date) {
    const title =
      tag === "Call Back"
        ? `Call back — ${account.name}`
        : `Keep in touch — ${account.name}`;
    const existing = openTasks.find(
      (t) => t.status === "Open" && t.title === title,
    );
    if (existing) {
      await updateCrmTask(existing.id, {
        dueDate: options.date,
        priority: tag === "Call Back" ? "High" : "Medium",
      });
    } else {
      await createCrmTask(
        {
          relatedType: "account",
          relatedId: account.id,
          title,
          dueDate: options.date,
          assignedTo: by,
          priority: tag === "Call Back" ? "High" : "Medium",
        },
        by,
      );
    }
  } else if (tag === "Send Info" && options.infoType) {
    const title = `Send info (${options.infoType}) — ${account.name}`;
    const existing = openTasks.find(
      (t) => t.status === "Open" && t.title === title,
    );
    if (!existing) {
      await createCrmTask(
        {
          relatedType: "account",
          relatedId: account.id,
          title,
          dueDate: new Date().toISOString().slice(0, 10),
          assignedTo: by,
          priority: "Medium",
        },
        by,
      );
    }
  }
}

/**
 * Best-effort duplicate check by normalized name (and domain/email when available) before
 * creating a new Account — used by AccountFormDialog, LeadConvertDialog and LogToAccountButton
 * so all three "create account" entry points warn the same way instead of each re-implementing
 * their own name match.
 */
export function findPossibleDuplicateAccount(
  accounts: CrmAccount[],
  candidate: { name?: string; website?: string; email?: string },
): CrmAccount | undefined {
  const norm = (s?: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const domainOf = (s?: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  const name = norm(candidate.name);
  const domain = domainOf(candidate.website);
  const email = (candidate.email || "").trim().toLowerCase();
  const emailDomain = email.includes("@") ? email.split("@")[1] : "";

  if (!name && !domain && !emailDomain) return undefined;

  return accounts.find((a) => {
    if (name && norm(a.name) === name) return true;
    if (domain && domainOf(a.website) === domain) return true;
    if (
      emailDomain &&
      (a.email || "").split("@")[1]?.toLowerCase() === emailDomain
    )
      return true;
    return false;
  });
}

/** Moves an Account (with no related records) into the CRM Recycle Bin — Admin-only; restorable,
 *  or permanently removable from there. Never deletes directly. */
export async function deleteCrmAccount(
  id: string,
  name: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "account",
    name,
    CRM_ACCOUNTS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "account_deleted",
    entityType: "account",
    entityId: id,
    companyName: name,
    details: `Account "${name}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

/**
 * Cascade soft-deletes an Account and every record that belongs to it into the Recycle Bin, so
 * nothing is silently orphaned — Restoring the Account from the Recycle Bin brings all of them
 * back too. The caller (Accounts.tsx / AccountDetail.tsx) already has every related id live via
 * `useCrmDomainData`, so this just takes the ids to remove rather than re-querying Firebase.
 */
export async function deleteCrmAccountCascade(
  account: { id: string; name: string },
  related: {
    contactIds: string[];
    opportunityIds: string[];
    meetingIds: string[];
    followUpIds: string[];
    activityIds: string[];
    quotationIds: string[];
    documentIds: string[];
    taskIds?: string[];
    dealProductIds?: string[];
  },
  user: User | null | undefined,
): Promise<void> {
  const relatedPaths: Record<string, string> = {};
  related.contactIds.forEach((cid) => {
    relatedPaths[`contact_${cid}`] = `crm/contacts/${cid}`;
  });
  related.opportunityIds.forEach((oid) => {
    relatedPaths[`opportunity_${oid}`] = `crm/opportunities/${oid}`;
    relatedPaths[`stageHistory_${oid}`] = `${CRM_STAGE_HISTORY_PATH}/${oid}`;
  });
  related.meetingIds.forEach((mid) => {
    relatedPaths[`meeting_${mid}`] = `crm/meetings/${mid}`;
  });
  related.followUpIds.forEach((fid) => {
    relatedPaths[`followup_${fid}`] = `crm/followups/${fid}`;
  });
  related.activityIds.forEach((aid) => {
    relatedPaths[`activity_${aid}`] = `crm/activities/${aid}`;
  });
  related.quotationIds.forEach((qid) => {
    relatedPaths[`quotation_${qid}`] = `crm/quotations/${qid}`;
  });
  related.documentIds.forEach((did) => {
    relatedPaths[`document_${did}`] = `crm/documents/${did}`;
  });
  (related.taskIds || []).forEach((tid) => {
    relatedPaths[`task_${tid}`] = `crm/tasks/${tid}`;
  });
  (related.dealProductIds || []).forEach((pid) => {
    relatedPaths[`dealProduct_${pid}`] = `crm/dealProducts/${pid}`;
  });

  const deleted = await softDeleteCrmRecordWithRelated(
    "account",
    account.name,
    CRM_ACCOUNTS_PATH,
    account.id,
    user,
    relatedPaths,
  );
  if (!deleted) return;
  const totalRelated = Object.keys(relatedPaths).length;
  await writeCrmAuditLog({
    action: "account_deleted",
    entityType: "account",
    entityId: account.id,
    companyName: account.name,
    details: `Account "${account.name}" moved to Recycle Bin along with ${totalRelated} related record${totalRelated === 1 ? "" : "s"}`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
