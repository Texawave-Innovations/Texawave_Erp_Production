// Shared Firebase batch-write helper for Bulk Import commits. Used by every CRM tab's
// `commitImport` callback — writes every new/updated row in a single multi-path `update()` call
// (atomic, and far fewer round-trips than one push/set per row), then logs one audit summary
// entry rather than one per row.
import { ref, update, push } from "firebase/database";
import { database } from "@/services/firebase";
import { MappedImportRow, DuplicateStrategy, ImportSummary } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { stripUndefined } from "../domain/firebaseCollection";

/**
 * Writes `rows` under `path` (a Firebase Realtime Database collection path, e.g. `crm/leads` or
 * `crm/accounts`). For rows matched as duplicates: 'skip' leaves them out, 'update' merges the
 * built record into the existing record at `duplicateId`, 'create' inserts them as new records
 * anyway. Every genuinely new row gets a fresh push id.
 */
export async function commitFirebaseImport(
  path: string,
  rows: MappedImportRow[],
  strategy: DuplicateStrategy,
  /** `id` is the existing record's id when updating a duplicate, or the freshly allocated push id when creating. */
  buildRecord: (row: MappedImportRow, id: string) => Record<string, unknown>,
): Promise<ImportSummary> {
  const updates: Record<string, unknown> = {};
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.isDuplicate) {
      if (strategy === "skip") {
        skipped += 1;
        continue;
      }
      if (strategy === "update" && row.duplicateId) {
        const record = stripUndefined(buildRecord(row, row.duplicateId));
        Object.entries(record).forEach(([key, value]) => {
          updates[`${path}/${row.duplicateId}/${key}`] = value;
        });
        updated += 1;
        continue;
      }
    }
    const newRef = push(ref(database, path));
    if (!newRef.key) continue;
    updates[`${path}/${newRef.key}`] = stripUndefined(
      buildRecord(row, newRef.key),
    );
    created += 1;
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }

  return { totalRows: rows.length, created, updated, skipped, failed: 0 };
}

/** Writes one audit-log entry summarizing a completed bulk import (never one entry per row). */
export async function logBulkImportAudit(
  entityType: string,
  moduleLabel: string,
  summary: ImportSummary,
  by: string,
): Promise<void> {
  await writeCrmAuditLog({
    action: "bulk_import_completed",
    entityType,
    details: `Bulk imported ${moduleLabel}: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed (of ${summary.totalRows} rows)`,
    by,
    at: Date.now(),
  });
}
