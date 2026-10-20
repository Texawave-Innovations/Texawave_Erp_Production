import { useCallback, useEffect, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { ORDER_PATHS } from "../orders/orderPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { LOGISTICS_PATHS } from "./logisticsPaths";
import type {
  LogisticsCarrier,
  OrderAcknowledgement,
  OrderFulfillment,
  ScmShipment,
  ShipmentException,
  ShipmentStatus,
  ShipmentTrackingEvent,
  Warehouse,
  WarehousePacking,
} from "@/types";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { errorMessage } from "@/modules/scm/shared/format";
import { normalizeFulfillment } from "../orders/orderHelpers";

export { ALL } from "@/modules/scm/shared/format";

export const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  READY_TO_SHIP: "text-teal-600 border-teal-200 bg-teal-50",
  CARRIER_ASSIGNED: "text-sky-600 border-sky-200 bg-sky-50",
  LABEL_CREATED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  DISPATCHED: "text-purple-600 border-purple-200 bg-purple-50",
  IN_TRANSIT: "text-blue-600 border-blue-200 bg-blue-50",
  OUT_FOR_DELIVERY: "text-amber-600 border-amber-200 bg-amber-50",
  DELIVERED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  DELIVERY_EXCEPTION: "text-orange-600 border-orange-200 bg-orange-50",
  FAILED_DELIVERY: "text-red-600 border-red-200 bg-red-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const CARRIER_STATUS_TONE: Record<"ACTIVE" | "INACTIVE", string> = {
  ACTIVE: "text-emerald-600 border-emerald-200 bg-emerald-50",
  INACTIVE: "text-slate-500 border-slate-200 bg-slate-50",
};

export const SHIPMENT_SERVICE_TYPES = [
  "STANDARD",
  "EXPRESS",
  "SAME_DAY",
  "ECONOMY",
  "OTHER",
] as const;

export const DELIVERY_EXCEPTION_CODES = [
  "CUSTOMER_UNAVAILABLE",
  "ADDRESS_ISSUE",
  "WEATHER_DELAY",
  "DAMAGED_PACKAGE",
  "CARRIER_DELAY",
  "OTHER",
] as const;

/** Shared data loader for every Phase 7 Logistics page — shipments, carriers, tracking
 * events, exceptions, plus the read-only Phase 6/5/Sales inputs they're built from, loaded
 * once instead of every page re-querying independently. */
export function useLogisticsData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ScmShipment[]>([]);
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<ShipmentTrackingEvent[]>(
    [],
  );
  const [exceptions, setExceptions] = useState<ShipmentException[]>([]);
  const [fulfillments, setFulfillments] = useState<OrderFulfillment[]>([]);
  const [packings, setPackings] = useState<WarehousePacking[]>([]);
  const [salesOrders, setSalesOrders] = useState<OrderAcknowledgement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sh, ca, te, ex, ff, pk, so, wh] = await Promise.all([
        getAllRecords(LOGISTICS_PATHS.shipments) as Promise<ScmShipment[]>,
        getAllRecords(LOGISTICS_PATHS.carriers) as Promise<LogisticsCarrier[]>,
        getAllRecords(LOGISTICS_PATHS.trackingEvents) as Promise<
          ShipmentTrackingEvent[]
        >,
        getAllRecords(LOGISTICS_PATHS.exceptions) as Promise<
          ShipmentException[]
        >,
        getAllRecords(ORDER_PATHS.fulfillments) as Promise<OrderFulfillment[]>,
        getAllRecords(WAREHOUSE_PATHS.packings) as Promise<WarehousePacking[]>,
        getAllRecords(SCM_CROSS_MODULE_PATHS.salesOrders) as Promise<
          OrderAcknowledgement[]
        >,
        getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
      ]);
      setShipments(sh.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setCarriers(ca);
      setTrackingEvents(
        te.sort((a, b) => (b.eventTime || 0) - (a.eventTime || 0)),
      );
      setExceptions(
        ex.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0)),
      );
      setFulfillments(ff.map(normalizeFulfillment));
      setPackings(pk);
      setSalesOrders(so);
      setWarehouses(wh);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load logistics data"));
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
    shipments,
    carriers,
    trackingEvents,
    exceptions,
    fulfillments,
    packings,
    salesOrders,
    warehouses,
    reload: load,
  };
}

/** Carriers plus shipments (for per-carrier counts) — all the carrier master page needs. */
export function useCarriers() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [shipments, setShipments] = useState<ScmShipment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ca, sh] = await Promise.all([
        getAllRecords(LOGISTICS_PATHS.carriers) as Promise<LogisticsCarrier[]>,
        getAllRecords(LOGISTICS_PATHS.shipments) as Promise<ScmShipment[]>,
      ]);
      setCarriers(ca);
      setShipments(sh);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load carriers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, carriers, shipments, reload: load };
}
