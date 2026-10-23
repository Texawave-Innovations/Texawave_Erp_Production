// Feature 8 — Audit Trail. Fully isolated new Firebase path: `crm/auditLogs`. Never reads from
// or writes to any existing CRM source tab. Tracks only actions taken through this new
// intelligence layer, starting from this implementation forward (no invented history).
import {
  equalTo,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
} from "firebase/database";
import { database } from "@/services/firebase";
import { CrmAuditLogEntry } from "./types";

export const CRM_AUDIT_LOG_PATH = "crm/auditLogs";

export async function writeCrmAuditLog(
  entry: Omit<CrmAuditLogEntry, "id">,
): Promise<void> {
  const newRef = push(ref(database, CRM_AUDIT_LOG_PATH));
  await set(newRef, entry);
}

/** Removes a single audit-log entry outright — audit entries are a log line, not a CRM domain
 *  record, so unlike `softDeleteCrmRecord` this doesn't go through the Recycle Bin (there is
 *  nothing meaningful to "restore" for a log line). Used by the Lead Timeline's per-date delete,
 *  which is the only place audit-log entries are individually removable from today. */
export async function deleteCrmAuditLogEntry(id: string): Promise<void> {
  await remove(ref(database, `${CRM_AUDIT_LOG_PATH}/${id}`));
}

export function subscribeCrmAuditLogs(
  callback: (entries: CrmAuditLogEntry[]) => void,
): () => void {
  const logRef = ref(database, CRM_AUDIT_LOG_PATH);
  const unsubscribe = onValue(logRef, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Omit<CrmAuditLogEntry, "id">
    >;
    const entries = Object.entries(val).map(([id, e]) => ({ id, ...e }));
    entries.sort((a, b) => b.at - a.at);
    callback(entries);
  });
  return () => unsubscribe();
}

/** Same as `subscribeCrmAuditLogs`, but server-filtered to one company's entries via an indexed
 *  `orderByChild('companyKey')` query — used by Company 360 (CompanyDetail.tsx), which otherwise
 *  downloaded and re-filtered every company's entire audit history just to show one company's. */
export function subscribeCrmAuditLogsForCompany(
  companyKey: string,
  callback: (entries: CrmAuditLogEntry[]) => void,
): () => void {
  const logQuery = query(
    ref(database, CRM_AUDIT_LOG_PATH),
    orderByChild("companyKey"),
    equalTo(companyKey),
  );
  const unsubscribe = onValue(logQuery, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Omit<CrmAuditLogEntry, "id">
    >;
    const entries = Object.entries(val).map(([id, e]) => ({ id, ...e }));
    entries.sort((a, b) => b.at - a.at);
    callback(entries);
  });
  return () => unsubscribe();
}

/** Same idea as `subscribeCrmAuditLogsForCompany`, but keyed by `entityId` instead — used by pages
 *  whose audit entries are recorded against a single record id rather than a company (Lead Detail),
 *  which otherwise downloaded and re-filtered the entire audit history just to show one lead's.
 *  `entityId` values are Firebase push ids (effectively unique app-wide), so the `entityType` check
 *  from the original client-side filter is kept only as a defensive no-op, not a real narrowing. */
export function subscribeCrmAuditLogsForEntity(
  entityType: string,
  entityId: string,
  callback: (entries: CrmAuditLogEntry[]) => void,
): () => void {
  const logQuery = query(
    ref(database, CRM_AUDIT_LOG_PATH),
    orderByChild("entityId"),
    equalTo(entityId),
  );
  const unsubscribe = onValue(logQuery, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Omit<CrmAuditLogEntry, "id">
    >;
    const entries = Object.entries(val)
      .map(([id, e]) => ({ id, ...e }))
      .filter((e) => e.entityType === entityType);
    entries.sort((a, b) => b.at - a.at);
    callback(entries);
  });
  return () => unsubscribe();
}
