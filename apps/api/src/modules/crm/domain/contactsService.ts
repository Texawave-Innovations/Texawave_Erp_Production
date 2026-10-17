// CRM Core Domain — Contacts. Isolated Firebase path: `crm/contacts`, each row carries its
// parent `accountId` (flat collection, filtered in memory — same pattern the rest of the CRM
// module already uses for small, fully-subscribed tables).
import { get, ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import {
  CRM_CONTACTS_PATH,
  CRM_OPPORTUNITIES_PATH,
  CRM_QUOTATIONS_PATH,
} from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmContact, CrmContactInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { assertCrmAdmin, softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmContacts(
  callback: (contacts: CrmContact[]) => void,
): () => void {
  return subscribeCollection<CrmContact>(CRM_CONTACTS_PATH, callback);
}

export async function createCrmContact(
  input: CrmContactInput,
): Promise<string> {
  const now = Date.now();
  const id = await createInCollection<CrmContact>(CRM_CONTACTS_PATH, {
    ...input,
    createdAt: now,
  } as Omit<CrmContact, "id">);
  await writeCrmAuditLog({
    action: "contact_added",
    entityType: "contact",
    entityId: id,
    companyKey: input.accountId,
    details: `Contact "${input.name}" added`,
    by: input.createdBy,
    at: now,
  });
  return id;
}

export async function updateCrmContact(
  id: string,
  data: Partial<CrmContact>,
  updatedBy: string,
): Promise<void> {
  await updateInCollection(CRM_CONTACTS_PATH, id, {
    ...data,
    updatedAt: Date.now(),
  });
  await writeCrmAuditLog({
    action: "contact_updated",
    entityType: "contact",
    entityId: id,
    details: "Contact details updated",
    by: updatedBy,
    at: Date.now(),
  });
}

export async function deleteCrmContact(
  id: string,
  name: string,
  user: User | null | undefined,
): Promise<void> {
  // Check permission BEFORE touching anything — `softDeleteCrmRecord` below runs this same check
  // internally, but only after the contactId-clearing writes further down had already landed.
  // A rejected caller would still have permanently orphaned real Opportunities/Quotations from
  // this contact even though the contact itself was never deleted (the throw would abort before
  // reaching `softDeleteCrmRecord`), with the whole call surfacing only as a thrown error and no
  // audit trail of what actually changed.
  assertCrmAdmin(user);

  // The delete-confirm warning promises linked deals/quotes "keep their contact reference
  // removed, not be deleted" — actually clear contactId off every Opportunity/Quotation that
  // points here, instead of leaving them silently pointing at a recycle-binned contact forever.
  const [oppsSnap, quotesSnap] = await Promise.all([
    get(ref(database, CRM_OPPORTUNITIES_PATH)),
    get(ref(database, CRM_QUOTATIONS_PATH)),
  ]);
  const clearUpdates: Record<string, null> = {};
  const opps = (oppsSnap.val() || {}) as Record<string, { contactId?: string }>;
  Object.entries(opps).forEach(([oppId, o]) => {
    if (o.contactId === id)
      clearUpdates[`${CRM_OPPORTUNITIES_PATH}/${oppId}/contactId`] = null;
  });
  const quotes = (quotesSnap.val() || {}) as Record<
    string,
    { contactId?: string }
  >;
  Object.entries(quotes).forEach(([quoteId, q]) => {
    if (q.contactId === id)
      clearUpdates[`${CRM_QUOTATIONS_PATH}/${quoteId}/contactId`] = null;
  });
  if (Object.keys(clearUpdates).length > 0) {
    await update(ref(database), clearUpdates);
  }

  const deleted = await softDeleteCrmRecord(
    "contact",
    name,
    CRM_CONTACTS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "contact_deleted",
    entityType: "contact",
    entityId: id,
    details: `Contact "${name}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
