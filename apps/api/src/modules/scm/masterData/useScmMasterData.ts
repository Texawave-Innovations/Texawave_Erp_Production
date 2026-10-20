// Phase 12b — SCM Master Data. The one shared, cached loader for every genuine SCM master
// record — Products, Vendors, Customers, Warehouses, Locations, Batches, Serials, Carriers.
// This is the base layer the diagram in the Phase 12b spec calls "SCM MASTER DATA": the barcode
// engine (`barcode/barcodeService.ts`'s `useBarcodeMasterData`) builds on top of this instead of
// re-fetching the same collections, and any SCM form that needs a searchable product/vendor/
// customer/warehouse/location/batch/serial/carrier field should read from here via
// `scmMasterDataService.ts`'s `search*()` helpers rather than querying Firebase itself.
//
// Cached at module scope (not per-hook-instance) with a short TTL so multiple pages mounting
// this hook in the same session share one fetch instead of each re-querying every collection —
// the exact concern the Phase 12b spec raises under "Performance": "The SCM Overview should not
// suddenly become slow because of Master Data." Nothing here is fetched unless a page actually
// calls `useScmMasterData()`.
import { useCallback, useEffect, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import {
  getSellableProducts,
  type SellableProduct,
} from "../inventory/productCatalog";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import type {
  Customer,
  LogisticsCarrier,
  SerialNumberRecord,
  StockBatch,
  Vendor,
  Warehouse,
  WarehouseLocation,
} from "@/types";

export interface ScmMasterDataBundle {
  products: SellableProduct[];
  vendors: Vendor[];
  customers: Customer[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  batches: StockBatch[];
  serials: SerialNumberRecord[];
  carriers: LogisticsCarrier[];
}

const EMPTY_BUNDLE: ScmMasterDataBundle = {
  products: [],
  vendors: [],
  customers: [],
  warehouses: [],
  locations: [],
  batches: [],
  serials: [],
  carriers: [],
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: ScmMasterDataBundle | null = null;
let cachedAt = 0;
let inflight: Promise<ScmMasterDataBundle> | null = null;

async function fetchBundle(): Promise<ScmMasterDataBundle> {
  const [
    products,
    vendors,
    customers,
    warehouses,
    locations,
    batches,
    serials,
    carriers,
  ] = await Promise.all([
    getSellableProducts().catch(() => []),
    getAllRecords("contacts/vendors").catch(() => []) as Promise<Vendor[]>,
    getAllRecords("sales/customers").catch(() => []) as Promise<Customer[]>,
    getAllRecords(INVENTORY_PATHS.warehouses).catch(() => []) as Promise<
      Warehouse[]
    >,
    getAllRecords(INVENTORY_PATHS.locations).catch(() => []) as Promise<
      WarehouseLocation[]
    >,
    getAllRecords(INVENTORY_PATHS.batches).catch(() => []) as Promise<
      StockBatch[]
    >,
    getAllRecords(INVENTORY_PATHS.serials).catch(() => []) as Promise<
      SerialNumberRecord[]
    >,
    getAllRecords(LOGISTICS_PATHS.carriers).catch(() => []) as Promise<
      LogisticsCarrier[]
    >,
  ]);
  return {
    products,
    vendors,
    customers,
    warehouses,
    locations,
    batches,
    serials,
    carriers,
  };
}

async function loadMasterData(force: boolean): Promise<ScmMasterDataBundle> {
  if (!force && cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = fetchBundle()
    .then((bundle) => {
      cache = bundle;
      cachedAt = Date.now();
      return bundle;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useScmMasterData() {
  const [data, setData] = useState<ScmMasterDataBundle>(cache || EMPTY_BUNDLE);
  const [loading, setLoading] = useState(!cache);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadMasterData(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (cache && Date.now() - cachedAt < CACHE_TTL_MS) {
      setData(cache);
      setLoading(false);
      return;
    }
    loadMasterData(false).then((bundle) => {
      if (!cancelled) {
        setData(bundle);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, data, reload };
}
