// CRM Core Domain — Deal Products (line items attached to an Opportunity/Deal). Isolated
// Firebase path: `crm/dealProducts`, flat collection filtered by `opportunityId` in memory — same
// pattern `contactsService.ts` uses for `accountId`.
import { CRM_DEAL_PRODUCTS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmDealProduct, CrmDealProductInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { round2 } from "./currency";
import { User } from "@/types";

export function subscribeCrmDealProducts(
  callback: (dealProducts: CrmDealProduct[]) => void,
): () => void {
  return subscribeCollection<CrmDealProduct>(CRM_DEAL_PRODUCTS_PATH, callback);
}

/** Single source of truth for a line item's gross/discount/tax/total breakdown — rounds at every
 *  step (gross → discount → taxable → tax → total), not just once at the end, and is shared by
 *  both the Deal Products tab (`computeDealProductTotal` below) and QuoteForm.tsx's line table, so
 *  a deal's Products-tab total and the total shown once that same deal becomes a Quote never
 *  disagree by a rounding cent for identical qty/price/discount/tax inputs. */
export function computeLineBreakdown(
  quantity: number,
  unitPrice: number,
  discountPercent = 0,
  taxPercent = 0,
) {
  const gross = round2((quantity || 0) * (unitPrice || 0));
  const discountAmount = round2(gross * ((discountPercent || 0) / 100));
  const taxableAmount = round2(gross - discountAmount);
  const taxAmount = round2(taxableAmount * ((taxPercent || 0) / 100));
  const total = round2(taxableAmount + taxAmount);
  return { gross, discountAmount, taxAmount, total };
}

export function computeDealProductTotal(
  quantity: number,
  unitPrice: number,
  discountPercent = 0,
  taxPercent = 0,
): number {
  return computeLineBreakdown(quantity, unitPrice, discountPercent, taxPercent)
    .total;
}

/** Bulk-adds one or more products to a deal in one pass (from the product picker), each becoming
 *  its own `CrmDealProduct` row. */
export async function addCrmDealProducts(
  opportunityId: string,
  opportunityTitle: string,
  items: Omit<CrmDealProductInput, "opportunityId">[],
  createdBy: string,
): Promise<void> {
  const now = Date.now();
  for (const item of items) {
    // Sequential, not Promise.all — Firebase `push` id ordering stays predictable and any single
    // failure doesn't leave a partially-written batch impossible to diagnose.
    // eslint-disable-next-line no-await-in-loop
    await createInCollection<CrmDealProduct>(CRM_DEAL_PRODUCTS_PATH, {
      ...item,
      opportunityId,
      createdBy,
      createdAt: now,
    } as Omit<CrmDealProduct, "id">);
  }
  await writeCrmAuditLog({
    action: "deal_product_added",
    entityType: "opportunity",
    entityId: opportunityId,
    details: `${items.length} product${items.length === 1 ? "" : "s"} added to deal "${opportunityTitle}"`,
    by: createdBy,
    at: now,
  });
}

export async function updateCrmDealProduct(
  id: string,
  data: Partial<CrmDealProduct>,
  by: string,
): Promise<void> {
  await updateInCollection(CRM_DEAL_PRODUCTS_PATH, id, data);
  await writeCrmAuditLog({
    action: "deal_product_updated",
    entityType: "opportunity",
    entityId: id,
    details: "Deal product line item updated",
    by,
    at: Date.now(),
  });
}

export async function removeCrmDealProduct(
  id: string,
  productName: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "dealProduct",
    productName,
    CRM_DEAL_PRODUCTS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "deal_product_removed",
    entityType: "opportunity",
    entityId: id,
    details: `Product "${productName}" removed from deal (moved to Recycle Bin)`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
