import { useCallback, useEffect, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { ORDER_PATHS } from "./orderPaths";
import type {
  FulfillmentStatus,
  OrderAcknowledgement,
  OrderFulfillment,
  Warehouse,
} from "@/types";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { FULFILLABLE_SO_STATUSES } from "@/modules/scm/shared/businessRules";
import { errorMessage } from "@/modules/scm/shared/format";

export { ALL } from "@/modules/scm/shared/format";

/** Kept as an alias so existing imports keep working — the single rule lives in businessRules. */
export const ELIGIBLE_SO_STATUSES = FULFILLABLE_SO_STATUSES;

export const FULFILLMENT_STATUS_TONE: Record<FulfillmentStatus, string> = {
  PENDING: "text-slate-600 border-slate-200 bg-slate-50",
  STOCK_CHECK: "text-slate-600 border-slate-200 bg-slate-50",
  PARTIALLY_AVAILABLE: "text-amber-600 border-amber-200 bg-amber-50",
  AVAILABLE: "text-sky-600 border-sky-200 bg-sky-50",
  RESERVED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  PICKING: "text-purple-600 border-purple-200 bg-purple-50",
  PACKING: "text-purple-600 border-purple-200 bg-purple-50",
  READY_TO_SHIP: "text-teal-600 border-teal-200 bg-teal-50",
  FULFILLED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
  ON_HOLD: "text-orange-600 border-orange-200 bg-orange-50",
};

export const SHIPPED_STATUS_TONE: Record<string, string> = {
  "Not Shipped": "text-slate-600 border-slate-200 bg-slate-50",
  "Partially Shipped": "text-amber-600 border-amber-200 bg-amber-50",
  Shipped: "text-emerald-600 border-emerald-200 bg-emerald-50",
};

/** RTDB drops empty arrays, so a freshly created fulfillment comes back without them. */
export function normalizeFulfillment(f: OrderFulfillment): OrderFulfillment {
  return {
    ...f,
    items: f.items || [],
    reservationIds: f.reservationIds || [],
    pickingIds: f.pickingIds || [],
    packingIds: f.packingIds || [],
    stockIssueLedgerEntryIds: f.stockIssueLedgerEntryIds || [],
    requisitionIds: f.requisitionIds || [],
  };
}

/** Shared data loader for the Order Fulfillment pages — sales orders, fulfillment records and
 * warehouses, loaded once instead of every page re-querying independently. */
export function useOrderFulfillmentData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesOrders, setSalesOrders] = useState<OrderAcknowledgement[]>([]);
  const [fulfillments, setFulfillments] = useState<OrderFulfillment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [so, ff, wh] = await Promise.all([
        getAllRecords(SCM_CROSS_MODULE_PATHS.salesOrders) as Promise<
          OrderAcknowledgement[]
        >,
        getAllRecords(ORDER_PATHS.fulfillments) as Promise<OrderFulfillment[]>,
        getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
      ]);
      setSalesOrders(so);
      setFulfillments(
        ff
          .map(normalizeFulfillment)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
      setWarehouses(wh);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load fulfillment data"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    salesOrders,
    fulfillments,
    warehouses,
    reload: load,
  };
}
