// CRM Core Domain — Recycle Bin. Isolated Firebase path: `crm/recycleBin`, keyed by the deleted
// record's own id (Firebase push ids are unique across the whole database, so no collision risk
// between entity types sharing this one bin).
//
// Every CRM Delete action (Accounts, Leads, Account Mining, Pipeline/Opportunities, Contacts,
// Products, Quotes, and every related sub-record — Meetings, Follow-ups, Activities, Tasks,
// Documents, Notes, Deal Products, Pipeline Stages, Quotas) is Admin-only and routes through
// `softDeleteCrmRecord`/`softDeleteCrmRecordWithRelated` below instead of ever calling
// `removeFromCollection` directly — nothing in normal CRM pages is ever hard-deleted. A record
// only leaves the database for good via `permanentlyDeleteCrmRecycleBinEntry`, itself gated the
// same way. Restoring writes the record (and, for cascade deletes, every related record) back to
// its exact original path, so relationships are preserved exactly as they were.
import {
  get,
  onValue,
  ref,
  remove,
  update,
  type DatabaseReference,
} from "firebase/database";
import { database } from "@/services/firebase";
import { User } from "@/types";
import { isCrmAdmin } from "./roles";
import { writeCrmAuditLog } from "../intelligence/auditService";

export const CRM_RECYCLE_BIN_PATH = "crm/recycleBin";

export interface CrmRecycleBinEntry {
  id: string;
  entityType: string;
  /** Human-readable label shown in the Recycle Bin list, e.g. an account/lead/product name. */
  label: string;
  /** Original collection path the record lived under, e.g. `crm/accounts`. */
  path: string;
  recordId: string;
  data: unknown;
  /** For cascade deletes (Account, Opportunity) — every related record's full path + its data, so
   *  Restore can put every one of them back exactly where they were. An array, not a path-keyed
   *  object — Firebase forbids "/" (and ".", "#", "$", "[", "]") in an object key at any depth of
   *  an `update()` payload, and a related record's path (e.g. `crm/opportunities/abc123`) always
   *  contains "/". */
  related?: { path: string; data: unknown }[];
  deletedAt: number;
  deletedBy: string;
}

/** Throws unless the given user is a CRM Admin. Called at the start of every delete-producing
 *  service function so the delete is rejected server-side (in application code) even if a
 *  non-admin somehow reaches the function directly — the UI hiding the Delete button is not the
 *  only line of defense. */
export function assertCrmAdmin(user: User | null | undefined): void {
  if (!isCrmAdmin(user)) {
    throw new Error("Only a CRM Admin can delete records.");
  }
}

function deletedByName(user: User | null | undefined): string {
  return user?.name || user?.username || "Unknown";
}

/**
 * Moves a single record into the Recycle Bin and removes it from its live collection, in one
 * atomic multi-path update. Refuses (throws) if `user` is not a CRM Admin.
 */
/** Returns `true` if the record actually existed and was moved to the Recycle Bin, `false` if it
 *  was already gone (a no-op) — callers must only write their "moved to Recycle Bin" audit-log
 *  entry when this returns `true`, so two admins racing to delete the same record (or a stale UI
 *  still showing a Delete button) don't produce a false audit trail claiming a delete that never
 *  actually happened. */
export async function softDeleteCrmRecord(
  entityType: string,
  label: string,
  path: string,
  recordId: string,
  user: User | null | undefined,
): Promise<boolean> {
  return softDeleteCrmRecordWithRelated(
    entityType,
    label,
    path,
    recordId,
    user,
    {},
  );
}

/**
 * Same as `softDeleteCrmRecord`, but for cascade deletes (Account, Opportunity) that also remove
 * a set of related records. `relatedPaths` maps an arbitrary key to each related record's full
 * path (e.g. `crm/contacts/abc123`) — every one of them is snapshotted into the same Recycle Bin
 * entry and nulled out in the same atomic update, so Restore can put all of them back together.
 * Returns `true` if the record existed and was moved, `false` if it was already gone.
 */
export async function softDeleteCrmRecordWithRelated(
  entityType: string,
  label: string,
  path: string,
  recordId: string,
  user: User | null | undefined,
  relatedPaths: Record<string, string>,
): Promise<boolean> {
  assertCrmAdmin(user);

  const recordSnap = await get(ref(database, `${path}/${recordId}`));
  if (!recordSnap.exists()) return false; // already gone

  const relatedEntries = Object.values(relatedPaths);
  const relatedSnaps = await Promise.all(
    relatedEntries.map((p) => get(ref(database, p))),
  );
  const related: { path: string; data: unknown }[] = [];
  relatedEntries.forEach((p, i) => {
    if (relatedSnaps[i].exists())
      related.push({ path: p, data: relatedSnaps[i].val() });
  });

  // Firebase's `update()` rejects `undefined` anywhere in the payload, even nested inside an
  // object several levels deep — so `related` must be omitted entirely (not set to `undefined`)
  // when there's nothing to carry, rather than always including the key.
  const entry: Omit<CrmRecycleBinEntry, "id"> = {
    entityType,
    label,
    path,
    recordId,
    data: recordSnap.val(),
    ...(related.length ? { related } : {}),
    deletedAt: Date.now(),
    deletedBy: deletedByName(user),
  };

  const updates: Record<string, unknown> = {
    [`${CRM_RECYCLE_BIN_PATH}/${recordId}`]: entry,
    [`${path}/${recordId}`]: null,
  };
  relatedEntries.forEach((p) => {
    updates[p] = null;
  });

  await update(ref(database), updates);
  return true;
}

/** Restores a Recycle Bin entry back to its original location (and every related record, for a
 *  cascade delete), preserving the exact data it had when deleted. */
export async function restoreCrmRecycleBinEntry(
  entryId: string,
  user: User | null | undefined,
): Promise<void> {
  assertCrmAdmin(user);
  const snap = await get(ref(database, `${CRM_RECYCLE_BIN_PATH}/${entryId}`));
  if (!snap.exists())
    throw new Error("This record is no longer in the Recycle Bin.");
  const entry = snap.val() as Omit<CrmRecycleBinEntry, "id">;

  const updates: Record<string, unknown> = {
    [`${entry.path}/${entry.recordId}`]: entry.data,
    [`${CRM_RECYCLE_BIN_PATH}/${entryId}`]: null,
  };
  if (entry.related) {
    entry.related.forEach(({ path: fullPath, data }) => {
      updates[fullPath] = data;
    });
  }

  await update(ref(database), updates);
  await writeCrmAuditLog({
    action: "record_restored",
    entityType: entry.entityType,
    entityId: entry.recordId,
    details: `"${entry.label}" restored from Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

/** Permanently and irreversibly removes a Recycle Bin entry. Refuses (throws) if `user` is not a
 *  CRM Admin. Call only after explicit user confirmation. */
export async function permanentlyDeleteCrmRecycleBinEntry(
  entryId: string,
  user: User | null | undefined,
): Promise<void> {
  assertCrmAdmin(user);
  await remove(ref(database, `${CRM_RECYCLE_BIN_PATH}/${entryId}`));
}

export function subscribeCrmRecycleBin(
  callback: (entries: CrmRecycleBinEntry[]) => void,
): () => void {
  const binRef = ref(database, CRM_RECYCLE_BIN_PATH);
  return subscribeRaw(binRef, (val) => {
    const entries = Object.entries(val || {}).map(
      ([id, item]) => ({ id, ...(item as object) }) as CrmRecycleBinEntry,
    );
    entries.sort((a, b) => b.deletedAt - a.deletedAt);
    callback(entries);
  });
}

// Local onValue/off wrapper (mirrors firebaseCollection.ts's subscribeCollection) so this file
// doesn't need to depend on the generic `T extends { id: string }` collection helper for a
// Record<string, unknown> value shape.
function subscribeRaw(
  dbRef: DatabaseReference,
  callback: (val: Record<string, unknown> | null) => void,
): () => void {
  const unsubscribe = onValue(dbRef, (snap) => callback(snap.val()));
  return () => unsubscribe();
}
