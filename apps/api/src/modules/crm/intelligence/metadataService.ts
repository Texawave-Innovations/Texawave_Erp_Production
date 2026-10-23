// Feature 6 — Priority + Lead Classification Layer. Fully isolated new Firebase path:
// `crm/metadata/{companyKey}`. Never added as a column to any existing source tab.
import { onValue, ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import { CrmMetadata, CrmPriority, CrmTemperature } from "./types";
import { writeCrmAuditLog } from "./auditService";

export const CRM_METADATA_PATH = "crm/metadata";

export function subscribeCrmMetadata(
  callback: (metadata: Record<string, CrmMetadata>) => void,
): () => void {
  const metaRef = ref(database, CRM_METADATA_PATH);
  const unsubscribe = onValue(metaRef, (snap) => callback(snap.val() || {}));
  return () => unsubscribe();
}

/** Same data as `subscribeCrmMetadata`, but for one company only — reads directly from
 *  `crm/metadata/{companyKey}` instead of downloading every company's metadata just to pick one
 *  entry back out of it client-side (what Company 360 previously did). */
export function subscribeCrmMetadataForCompany(
  companyKey: string,
  callback: (metadata: CrmMetadata | undefined) => void,
): () => void {
  const metaRef = ref(database, `${CRM_METADATA_PATH}/${companyKey}`);
  const unsubscribe = onValue(metaRef, (snap) =>
    callback(snap.val() || undefined),
  );
  return () => unsubscribe();
}

export async function setCrmPriority(
  companyKey: string,
  companyName: string,
  priority: CrmPriority,
  by: string,
): Promise<void> {
  const now = Date.now();
  // A network drop mid-sequence would previously leave a new priority badge with a stale/missing
  // `updatedBy`/`updatedAt` — one atomic multi-path update() instead of 3 sequential set() calls.
  await update(ref(database, `${CRM_METADATA_PATH}/${companyKey}`), {
    priority,
    updatedBy: by,
    updatedAt: now,
  });
  await writeCrmAuditLog({
    companyKey,
    companyName,
    action: "priority_changed",
    details: `Priority set to ${priority}`,
    by,
    at: now,
  });
}

export async function setCrmTemperature(
  companyKey: string,
  companyName: string,
  temperature: CrmTemperature,
  by: string,
): Promise<void> {
  const now = Date.now();
  await update(ref(database, `${CRM_METADATA_PATH}/${companyKey}`), {
    temperature,
    updatedBy: by,
    updatedAt: now,
  });
  await writeCrmAuditLog({
    companyKey,
    companyName,
    action: "temperature_changed",
    details: `Lead temperature set to ${temperature}`,
    by,
    at: now,
  });
}
