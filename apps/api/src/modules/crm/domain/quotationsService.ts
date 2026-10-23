// CRM Core Domain — Quotations. Isolated Firebase path: `crm/quotations`. Intentionally a
// separate, CRM-only collection from the unrelated `sales/quotations` table used by the Sales
// module — see `linkedSalesQuotationId` on `CrmQuotation` for the forward-compatible integration
// hook (never populated automatically).
import { onValue, ref, set } from "firebase/database";
import { database } from "@/services/firebase";
import { CRM_QUOTATION_ITEMS_PATH, CRM_QUOTATIONS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import {
  CrmQuotation,
  CrmQuotationInput,
  CrmQuotationLineItem,
  CrmQuotationStatus,
} from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { logCrmActivitySilently } from "./activitiesService";
import { softDeleteCrmRecordWithRelated } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmQuotations(
  callback: (quotations: CrmQuotation[]) => void,
): () => void {
  return subscribeCollection<CrmQuotation>(CRM_QUOTATIONS_PATH, (items) => {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(items);
  });
}

export async function createCrmQuotation(
  input: CrmQuotationInput,
  createdBy: string,
): Promise<string> {
  const id = await createInCollection<CrmQuotation>(CRM_QUOTATIONS_PATH, {
    ...input,
    createdBy,
    createdAt: Date.now(),
  } as Omit<CrmQuotation, "id">);
  await writeCrmAuditLog({
    action: "quotation_created",
    entityType: "quotation",
    entityId: id,
    companyKey: input.accountId,
    details: `Quotation ${input.quotationNumber} created — ₹${input.amount.toLocaleString("en-IN")}`,
    by: createdBy,
    at: Date.now(),
  });
  return id;
}

export async function updateCrmQuotation(
  id: string,
  data: Partial<CrmQuotation>,
  by: string,
): Promise<void> {
  await updateInCollection(CRM_QUOTATIONS_PATH, id, data);
  await writeCrmAuditLog({
    action: "quotation_updated",
    entityType: "quotation",
    entityId: id,
    details: "Quotation updated",
    by,
    at: Date.now(),
  });
}

/** Records a distinct audit entry for a quote lifecycle transition (Draft → Sent → Accepted/
 *  Rejected/Expired), on top of whatever `updateCrmQuotation` already logs for the same save —
 *  callers fire this only when the status field actually changed. */
export async function changeCrmQuotationStatus(
  id: string,
  quotationNumber: string,
  status: CrmQuotationStatus,
  by: string,
  related?: { accountId?: string; opportunityId?: string },
): Promise<void> {
  const now = Date.now();
  await writeCrmAuditLog({
    action: "quotation_status_changed",
    entityType: "quotation",
    entityId: id,
    details: `Quotation ${quotationNumber} status changed to ${status}`,
    by,
    at: now,
  });
  const relatedId = related?.opportunityId || related?.accountId;
  if (relatedId) {
    await logCrmActivitySilently({
      relatedType: related?.opportunityId ? "opportunity" : "account",
      relatedId,
      type: "Proposal",
      subject: `Quote ${quotationNumber} — ${status}`,
      occurredAt: now,
      createdBy: by,
    });
  }
}

export async function deleteCrmQuotation(
  id: string,
  quotationNumber: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecordWithRelated(
    "quotation",
    quotationNumber,
    CRM_QUOTATIONS_PATH,
    id,
    user,
    {
      items: `${CRM_QUOTATION_ITEMS_PATH}/${id}`,
    },
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "quotation_deleted",
    entityType: "quotation",
    entityId: id,
    details: `Quotation ${quotationNumber} moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

// --- Quotation line items — one keyed sub-node per quotation (`crm/quotationItems/{quoteId}`),
// same shape as the opportunity stage-history sub-collection but replace-all rather than
// append-only, since the item table on `QuoteForm` is edited and saved as a whole. -------------

/** Every quotation's line items, flattened across the whole `crm/quotationItems` tree — needed
 *  wherever a product-usage check must span every quote, not just the one currently open in
 *  QuoteForm (e.g. the Products delete-guard, which otherwise only sees deal-line-item usage). */
export function subscribeCrmAllQuotationItems(
  callback: (items: CrmQuotationLineItem[]) => void,
): () => void {
  const rootRef = ref(database, CRM_QUOTATION_ITEMS_PATH);
  const unsubscribe = onValue(rootRef, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Record<string, Omit<CrmQuotationLineItem, "id" | "quotationId">>
    >;
    const items: CrmQuotationLineItem[] = [];
    Object.entries(val).forEach(([quotationId, itemsById]) => {
      Object.entries(itemsById || {}).forEach(([id, item]) =>
        items.push({ id, quotationId, ...item }),
      );
    });
    callback(items);
  });
  return () => unsubscribe();
}

export function subscribeCrmQuotationItems(
  quotationId: string,
  callback: (items: CrmQuotationLineItem[]) => void,
): () => void {
  const itemsRef = ref(database, `${CRM_QUOTATION_ITEMS_PATH}/${quotationId}`);
  const unsubscribe = onValue(itemsRef, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Omit<CrmQuotationLineItem, "id" | "quotationId">
    >;
    const items = Object.entries(val).map(([id, item]) => ({
      id,
      quotationId,
      ...item,
    }));
    callback(items);
  });
  return () => unsubscribe();
}

/** Replaces every line item under this quotation with the given list, and updates the
 *  quotation's cached subtotal/tax/adjustment/grandTotal + `amount` in one call. */
export async function setCrmQuotationItems(
  quotationId: string,
  items: Omit<CrmQuotationLineItem, "id" | "quotationId">[],
  totals: {
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    adjustment: number;
    grandTotal: number;
  },
  by: string,
): Promise<void> {
  const itemsRef = ref(database, `${CRM_QUOTATION_ITEMS_PATH}/${quotationId}`);
  const payload: Record<
    string,
    Omit<CrmQuotationLineItem, "id" | "quotationId">
  > = {};
  items.forEach((item, index) => {
    payload[`item_${index}`] = item;
  });
  await set(itemsRef, payload);
  await updateInCollection(CRM_QUOTATIONS_PATH, quotationId, {
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    totalTax: totals.totalTax,
    adjustment: totals.adjustment,
    grandTotal: totals.grandTotal,
    amount: totals.grandTotal,
    updatedAt: Date.now(),
  });
  await writeCrmAuditLog({
    action: "quotation_items_updated",
    entityType: "quotation",
    entityId: quotationId,
    details: `Quotation items updated — ${items.length} line item${items.length === 1 ? "" : "s"}, grand total ₹${totals.grandTotal.toLocaleString("en-IN")}`,
    by,
    at: Date.now(),
  });
}
