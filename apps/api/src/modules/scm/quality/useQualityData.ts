import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "@/modules/scm/inventory/inventoryPaths";
import {
  getSellableProducts,
  type SellableProduct,
} from "@/modules/scm/inventory/productCatalog";
import { getStockBalances } from "@/modules/scm/inventory/stockLedgerService";
import {
  loadReturnSourceCollections,
  type ReturnSourceCollections,
} from "@/modules/scm/returns/returnsData";
import { useAsyncData } from "@/modules/scm/shared/useAsyncAction";
import { QUALITY_PATHS } from "./qualityPaths";
import type {
  ScmQualityDefect,
  ScmQualityInspection,
  ScmQualityQuarantineRecord,
  ScmQualityTemplate,
  SerialNumberRecord,
  StockBalance,
  StockBatch,
  WarehouseLocation,
} from "@/types";

export interface QualityData extends ReturnSourceCollections {
  inspections: ScmQualityInspection[];
  templates: ScmQualityTemplate[];
  defects: ScmQualityDefect[];
  quarantine: ScmQualityQuarantineRecord[];
  locations: WarehouseLocation[];
  products: SellableProduct[];
  batches: StockBatch[];
  serials: SerialNumberRecord[];
  stockBalances: StockBalance[];
}

function byNewest<T extends { createdAt?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function loadQualityData(): Promise<QualityData> {
  const [
    common,
    inspections,
    templates,
    defects,
    quarantine,
    locations,
    products,
    batches,
    serials,
    stockBalances,
  ] = await Promise.all([
    loadReturnSourceCollections(),
    getAllRecords(QUALITY_PATHS.inspections) as Promise<ScmQualityInspection[]>,
    getAllRecords(QUALITY_PATHS.templates) as Promise<ScmQualityTemplate[]>,
    getAllRecords(QUALITY_PATHS.defects) as Promise<ScmQualityDefect[]>,
    getAllRecords(QUALITY_PATHS.quarantine) as Promise<
      ScmQualityQuarantineRecord[]
    >,
    getAllRecords(INVENTORY_PATHS.locations) as Promise<WarehouseLocation[]>,
    getSellableProducts(),
    getAllRecords(INVENTORY_PATHS.batches) as Promise<StockBatch[]>,
    getAllRecords(INVENTORY_PATHS.serials) as Promise<SerialNumberRecord[]>,
    getStockBalances(),
  ]);
  return {
    ...common,
    returns: common.returns.filter((r) => r.returnType === "CUSTOMER_RETURN"),
    inspections: byNewest(inspections),
    templates,
    defects,
    quarantine: byNewest(quarantine),
    locations,
    products,
    batches,
    serials,
    stockBalances,
  };
}

const EMPTY: QualityData = {
  returns: [],
  fulfillments: [],
  grns: [],
  vendors: [],
  warehouses: [],
  inspections: [],
  templates: [],
  defects: [],
  quarantine: [],
  locations: [],
  products: [],
  batches: [],
  serials: [],
  stockBalances: [],
};

/** Shared data loader for the Quality pages. */
export function useQualityData() {
  const { data, loading, error, reload } = useAsyncData(loadQualityData, EMPTY);
  return { ...data, loading, error, reload };
}
