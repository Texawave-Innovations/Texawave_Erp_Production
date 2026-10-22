import { useEffect, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { getStockBalances } from "@/modules/scm/inventory/stockLedgerService";
import { INVENTORY_PATHS } from "@/modules/scm/inventory/inventoryPaths";
import {
  readAny,
  type SellableProduct,
} from "@/modules/scm/inventory/productCatalog";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { OPEN_SO_STATUSES } from "@/modules/scm/shared/businessRules";
import { errorMessage } from "@/modules/scm/shared/format";
import type { PurchaseRequisition, StockReservation, Warehouse } from "@/types";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  emptyRequisitionForm,
  type RequisitionItemDraft,
  type RequisitionPrefill,
} from "./requisitionForm";

/** Loosely-typed sales order (`sales/orderAcknowledgements` records vary in shape). */
interface SalesOrderLike {
  id: string;
  soNumber?: string;
  orderNumber?: string;
  status?: string;
  createdAt?: number;
  items?: unknown[];
  lineItems?: unknown[];
}

const soNumber = (o: SalesOrderLike) => o.soNumber || o.orderNumber || o.id;

/** A requisition in one of these states no longer covers the shortage. */
const CLOSED_PR_STATUSES = new Set(["REJECTED", "CANCELLED"]);

/**
 * Shortage per product = ordered − (available + this order's own active reservations + incoming).
 * The order's reservations are added back because `available` already excludes them — otherwise
 * stock held for this very order would be counted as missing.
 */
async function computeShortage(
  order: SalesOrderLike,
  warehouseId: string,
  products: SellableProduct[],
): Promise<RequisitionItemDraft[]> {
  const [balances, reservations] = await Promise.all([
    getStockBalances(),
    getAllRecords(INVENTORY_PATHS.reservations) as Promise<StockReservation[]>,
  ]);
  const ordered = new Map<string, { qty: number; unitPrice: number }>();
  for (const it of order.items || order.lineItems || []) {
    const productCode = readAny(it, ["productCode", "sku", "itemCode"]);
    const qty =
      Number(readAny<number>(it, ["quantity", "qty", "orderQty"], 0)) || 0;
    if (!productCode || qty <= 0) continue;
    const prev = ordered.get(productCode);
    ordered.set(productCode, {
      qty: (prev?.qty || 0) + qty,
      unitPrice:
        prev?.unitPrice ||
        Number(readAny<number>(it, ["unitPrice", "rate"], 0)) ||
        0,
    });
  }

  const out: RequisitionItemDraft[] = [];
  for (const [productCode, { qty, unitPrice }] of ordered) {
    const balance = balances.find(
      (b) => b.productCode === productCode && b.warehouseId === warehouseId,
    );
    const available = balance
      ? (balance.available ?? balance.onHand - (balance.reserved || 0))
      : 0;
    const ownReserved = reservations
      .filter(
        (r) =>
          r.status === "ACTIVE" &&
          r.salesOrderId === order.id &&
          r.productCode === productCode &&
          r.warehouseId === warehouseId,
      )
      .reduce((s, r) => s + (r.quantity || 0), 0);
    const incoming = balance?.incoming || 0;
    const covered = Math.max(0, available) + ownReserved + incoming;
    const shortage = Math.max(0, qty - covered);
    if (shortage <= 0) continue;
    const product = products.find((p) => p.productCode === productCode);
    out.push({
      productCode,
      quantity: String(shortage),
      estimatedUnitCost: String(product?.unitPrice || unitPrice || 0),
      requiredDate: "",
      notes: `Shortage for ${soNumber(order)} (ordered ${qty}, available ${Math.max(0, available)}, reserved for this order ${ownReserved}, incoming ${incoming})`,
    });
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  products: SellableProduct[];
  onShortage: (prefill: RequisitionPrefill) => void;
}

export default function ShortageRequisitionDialog({
  open,
  onOpenChange,
  warehouses,
  products,
  onShortage,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [openSalesOrders, setOpenSalesOrders] = useState<SalesOrderLike[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");

  useEffect(() => {
    if (!open) return;
    setWarehouseId(warehouses[0]?.id || "");
    setSalesOrderId("");
    setLoading(true);
    (async () => {
      try {
        const orders = (await getAllRecords(
          SCM_CROSS_MODULE_PATHS.salesOrders,
        )) as SalesOrderLike[];
        setOpenSalesOrders(
          orders
            .filter((o) => OPEN_SO_STATUSES.has(o.status || ""))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        );
      } catch (err: unknown) {
        toast.error(errorMessage(err, "Failed to load sales orders"));
      } finally {
        setLoading(false);
      }
    })();
    // Reload only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleContinue = async () => {
    const order = openSalesOrders.find((o) => o.id === salesOrderId);
    if (!order) {
      toast.error("Select a sales order");
      return;
    }
    if (!warehouseId) {
      toast.error("Select a warehouse to check availability against");
      return;
    }

    setLoading(true);
    try {
      const requisitions = (await getAllRecords(
        PROCUREMENT_PATHS.requisitions,
      )) as PurchaseRequisition[];
      const existing = requisitions.find(
        (r) =>
          r.sourceSalesOrderId === order.id &&
          !CLOSED_PR_STATUSES.has(r.status),
      );
      if (existing) {
        toast.error(
          `Requisition ${existing.requisitionNumber} already covers ${soNumber(order)}`,
        );
        return;
      }

      const items = await computeShortage(order, warehouseId, products);
      if (items.length === 0) {
        toast.success(
          "No shortage found — available, reserved and incoming stock covers this sales order at the selected warehouse.",
        );
        onOpenChange(false);
        return;
      }
      onShortage({
        form: {
          ...emptyRequisitionForm(warehouseId),
          priority: "High",
          purpose: `Shortage cover for sales order ${soNumber(order)}`,
        },
        items,
        sourceSalesOrder: { id: order.id, number: soNumber(order) },
      });
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to compute shortage"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Create Requisition from Sales Order Shortage
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Shortage is the ordered quantity minus available stock, stock
            already reserved for this order and incoming stock at the selected
            warehouse — no reservation or sales order status change is made
            here.
          </p>
          <div className="space-y-1.5">
            <Label>Warehouse *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sales Order *</Label>
            <Select value={salesOrderId} onValueChange={setSalesOrderId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loading ? "Loading..." : "Select an open sales order"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {openSalesOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {soNumber(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {openSalesOrders.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">
                No open sales orders found.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={loading || !salesOrderId}>
            {loading ? "Checking..." : "Check Shortage & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
