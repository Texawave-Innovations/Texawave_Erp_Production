// CRM Core Domain — Documents. Isolated Firebase path: `crm/documents`. Stores metadata + an
// external link rather than an uploaded file — `src/services/firebase.ts` only wires up the
// Realtime Database, not Firebase Storage, so file upload is out of scope for this pass. The
// shape below can be upgraded to a real upload later without changing any caller.
import { CRM_DOCUMENTS_PATH } from "./config";
import { createInCollection, subscribeCollection } from "./firebaseCollection";
import { CrmDocument, CrmDocumentInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmDocuments(
  callback: (documents: CrmDocument[]) => void,
): () => void {
  return subscribeCollection<CrmDocument>(CRM_DOCUMENTS_PATH, (items) => {
    items.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    callback(items);
  });
}

export async function addCrmDocument(input: CrmDocumentInput): Promise<string> {
  const id = await createInCollection<CrmDocument>(CRM_DOCUMENTS_PATH, {
    ...input,
    uploadedAt: Date.now(),
  } as Omit<CrmDocument, "id">);
  await writeCrmAuditLog({
    action: "document_added",
    entityType: "document",
    entityId: id,
    companyKey: input.relatedId,
    details: `Document "${input.name}" added`,
    by: input.uploadedBy,
    at: Date.now(),
  });
  return id;
}

export async function deleteCrmDocument(
  id: string,
  name: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "document",
    name,
    CRM_DOCUMENTS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "document_deleted",
    entityType: "document",
    entityId: id,
    details: `Document "${name}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
