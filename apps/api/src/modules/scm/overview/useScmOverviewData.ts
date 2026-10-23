import { useMemo } from "react";
import { buildInventoryRows } from "../reports/calculations";
import { useScmReportsData } from "../reports/reportService";
import {
  IN_TRANSIT_SHIPMENT_STATUSES,
  OPEN_INSPECTION_STATUSES,
  OPEN_PO_STATUSES,
  OPEN_REQUISITION_STATUSES,
  OPEN_SO_STATUSES,
  PENDING_SHIPMENT_STATUSES,
  PROBLEM_SHIPMENT_STATUSES,
  RECEIVABLE_PO_STATUSES,
  isSupplierActive,
  pendingReceiptQty,
  stockValue,
} from "../shared/businessRules";
import { formatCurrency } from "../shared/format";

export interface ScmKpi {
  id: string;
  label: string;
  value: string;
  hint: string;
}

export interface ScmOverviewData {
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** When the figures were fetched (ms); the overview is a snapshot, not a live feed. */
  loadedAt: number;
  kpis: ScmKpi[];
  supplierCount: number;
  openRequisitionCount: number;
  activeLocationCount: number;
  inventoryUnitsAvailable: number;
  openSalesOrderCount: number;
  openShipmentCount: number;
  openInspectionCount: number;
}

/** Shipments not yet delivered or cancelled. */
const OPEN_SHIPMENT_STATUSES = new Set<string>([
  ...PENDING_SHIPMENT_STATUSES,
  ...IN_TRANSIT_SHIPMENT_STATUSES,
  ...PROBLEM_SHIPMENT_STATUSES,
]);

/** Overview KPIs and flow counts, computed from the shared (cached) SCM dataset with the same
 * business rules the domain dashboards use. */
export function useScmOverviewData(): ScmOverviewData {
  const { data, loading, error, reload, loadedAt } = useScmReportsData();

  const derived = useMemo(() => {
    const rows = buildInventoryRows(data);
    const costedRows = rows.filter((r) => r.costPrice != null);
    const inventoryValue = rows.reduce(
      (sum, r) => sum + stockValue(r.onHand, r.costPrice),
      0,
    );
    const lowStockCount = rows.filter(
      (r) => r.status === "Low Stock" || r.status === "Out of Stock",
    ).length;
    const openPoCount = data.purchaseOrders.filter((po) =>
      OPEN_PO_STATUSES.has(po.status),
    ).length;
    const awaitingReceiptCount = data.purchaseOrders.filter(
      (po) =>
        RECEIVABLE_PO_STATUSES.has(po.status) &&
        po.items.some((i) => pendingReceiptQty(i) > 0),
    ).length;
    const openSalesOrderCount = data.salesOrders.filter((so) =>
      OPEN_SO_STATUSES.has(so.status),
    ).length;
    const openShipmentCount = data.shipments.filter((s) =>
      OPEN_SHIPMENT_STATUSES.has(s.status),
    ).length;
    const openInspectionCount = data.qualityInspections.filter((i) =>
      OPEN_INSPECTION_STATUSES.has(i.status),
    ).length;

    const kpis: ScmKpi[] = [
      {
        id: "inventory-value",
        label: "Total Inventory Value",
        value: formatCurrency(inventoryValue, "INR", 0),
        hint: `At cost · ${costedRows.length} of ${rows.length} stock rows costed`,
      },
      {
        id: "low-stock",
        label: "Low Stock Items",
        value: String(lowStockCount),
        hint: "At or below reorder level, or out of stock",
      },
      {
        id: "pending-po",
        label: "Open Purchase Orders",
        value: String(openPoCount),
        hint: "Approved or sent, not fully received",
      },
      {
        id: "pending-grn",
        label: "POs Awaiting Receipt",
        value: String(awaitingReceiptCount),
        hint: "Sent POs with goods still to receive",
      },
      {
        id: "open-so",
        label: "Open Sales Orders",
        value: String(openSalesOrderCount),
        hint: "Not yet delivered or cancelled",
      },
      {
        id: "pending-shipments",
        label: "Open Shipments",
        value: String(openShipmentCount),
        hint: "Not yet delivered or cancelled",
      },
    ];

    return {
      kpis,
      supplierCount: data.vendors.filter((v) => isSupplierActive(v.status))
        .length,
      openRequisitionCount: data.requisitions.filter((r) =>
        OPEN_REQUISITION_STATUSES.has(r.status),
      ).length,
      activeLocationCount: data.locations.filter((l) => l.status === "Active")
        .length,
      inventoryUnitsAvailable: rows.reduce(
        (sum, r) => sum + Math.max(0, r.available),
        0,
      ),
      openSalesOrderCount,
      openShipmentCount,
      openInspectionCount,
    };
  }, [data]);

  return { loading, error, reload, loadedAt, ...derived };
}
