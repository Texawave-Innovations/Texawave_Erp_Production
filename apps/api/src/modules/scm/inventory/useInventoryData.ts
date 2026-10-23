import { useCallback, useEffect, useMemo, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "./inventoryPaths";
import {
  DEFAULT_UOM,
  getSellableProducts,
  type SellableProduct,
} from "./productCatalog";
import { errorMessage } from "../shared/format";
import { OVERSTOCK_MULTIPLE } from "../shared/businessRules";
import type { InventorySettings, StockBalance, Warehouse } from "@/types";

export interface InventoryRow {
  productCode: string;
  productName: string;
  category?: string;
  uom: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  reorderLevel?: number;
  costPrice?: number;
  hasLedgerHistory: boolean;
}

export type StockStatus =
  "Out of Stock" | "Low Stock" | "Healthy" | "Overstock";

export function computeStockStatus(row: InventoryRow): StockStatus {
  if (row.available <= 0) return "Out of Stock";
  if (row.reorderLevel != null && row.available <= row.reorderLevel)
    return "Low Stock";
  if (
    row.reorderLevel != null &&
    row.available > row.reorderLevel * OVERSTOCK_MULTIPLE &&
    row.reorderLevel > 0
  )
    return "Overstock";
  return "Healthy";
}

/** The one place a stock-balance row is turned into an InventoryRow — every inventory screen,
 * report and intelligence service builds rows through this so they always agree. */
export function buildInventoryRow(
  bal: StockBalance,
  product: SellableProduct | undefined,
  setting: InventorySettings | undefined,
  warehouse: Warehouse | undefined,
): InventoryRow {
  return {
    productCode: bal.productCode,
    productName: product?.name || bal.productName || bal.productCode,
    category: product?.category,
    uom: product?.uom || DEFAULT_UOM,
    warehouseId: bal.warehouseId,
    warehouseName: warehouse?.name || "Unknown warehouse",
    onHand: bal.onHand || 0,
    reserved: bal.reserved || 0,
    available: bal.available ?? (bal.onHand || 0) - (bal.reserved || 0),
    incoming: bal.incoming || 0,
    damaged: bal.damaged || 0,
    reorderLevel: setting?.reorderLevel,
    costPrice: setting?.costPrice,
    hasLedgerHistory: true,
  };
}

/** Shared data loader for every Inventory page — one product catalog + warehouse
 * list + balances fetch, reused instead of every page re-querying Firebase. */
export function useInventoryData() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SellableProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [settings, setSettings] = useState<InventorySettings[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, b, s] = await Promise.all([
        getSellableProducts(),
        getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
        getAllRecords(INVENTORY_PATHS.balances) as Promise<StockBalance[]>,
        getAllRecords(INVENTORY_PATHS.settings) as Promise<InventorySettings[]>,
      ]);
      setProducts(p);
      setWarehouses(w);
      setBalances(b);
      setSettings(s);
      setError(null);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load inventory data"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const settingsByCode = useMemo(
    () => new Map(settings.map((s) => [s.productCode, s])),
    [settings],
  );

  // One row per product per warehouse that actually has a balance record, plus
  // one zero row per product per active warehouse so every SKU is visible even
  // before any ledger entry exists for it there.
  const rows = useMemo(() => {
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
    const productByCode = new Map(products.map((p) => [p.productCode, p]));
    const out: InventoryRow[] = [];
    const seenKeys = new Set<string>();
    for (const bal of balances) {
      seenKeys.add(`${bal.productCode}__${bal.warehouseId}`);
      out.push(
        buildInventoryRow(
          bal,
          productByCode.get(bal.productCode),
          settingsByCode.get(bal.productCode),
          warehouseById.get(bal.warehouseId),
        ),
      );
    }
    const activeWarehouses = warehouses.filter((w) => w.status === "Active");
    for (const product of products) {
      for (const wh of activeWarehouses) {
        if (seenKeys.has(`${product.productCode}__${wh.id}`)) continue;
        const setting = settingsByCode.get(product.productCode);
        out.push({
          productCode: product.productCode,
          productName: product.name,
          category: product.category,
          uom: product.uom,
          warehouseId: wh.id,
          warehouseName: wh.name,
          onHand: 0,
          reserved: 0,
          available: 0,
          incoming: 0,
          damaged: 0,
          reorderLevel: setting?.reorderLevel,
          costPrice: setting?.costPrice,
          hasLedgerHistory: false,
        });
      }
    }
    return out;
  }, [balances, products, warehouses, settingsByCode]);

  return {
    loading,
    error,
    products,
    warehouses,
    balances,
    settings,
    settingsByCode,
    rows,
    reload: load,
  };
}
