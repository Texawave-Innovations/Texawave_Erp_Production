import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { ORDER_PATHS } from "../orders/orderPaths";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { useAsyncData } from "@/modules/scm/shared/useAsyncAction";
import { RETURNS_PATHS } from "./returnsPaths";
import type {
  GoodsReceipt,
  OrderFulfillment,
  ScmPurchaseOrder,
  ScmReturn,
  ScmReturnDispositionRecord,
  ScmReturnInspection,
  ScmShipment,
  Vendor,
  Warehouse,
} from "@/types";

function byNewest<T extends { createdAt?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export interface ReturnSourceCollections {
  returns: ScmReturn[];
  fulfillments: OrderFulfillment[];
  grns: GoodsReceipt[];
  vendors: Vendor[];
  warehouses: Warehouse[];
}

/** Collections both Returns and Quality read (returns + the source documents they reference).
 *  Read failures propagate — callers surface them instead of showing empty data. */
export async function loadReturnSourceCollections(): Promise<ReturnSourceCollections> {
  const [returns, fulfillments, grns, vendors, warehouses] = await Promise.all([
    getAllRecords(RETURNS_PATHS.returns) as Promise<ScmReturn[]>,
    getAllRecords(ORDER_PATHS.fulfillments) as Promise<OrderFulfillment[]>,
    getAllRecords(PROCUREMENT_PATHS.grns) as Promise<GoodsReceipt[]>,
    getAllRecords(SCM_CROSS_MODULE_PATHS.vendors) as Promise<Vendor[]>,
    getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
  ]);
  return {
    returns: byNewest(returns),
    fulfillments,
    grns,
    vendors,
    warehouses,
  };
}

export interface ReturnsData extends ReturnSourceCollections {
  inspections: ScmReturnInspection[];
  dispositions: ScmReturnDispositionRecord[];
  shipments: ScmShipment[];
  purchaseOrders: ScmPurchaseOrder[];
}

async function loadReturnsData(): Promise<ReturnsData> {
  const [common, inspections, dispositions, shipments, purchaseOrders] =
    await Promise.all([
      loadReturnSourceCollections(),
      getAllRecords(RETURNS_PATHS.inspections) as Promise<
        ScmReturnInspection[]
      >,
      getAllRecords(RETURNS_PATHS.dispositions) as Promise<
        ScmReturnDispositionRecord[]
      >,
      getAllRecords(LOGISTICS_PATHS.shipments) as Promise<ScmShipment[]>,
      getAllRecords(PROCUREMENT_PATHS.purchaseOrders) as Promise<
        ScmPurchaseOrder[]
      >,
    ]);
  return { ...common, inspections, dispositions, shipments, purchaseOrders };
}

const EMPTY: ReturnsData = {
  returns: [],
  fulfillments: [],
  grns: [],
  vendors: [],
  warehouses: [],
  inspections: [],
  dispositions: [],
  shipments: [],
  purchaseOrders: [],
};

/** Shared data loader for the Returns pages. */
export function useReturnsData() {
  const { data, loading, error, reload } = useAsyncData(loadReturnsData, EMPTY);
  return { ...data, loading, error, reload };
}
