// Feature 7 — Notes System. Fully isolated new Firebase path: `crm/notes/{companyKey}/{noteId}`.
// Never added as a column to any existing source tab.
import { onValue, push, ref, set } from "firebase/database";
import { database } from "@/services/firebase";
import { CrmNote } from "./types";
import { writeCrmAuditLog } from "./auditService";
import { softDeleteCrmRecord } from "../domain/recycleBinService";
import { User } from "@/types";

export function crmNotesPath(companyKey: string): string {
  return `crm/notes/${companyKey}`;
}

export function subscribeCrmNotes(
  companyKey: string,
  callback: (notes: CrmNote[]) => void,
): () => void {
  const notesRef = ref(database, crmNotesPath(companyKey));
  const unsubscribe = onValue(notesRef, (snap) => {
    const val = (snap.val() || {}) as Record<string, Omit<CrmNote, "id">>;
    const notes = Object.entries(val).map(([id, n]) => ({ id, ...n }));
    notes.sort((a, b) => b.createdAt - a.createdAt);
    callback(notes);
  });
  return () => unsubscribe();
}

export async function addCrmNote(
  companyKey: string,
  companyName: string,
  content: string,
  createdBy: string,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  const newRef = push(ref(database, crmNotesPath(companyKey)));
  const now = Date.now();
  await set(newRef, { content: trimmed, createdBy, createdAt: now });
  await writeCrmAuditLog({
    companyKey,
    companyName,
    action: "note_added",
    details: `Note added by ${createdBy}`,
    by: createdBy,
    at: now,
  });
}

export async function deleteCrmNote(
  companyKey: string,
  noteId: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "note",
    "Note",
    crmNotesPath(companyKey),
    noteId,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    companyKey,
    action: "record_deleted",
    entityType: "note",
    entityId: noteId,
    details: "Note moved to Recycle Bin",
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
