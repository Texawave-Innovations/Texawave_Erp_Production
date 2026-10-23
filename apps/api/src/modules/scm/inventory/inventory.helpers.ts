/** Multiplier over the reorder level above which stock is flagged overstock
 * (legacy `OVERSTOCK_MULTIPLE`). */
export const OVERSTOCK_MULTIPLE = 5;

export type StockStatus =
  "Out of Stock" | "Low Stock" | "Healthy" | "Overstock";

/** Legacy `computeStockStatus`: a render-time label, never persisted. */
export function computeStockStatus(
  available: number,
  reorderLevel: number | null,
): StockStatus {
  if (available <= 0) return "Out of Stock";
  if (reorderLevel != null && available <= reorderLevel) return "Low Stock";
  if (
    reorderLevel != null &&
    reorderLevel > 0 &&
    available > reorderLevel * OVERSTOCK_MULTIPLE
  ) {
    return "Overstock";
  }
  return "Healthy";
}

/** Stock is valued at cost, never at selling price. */
export function stockValue(onHand: number, costPrice: number): number {
  return (onHand || 0) * (costPrice || 0);
}

export interface InventoryRow {
  id: string;
  productId: number;
  productCode: string;
  productName: string;
  category: string | null;
  uom: string;
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  quarantine: number;
  reorderLevel: number | null;
  costPrice: number;
  value: number;
  stockStatus: StockStatus;
}

export function buildInventoryRow(
  product: {
    id: number;
    productCode: string;
    name: string;
    category: string | null;
    uom: string;
    costPrice: { toString(): string };
    reorderLevel: { toString(): string } | null;
  },
  warehouse: { id: number; name: string },
  balance:
    | {
        onHand: { toString(): string };
        reserved: { toString(): string };
        incoming: { toString(): string };
        damaged: { toString(): string };
        quarantine: { toString(): string };
      }
    | undefined,
): InventoryRow {
  const onHand = Number(balance?.onHand ?? 0);
  const reserved = Number(balance?.reserved ?? 0);
  const available = onHand - reserved;
  const reorderLevel =
    product.reorderLevel === null ? null : Number(product.reorderLevel);
  const costPrice = Number(product.costPrice);
  return {
    id: `${product.id}-${warehouse.id}`,
    productId: product.id,
    productCode: product.productCode,
    productName: product.name,
    category: product.category,
    uom: product.uom,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    onHand,
    reserved,
    available,
    incoming: Number(balance?.incoming ?? 0),
    damaged: Number(balance?.damaged ?? 0),
    quarantine: Number(balance?.quarantine ?? 0),
    reorderLevel,
    costPrice,
    value: stockValue(onHand, costPrice),
    stockStatus: computeStockStatus(available, reorderLevel),
  };
}
