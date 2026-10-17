// CRM Core Domain — Products catalog. Isolated Firebase path: `crm/products`. Intentionally a
// separate, CRM-only catalog from the unrelated `sales/products` table used by the Sales module
// (different owning module, no shared tax/stock model) — same isolation choice already made for
// `crm/quotations` vs `sales/quotations`.
import { CRM_PRODUCTS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import { CrmProduct, CrmProductInput } from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmProducts(
  callback: (products: CrmProduct[]) => void,
): () => void {
  return subscribeCollection<CrmProduct>(CRM_PRODUCTS_PATH, (items) => {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(items);
  });
}

export async function createCrmProduct(
  input: CrmProductInput,
  createdBy: string,
): Promise<string> {
  const now = Date.now();
  const id = await createInCollection<CrmProduct>(CRM_PRODUCTS_PATH, {
    ...input,
    createdBy,
    createdAt: now,
  } as Omit<CrmProduct, "id">);
  await writeCrmAuditLog({
    action: "product_created",
    entityType: "product",
    entityId: id,
    details: `Product "${input.name}" (${input.code}) created`,
    by: createdBy,
    at: now,
  });
  return id;
}

export async function updateCrmProduct(
  id: string,
  data: Partial<CrmProduct>,
  updatedBy: string,
): Promise<void> {
  await updateInCollection(CRM_PRODUCTS_PATH, id, {
    ...data,
    updatedBy,
    updatedAt: Date.now(),
  });
  await writeCrmAuditLog({
    action: "product_updated",
    entityType: "product",
    entityId: id,
    details: "Product details updated",
    by: updatedBy,
    at: Date.now(),
  });
}

/** Delete is refused (throws) when the product is still referenced by any deal line item or
 *  quotation line item — the caller (Products.tsx) already has both counts live and should check
 *  before calling, but this guard makes the invariant hold even if a caller forgets. */
export async function deleteCrmProduct(
  id: string,
  name: string,
  user: User | null | undefined,
  usageCount: number,
): Promise<void> {
  if (usageCount > 0) {
    throw new Error(
      `"${name}" is used in ${usageCount} deal/quote line item${usageCount === 1 ? "" : "s"} and can't be deleted while referenced.`,
    );
  }
  const deleted = await softDeleteCrmRecord(
    "product",
    name,
    CRM_PRODUCTS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "product_deleted",
    entityType: "product",
    entityId: id,
    details: `Product "${name}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
