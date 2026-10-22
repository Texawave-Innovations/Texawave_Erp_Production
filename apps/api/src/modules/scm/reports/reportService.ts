// Single shared, read-only data loader for SCM Reports, Advanced SCM and the Overview. Every
// page reads the same react-query cache entry, so the dataset is fetched once per staleness
// window instead of once per page, and a metric shown on two pages is always computed from the
// same records. GET-only: nothing here writes to Firebase.
//
// A failed read is a failure, never an empty list — the query errors and the page shows its
// error state (and the automation reconcile does not run on partial data).
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllRecords } from "@/services/firebase";
import {
  getSellableProducts,
  type SellableProduct,
} from "../inventory/productCatalog";
import { getStockBalances } from "../inventory/stockLedgerService";
import { errorMessage } from "../shared/format";
import {
  INVENTORY_PATHS,
  PROCUREMENT_PATHS,
  WAREHOUSE_PATHS,
  ORDER_PATHS,
  LOGISTICS_PATHS,
  RETURNS_PATHS,
  QUALITY_PATHS,
  CROSS_MODULE_PATHS,
} from "./reportPaths";
import type {
  Vendor,
  Warehouse,
  WarehouseLocation,
  PurchaseRequisition,
  Rfq,
  SupplierQuotation,
  ScmPurchaseOrder,
  GoodsReceipt,
  StockBalance,
  StockLedgerEntry,
  InventorySettings,
  WarehousePutaway,
  WarehouseMovement,
  WarehousePicking,
  WarehousePacking,
  OrderFulfillment,
  OrderAcknowledgement,
  ScmShipment,
  ShipmentException,
  ScmReturn,
  ScmReturnDispositionRecord,
  ScmQualityInspection,
  ScmQualityDefect,
  ScmQualityQuarantineRecord,
} from "@/types";

export interface ScmReportsRawData {
  vendors: Vendor[];
  products: SellableProduct[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  requisitions: PurchaseRequisition[];
  rfqs: Rfq[];
  quotations: SupplierQuotation[];
  purchaseOrders: ScmPurchaseOrder[];
  grns: GoodsReceipt[];
  stockBalances: StockBalance[];
  stockLedger: StockLedgerEntry[];
  inventorySettings: InventorySettings[];
  putaways: WarehousePutaway[];
  movements: WarehouseMovement[];
  pickings: WarehousePicking[];
  packings: WarehousePacking[];
  fulfillments: OrderFulfillment[];
  salesOrders: OrderAcknowledgement[];
  shipments: ScmShipment[];
  exceptions: ShipmentException[];
  returns: ScmReturn[];
  returnDispositions: ScmReturnDispositionRecord[];
  qualityInspections: ScmQualityInspection[];
  qualityDefects: ScmQualityDefect[];
  qualityQuarantine: ScmQualityQuarantineRecord[];
}

const EMPTY: ScmReportsRawData = {
  vendors: [],
  products: [],
  warehouses: [],
  locations: [],
  requisitions: [],
  rfqs: [],
  quotations: [],
  purchaseOrders: [],
  grns: [],
  stockBalances: [],
  stockLedger: [],
  inventorySettings: [],
  putaways: [],
  movements: [],
  pickings: [],
  packings: [],
  fulfillments: [],
  salesOrders: [],
  shipments: [],
  exceptions: [],
  returns: [],
  returnDispositions: [],
  qualityInspections: [],
  qualityDefects: [],
  qualityQuarantine: [],
};

/** How long a loaded dataset is reused across pages before a navigation refetches it. */
const DATA_STALE_MS = 5 * 60_000;
const QUERY_KEY = ["scm", "reportsData"] as const;

const all = <T>(path: string) => getAllRecords(path) as Promise<T[]>;

async function loadScmReportsData(): Promise<ScmReportsRawData> {
  const [
    vendors,
    products,
    warehouses,
    locations,
    requisitions,
    rfqs,
    quotations,
    purchaseOrders,
    grns,
    stockBalances,
    stockLedger,
    inventorySettings,
    putaways,
    movements,
    pickings,
    packings,
    fulfillments,
    salesOrders,
    shipments,
    exceptions,
    returns,
    returnDispositions,
    qualityInspections,
    qualityDefects,
    qualityQuarantine,
  ] = await Promise.all([
    all<Vendor>(CROSS_MODULE_PATHS.vendors),
    getSellableProducts(),
    all<Warehouse>(INVENTORY_PATHS.warehouses),
    all<WarehouseLocation>(INVENTORY_PATHS.locations),
    all<PurchaseRequisition>(PROCUREMENT_PATHS.requisitions),
    all<Rfq>(PROCUREMENT_PATHS.rfqs),
    all<SupplierQuotation>(PROCUREMENT_PATHS.quotations),
    all<ScmPurchaseOrder>(PROCUREMENT_PATHS.purchaseOrders),
    all<GoodsReceipt>(PROCUREMENT_PATHS.grns),
    getStockBalances(),
    all<StockLedgerEntry>(INVENTORY_PATHS.ledger),
    all<InventorySettings>(INVENTORY_PATHS.settings),
    all<WarehousePutaway>(WAREHOUSE_PATHS.putaways),
    all<WarehouseMovement>(WAREHOUSE_PATHS.movements),
    all<WarehousePicking>(WAREHOUSE_PATHS.pickings),
    all<WarehousePacking>(WAREHOUSE_PATHS.packings),
    all<OrderFulfillment>(ORDER_PATHS.fulfillments),
    all<OrderAcknowledgement>(CROSS_MODULE_PATHS.salesOrders),
    all<ScmShipment>(LOGISTICS_PATHS.shipments),
    all<ShipmentException>(LOGISTICS_PATHS.exceptions),
    all<ScmReturn>(RETURNS_PATHS.returns),
    all<ScmReturnDispositionRecord>(RETURNS_PATHS.dispositions),
    all<ScmQualityInspection>(QUALITY_PATHS.inspections),
    all<ScmQualityDefect>(QUALITY_PATHS.defects),
    all<ScmQualityQuarantineRecord>(QUALITY_PATHS.quarantine),
  ]);

  return {
    vendors,
    products,
    warehouses,
    locations,
    requisitions,
    rfqs,
    quotations,
    purchaseOrders,
    grns,
    stockBalances,
    stockLedger,
    inventorySettings,
    putaways,
    movements,
    pickings,
    packings,
    fulfillments,
    salesOrders,
    shipments,
    exceptions,
    returns,
    returnDispositions,
    qualityInspections,
    qualityDefects,
    qualityQuarantine,
  };
}

export interface UseScmReportsDataResult {
  loading: boolean;
  error: string | null;
  data: ScmReportsRawData;
  /** When the current dataset was fetched (ms), 0 before the first load. */
  loadedAt: number;
  reload: () => void;
}

export function useScmReportsData(): UseScmReportsDataResult {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadScmReportsData,
    staleTime: DATA_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { refetch } = query;
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    loading: query.isPending || query.isFetching,
    error: query.error
      ? errorMessage(query.error, "Failed to load report data.")
      : null,
    data: query.data ?? EMPTY,
    loadedAt: query.dataUpdatedAt,
    reload,
  };
}
