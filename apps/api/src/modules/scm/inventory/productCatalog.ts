import { getAllRecords } from "@/services/firebase";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";

/**
 * `sales/products` records are NOT the flat `Product` type declared in
 * `src/types/index.ts` — the real Products.tsx form (src/modules/sales/Products.tsx)
 * writes a parent record with a `name` and a nested `items[]` array, and each item
 * (not the parent) carries the actual sellable SKU fields (productCode, stockQty,
 * unitPrice, uom...). A handful of legacy records are still flat. This module is
 * the single place that reconciles both shapes into one stable, inventory-usable
 * catalog, keyed by productCode (the one field that's stable per SKU) — the stock
 * ledger and every inventory page use this instead of re-deriving it themselves.
 */
export interface SellableProduct {
  /** Stable per-SKU key used throughout the inventory domain. */
  productCode: string;
  /** Parent sales/products record id, kept for traceability back to the Product Master. */
  parentProductId: string;
  name: string;
  category?: string;
  uom: string;
  unitPrice: number;
  hsn?: string;
}

/** UOM used when a product/line doesn't specify one. */
export const DEFAULT_UOM = "PCS";

type LooseRecord = Record<string, unknown>;

/** Reads the first present (non-empty) field across the different key names loosely-typed
 * records (products, sales-order lines) are known to use. */
export function readAny<T = string>(
  obj: unknown,
  keys: string[],
  fallback?: T,
): T | undefined {
  const rec = obj as LooseRecord | null | undefined;
  for (const k of keys) {
    const v = rec?.[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return fallback;
}

export async function getSellableProducts(): Promise<SellableProduct[]> {
  const rawProducts = await getAllRecords(SCM_CROSS_MODULE_PATHS.products);
  const out: SellableProduct[] = [];
  const seen = new Set<string>();

  for (const product of rawProducts as (LooseRecord & {
    id: string;
    name?: string;
  })[]) {
    const items = Array.isArray(product.items)
      ? (product.items as LooseRecord[])
      : null;

    if (items && items.length > 0) {
      items.forEach((item, idx) => {
        const code =
          readAny(item, ["productCode", "sku", "itemCode"]) ||
          `${product.id}-${idx + 1}`;
        if (seen.has(code)) return;
        seen.add(code);
        out.push({
          productCode: code,
          parentProductId: product.id,
          name:
            items.length > 1
              ? `${product.name} — ${code}`
              : product.name || code,
          category: readAny(item, ["category"]),
          uom: readAny(item, ["uom", "unit"], DEFAULT_UOM) as string,
          unitPrice: Number(readAny<number>(item, ["unitPrice"], 0)) || 0,
          hsn: readAny(item, ["hsn"]),
        });
      });
    } else {
      // Legacy flat record.
      const code: string =
        readAny(product, ["productCode", "sku"]) || product.id;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push({
        productCode: code,
        parentProductId: product.id,
        name: product.name || code,
        category: undefined,
        uom: readAny(product, ["uom"], DEFAULT_UOM) as string,
        unitPrice: Number(readAny<number>(product, ["unitPrice"], 0)) || 0,
        hsn: readAny(product, ["hsn"]),
      });
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}
