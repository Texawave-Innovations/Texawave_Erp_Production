import {
  createRecord,
  updateRecord,
  getRecordById,
  getRecordsWhere,
} from "@/services/firebase";
import { INVENTORY_PATHS, settingsKey } from "../inventory/inventoryPaths";
import {
  getStockBalance,
  postLedgerEntry,
  postOnce,
} from "../inventory/stockLedgerService";
import { ORDER_PATHS } from "./orderPaths";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import type {
  FulfillmentStatus,
  InventorySettings,
  OrderAcknowledgement,
  OrderFulfillment,
  OrderFulfillmentItem,
  PickItem,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  WarehousePacking,
  WarehousePicking,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { toLocalDateKey } from "@/modules/scm/shared/format";
import { withActionLock } from "@/modules/scm/shared/actionLock";
import {
  IN_PROGRESS_STATUSES,
  PRE_RESERVE_STATUSES,
  isOpenRequisition,
  loadByIds,
  loadFulfillment,
  loadSalesOrder,
} from "./fulfillmentStore";
import { normalizeFulfillment } from "./orderHelpers";
import { settleReservations } from "./fulfillmentReservations";

export { isOpenRequisition } from "./fulfillmentStore";
export {
  reserveFulfillmentStock,
  releaseFulfillmentReservations,
  shrinkFulfillmentReservation,
} from "./fulfillmentReservations";
export {
  updateSalesOrderShippedStatus,
  updateFulfillmentDeliveryStatus,
} from "./fulfillmentShippingStatus";

/** Quantity of a fulfillment item that still counts against its sales-order line: a finished
 * fulfillment only consumes what it actually issued, so a short-picked remainder can be fulfilled
 * again; an open one consumes everything it was created for. */
function consumedQty(f: OrderFulfillment, item: OrderFulfillmentItem): number {
  return f.status === "FULFILLED" ? item.issuedQty || 0 : item.orderedQty || 0;
}

/** Remaining (not yet claimed) quantity per sales-order line index, after every other
 * non-cancelled fulfillment of the order. Items created before `soLineIndex` existed are matched
 * to the first lines with the same item code. Pure — used by the service and the dashboard. */
export function computeRemainingByLine(
  order: OrderAcknowledgement,
  fulfillments: OrderFulfillment[],
  excludeFulfillmentId?: string,
): Map<number, number> {
  const lines = order.lineItems || [];
  const remaining = new Map<number, number>();
  lines.forEach((li, idx) => {
    if (li.itemCode && li.salesQty > 0) remaining.set(idx, li.salesQty);
  });

  const relevant = fulfillments.filter(
    (f) =>
      f.salesOrderId === order.id &&
      f.status !== "CANCELLED" &&
      f.id !== excludeFulfillmentId,
  );
  for (const f of relevant) {
    for (const item of f.items || []) {
      let qty = consumedQty(f, item);
      if (item.soLineIndex != null && remaining.has(item.soLineIndex)) {
        remaining.set(
          item.soLineIndex,
          (remaining.get(item.soLineIndex) || 0) - qty,
        );
        continue;
      }
      for (const [idx, left] of remaining) {
        if (qty <= 0) break;
        if (lines[idx].itemCode !== item.itemCode || left <= 0) continue;
        const take = Math.min(left, qty);
        remaining.set(idx, left - take);
        qty -= take;
      }
    }
  }
  for (const [idx, left] of remaining) remaining.set(idx, Math.max(0, left));
  return remaining;
}

/** Fresh remaining quantity per sales-order line index. Throws on read failure — a failed read
 * must never look like "nothing fulfilled yet". */
async function getRemainingQuantities(
  order: OrderAcknowledgement,
  excludeFulfillmentId?: string,
): Promise<Map<number, number>> {
  const fulfillments = (
    await getRecordsWhere<OrderFulfillment>(
      ORDER_PATHS.fulfillments,
      "salesOrderId",
      order.id,
    )
  ).map(normalizeFulfillment);
  return computeRemainingByLine(order, fulfillments, excludeFulfillmentId);
}

interface StockCheckLine {
  lineIndex: number;
  itemCode: string;
  itemDescription: string;
  uom: string;
  remainingQty: number;
  onHand: number;
  reserved: number;
  available: number;
  fulfillableQty: number;
  shortageQty: number;
}

/** Read-only stock availability check for a sales order against one warehouse. */
async function checkStockAvailability(
  order: OrderAcknowledgement,
  warehouseId: string,
): Promise<StockCheckLine[]> {
  const remaining = await getRemainingQuantities(order);
  const lines: StockCheckLine[] = [];
  const lineItems = order.lineItems || [];
  for (const [lineIndex, remainingQty] of remaining) {
    if (remainingQty <= 0) continue;
    const li = lineItems[lineIndex];
    const balance = await getStockBalance(li.itemCode, warehouseId);
    const onHand = balance?.onHand || 0;
    const reserved = balance?.reserved || 0;
    const available = Math.max(0, onHand - reserved);
    const fulfillableQty = Math.min(remainingQty, available);
    lines.push({
      lineIndex,
      itemCode: li.itemCode,
      itemDescription: li.itemDescription || li.itemCode,
      uom: li.uom,
      remainingQty,
      onHand,
      reserved,
      available,
      fulfillableQty,
      shortageQty: Math.max(0, remainingQty - fulfillableQty),
    });
  }
  return lines;
}

/** Availability for one product across every given warehouse, for the warehouse-selection UI. */
export async function checkAvailabilityByWarehouse(
  itemCode: string,
  warehouseIds: string[],
) {
  return Promise.all(
    warehouseIds.map(async (warehouseId) => {
      const balance = await getStockBalance(itemCode, warehouseId);
      const onHand = balance?.onHand || 0;
      const reserved = balance?.reserved || 0;
      return {
        warehouseId,
        onHand,
        reserved,
        available: Math.max(0, onHand - reserved),
      };
    }),
  );
}

/** Creates a fulfillment covering whatever is still unclaimed on the sales order (so a second
 * fulfillment only ever covers the remainder). Serialized per sales order and re-computed from
 * fresh data inside the lock, so two tabs can't both claim the same quantity. */
export async function createFulfillment(
  orderId: string,
  warehouseId: string,
  performedBy: string,
): Promise<string> {
  return withActionLock(`fulfillment-create:${orderId}`, async () => {
    const order = await loadSalesOrder(orderId);
    const lines = await checkStockAvailability(order, warehouseId);
    if (lines.length === 0)
      throw new Error("This sales order has no remaining quantity to fulfill.");

    const items: OrderFulfillmentItem[] = lines.map((l) => ({
      itemCode: l.itemCode,
      itemDescription: l.itemDescription,
      uom: l.uom,
      orderedQty: l.remainingQty,
      reservedQty: 0,
      issuedQty: 0,
      soLineIndex: l.lineIndex,
    }));

    const fulfillmentNumber = await reserveDocumentNumber("fulfillment");
    const id = await createRecord(ORDER_PATHS.fulfillments, {
      fulfillmentNumber,
      salesOrderId: order.id,
      salesOrderNumberSnapshot: order.soNumber,
      customerId: order.customerId,
      customerNameSnapshot: order.customerName,
      warehouseId,
      status: lines.every((l) => l.shortageQty === 0)
        ? "AVAILABLE"
        : "PARTIALLY_AVAILABLE",
      items,
      reservationIds: [],
      pickingIds: [],
      packingIds: [],
      stockIssueLedgerEntryIds: [],
      createdBy: performedBy,
      createdAt: Date.now(),
    } satisfies Omit<OrderFulfillment, "id">);

    if (id)
      await logRecordAudit(
        ORDER_PATHS.fulfillments,
        id,
        "Fulfillment created",
        performedBy,
        `${fulfillmentNumber} for ${order.soNumber}`,
      );
    return id as string;
  });
}

/** Moves each still-ACTIVE reservation to `toStatus` (atomically, so two callers can never both
 * release the same one) and gives its quantity back to `reserved` on the balance. */
/** Raises a purchase requisition for the shortage on a fulfillment (ordered − reserved per item).
 * Refuses while an open requisition already covers this fulfillment; serialized per fulfillment. */
export async function createShortageRequisition(
  fulfillmentId: string,
  performedBy: string,
): Promise<string> {
  return withActionLock(`fulfillment-pr:${fulfillmentId}`, async () => {
    const fulfillment = await loadFulfillment(fulfillmentId);
    if (
      fulfillment.status === "CANCELLED" ||
      fulfillment.status === "FULFILLED"
    )
      throw new Error("This fulfillment is closed.");
    const existing = await getRecordsWhere<PurchaseRequisition>(
      PROCUREMENT_PATHS.requisitions,
      "fulfillmentId",
      fulfillmentId,
    );
    const open = existing.find(isOpenRequisition);
    if (open)
      throw new Error(
        `Requisition ${open.requisitionNumber} already covers this shortage.`,
      );

    const shortageItems = fulfillment.items.filter(
      (i) => i.orderedQty - i.reservedQty > 0,
    );
    if (shortageItems.length === 0)
      throw new Error("No shortage to raise a requisition for.");

    const settings = await Promise.all(
      shortageItems.map(
        (i) =>
          getRecordById(
            INVENTORY_PATHS.settings,
            settingsKey(i.itemCode),
          ) as Promise<InventorySettings | null>,
      ),
    );
    const items: PurchaseRequisitionItem[] = shortageItems.map((i, idx) => {
      const qty = i.orderedQty - i.reservedQty;
      const estimatedUnitCost = settings[idx]?.costPrice || 0;
      return {
        productCode: i.itemCode,
        productName: i.itemDescription,
        uom: i.uom,
        quantity: qty,
        estimatedUnitCost,
        estimatedTotal: Math.round(qty * estimatedUnitCost * 100) / 100,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.estimatedTotal, 0);

    const requisitionNumber = await reserveDocumentNumber(
      "purchaseRequisition",
    );
    const id = (await createRecord(PROCUREMENT_PATHS.requisitions, {
      requisitionNumber,
      requestedBy: performedBy,
      requestDate: toLocalDateKey(),
      priority: "Normal",
      warehouseId: fulfillment.warehouseId,
      purpose: `Shortage cover for sales order ${fulfillment.salesOrderNumberSnapshot}`,
      items,
      subtotal,
      tax: 0,
      total: subtotal,
      status: "DRAFT",
      sourceSalesOrderId: fulfillment.salesOrderId,
      sourceSalesOrderNumber: fulfillment.salesOrderNumberSnapshot,
      fulfillmentId: fulfillment.id,
      createdBy: performedBy,
      createdAt: Date.now(),
    } satisfies Omit<PurchaseRequisition, "id">)) as string;

    await updateRecord(ORDER_PATHS.fulfillments, fulfillment.id, {
      requisitionIds: [...(fulfillment.requisitionIds || []), id],
    });
    await logRecordAudit(
      ORDER_PATHS.fulfillments,
      fulfillment.id,
      "Shortage requisition created",
      performedBy,
      requisitionNumber,
    );
    return id;
  });
}

/** Creates the pick list for a reserved fulfillment. The only way a pick list is created — the
 * picking workspace executes it. The RESERVED → PICKING gate runs first, so a double click or a
 * second tab can never create two pick lists. */
export async function createPickForFulfillment(
  fulfillmentId: string,
  performedBy: string,
): Promise<string> {
  const fulfillment = await loadFulfillment(fulfillmentId);
  const items: PickItem[] = fulfillment.items
    .filter((i) => i.reservedQty > 0)
    .map((i) => ({
      productCode: i.itemCode,
      productName: i.itemDescription,
      requestedQuantity: i.reservedQty,
      pickedQuantity: 0,
    }));
  if (items.length === 0) throw new Error("Nothing reserved to pick.");

  await transitionStatus<FulfillmentStatus>(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    ["RESERVED"],
    "PICKING",
  );
  try {
    const pickNumber = await reserveDocumentNumber("pick");
    const id = (await createRecord(WAREHOUSE_PATHS.pickings, {
      pickNumber,
      salesOrderId: fulfillment.salesOrderId,
      salesOrderNumber: fulfillment.salesOrderNumberSnapshot,
      fulfillmentId,
      warehouseId: fulfillment.warehouseId,
      priority: "Normal",
      items,
      status: "PENDING",
      createdBy: performedBy,
      createdAt: Date.now(),
    } satisfies Omit<WarehousePicking, "id">)) as string;
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
      pickingIds: [...fulfillment.pickingIds, id],
    });
    await logRecordAudit(
      WAREHOUSE_PATHS.pickings,
      id,
      "Pick list created",
      performedBy,
      `${pickNumber} for ${fulfillment.fulfillmentNumber}`,
    );
    await logRecordAudit(
      ORDER_PATHS.fulfillments,
      fulfillmentId,
      "Pick list created",
      performedBy,
      pickNumber,
    );
    return id;
  } catch (err) {
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
      status: "RESERVED",
    }).catch(() => undefined);
    throw err;
  }
}

function nextProgressStatus(
  picks: WarehousePicking[],
  packs: WarehousePacking[],
): FulfillmentStatus {
  if (picks.length === 0) return "RESERVED";
  if (packs.length === 0) return "PICKING";
  const allPicked = picks.every((p) => p.status === "COMPLETED");
  const allPacked = packs.every((p) => p.status === "PACKED");
  return allPicked && allPacked ? "READY_TO_SHIP" : "PACKING";
}

/**
 * Recomputes an in-progress fulfillment's status and pick/pack id lists from its live (non-
 * cancelled) pick and pack documents. Called whenever a pick or pack linked to it is created,
 * completed or cancelled, so a cancelled pick/pack never leaves the fulfillment stuck. Never
 * touches a cancelled or fulfilled fulfillment.
 */
export async function syncFulfillmentProgress(
  fulfillmentId: string,
  opts: { addPackingId?: string } = {},
): Promise<void> {
  const f = await loadFulfillment(fulfillmentId);
  if (!IN_PROGRESS_STATUSES.includes(f.status)) return;
  const packingIds =
    opts.addPackingId && !f.packingIds.includes(opts.addPackingId)
      ? [...f.packingIds, opts.addPackingId]
      : f.packingIds;
  const [picks, packs] = await Promise.all([
    loadByIds<WarehousePicking>(WAREHOUSE_PATHS.pickings, f.pickingIds),
    loadByIds<WarehousePacking>(WAREHOUSE_PATHS.packings, packingIds),
  ]);
  const livePicks = picks.filter((p) => p.status !== "CANCELLED");
  const livePacks = packs.filter((p) => p.status !== "CANCELLED");
  const extra = {
    pickingIds: livePicks.map((p) => p.id),
    packingIds: livePacks.map((p) => p.id),
  };
  const next = nextProgressStatus(livePicks, livePacks);
  if (next === f.status) {
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, extra);
  } else {
    await transitionStatus<FulfillmentStatus>(
      ORDER_PATHS.fulfillments,
      fulfillmentId,
      [f.status],
      next,
      extra,
    );
  }
}

/** Links a packing to its fulfillment and rolls the fulfillment's status forward from its live
 * picks/packs. Only ever advances an in-progress fulfillment — never revives a cancelled one. */
export async function linkPackingToFulfillment(
  fulfillmentId: string,
  packingId: string,
  packed: boolean,
  performedBy: string,
): Promise<void> {
  await syncFulfillmentProgress(fulfillmentId, { addPackingId: packingId });
  await logRecordAudit(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    packed ? "Packing completed" : "Packing started",
    performedBy,
    packingId,
  );
}

/** Per-product quantity that can be issued: what was both picked and packed. */
function issuableByProduct(
  picks: WarehousePicking[],
  packs: WarehousePacking[],
): Map<string, number> {
  const picked = new Map<string, number>();
  for (const p of picks)
    for (const it of p.items)
      picked.set(
        it.productCode,
        (picked.get(it.productCode) || 0) + (it.pickedQuantity || 0),
      );
  const packed = new Map<string, number>();
  for (const p of packs)
    for (const pkg of p.packages || [])
      for (const it of pkg.items || [])
        packed.set(
          it.productCode,
          (packed.get(it.productCode) || 0) + (it.quantity || 0),
        );
  const out = new Map<string, number>();
  for (const [code, qty] of picked)
    out.set(code, Math.min(qty, packed.get(code) || 0));
  return out;
}

/**
 * The one place a fulfillment reduces on-hand stock. Issues what was actually picked and packed
 * (never more than reserved) as one `SALES_ISSUE` per line, each guarded by `postOnce` on
 * `${fulfillmentId}:${line}` so a retry after a partial failure resumes where it stopped and a
 * double click can never double-post. Only after every line is posted are the reservations
 * settled (issued and un-issued remainder alike) and the fulfillment moved to FULFILLED.
 */
export async function finalizeFulfillment(
  fulfillmentId: string,
  performedBy: string,
): Promise<void> {
  const f = await loadFulfillment(fulfillmentId);
  if (f.status === "FULFILLED") return;
  if (!IN_PROGRESS_STATUSES.includes(f.status))
    throw new Error(`Cannot finalize a fulfillment in status ${f.status}.`);
  if (f.reservationIds.length === 0)
    throw new Error("Nothing has been reserved for this fulfillment yet.");

  const [picks, packs] = await Promise.all([
    loadByIds<WarehousePicking>(WAREHOUSE_PATHS.pickings, f.pickingIds),
    loadByIds<WarehousePacking>(WAREHOUSE_PATHS.packings, f.packingIds),
  ]);
  const livePicks = picks.filter((p) => p.status !== "CANCELLED");
  const livePacks = packs.filter((p) => p.status !== "CANCELLED");
  if (livePicks.length === 0 || livePicks.some((p) => p.status !== "COMPLETED"))
    throw new Error("Every pick list must be completed first.");
  if (livePacks.length === 0 || livePacks.some((p) => p.status !== "PACKED"))
    throw new Error("Every packing must be packed first.");

  const issuable = issuableByProduct(livePicks, livePacks);
  const items: OrderFulfillmentItem[] = [];
  const ledgerEntryIds: string[] = [];
  for (let idx = 0; idx < f.items.length; idx++) {
    const item = f.items[idx];
    const left = issuable.get(item.itemCode) || 0;
    const issueQty = Math.min(item.reservedQty, left);
    issuable.set(item.itemCode, left - issueQty);
    if (issueQty <= 0) {
      items.push({ ...item, issuedQty: 0 });
      continue;
    }

    const { result } = await postOnce(
      "FULFILLMENT_ISSUE",
      `${fulfillmentId}:${idx}`,
      async () => {
        const settings = (await getRecordById(
          INVENTORY_PATHS.settings,
          settingsKey(item.itemCode),
        )) as InventorySettings | null;
        return postLedgerEntry({
          productCode: item.itemCode,
          productName: item.itemDescription,
          warehouseId: f.warehouseId,
          transactionType: "SALES_ISSUE",
          referenceType: "fulfillment",
          referenceId: fulfillmentId,
          referenceNumber: f.fulfillmentNumber,
          quantityOut: issueQty,
          unitCost: settings?.costPrice,
          createdBy: performedBy,
        });
      },
    );
    if (result) {
      ledgerEntryIds.push(result);
      // Recorded as each line posts so a cancel attempt mid-finalize sees stock has left.
      await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
        stockIssueLedgerEntryIds: ledgerEntryIds,
      });
    }
    items.push({ ...item, issuedQty: issueQty });
  }
  if (ledgerEntryIds.length === 0)
    throw new Error("Nothing was picked and packed to issue.");

  await settleReservations(f.reservationIds, "FULFILLED", performedBy);
  await transitionStatus<FulfillmentStatus>(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    IN_PROGRESS_STATUSES,
    "FULFILLED",
    {
      items,
      stockIssueLedgerEntryIds: ledgerEntryIds,
      deliveryStatus: "NOT_DELIVERED",
    },
  );
  const issuedAt = Date.now();
  await Promise.all(
    livePicks.map((p) =>
      updateRecord(WAREHOUSE_PATHS.pickings, p.id, { stockIssuedAt: issuedAt }),
    ),
  );
  await logRecordAudit(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    "Stock issued (SALES_ISSUE)",
    performedBy,
    items.map((i) => `${i.itemCode}: ${i.issuedQty}`).join(", "),
  );
}

/** Cancels a fulfillment before stock is issued: cancels its open pick lists and packings and
 * releases its reservations. Refused while a pick or pack is actively being worked. Re-running it
 * on an already-cancelled fulfillment finishes any cleanup a previous attempt left behind. */
export async function cancelFulfillment(
  fulfillmentId: string,
  performedBy: string,
  reason: string,
): Promise<void> {
  const f = await loadFulfillment(fulfillmentId);
  if (f.status === "FULFILLED" || f.stockIssueLedgerEntryIds.length > 0) {
    throw new Error(
      "Stock has already been issued for this fulfillment. Cancellation after issue requires a returns/reversal workflow.",
    );
  }
  const [picks, packs] = await Promise.all([
    loadByIds<WarehousePicking>(WAREHOUSE_PATHS.pickings, f.pickingIds),
    loadByIds<WarehousePacking>(WAREHOUSE_PATHS.packings, f.packingIds),
  ]);
  const livePicks = picks.filter((p) => p.status !== "CANCELLED");
  const livePacks = packs.filter((p) => p.status !== "CANCELLED");
  if (
    livePicks.some(
      (p) => p.status === "IN_PROGRESS" || p.status === "PARTIALLY_PICKED",
    ) ||
    livePacks.some((p) => p.status === "IN_PROGRESS")
  ) {
    throw new Error(
      "Picking or packing is in progress — finish or cancel it in the warehouse workspace first.",
    );
  }

  if (f.status !== "CANCELLED") {
    await transitionStatus<FulfillmentStatus>(
      ORDER_PATHS.fulfillments,
      fulfillmentId,
      [...PRE_RESERVE_STATUSES, ...IN_PROGRESS_STATUSES, "ON_HOLD"],
      "CANCELLED",
      {
        cancelledBy: performedBy,
        cancelledAt: Date.now(),
        cancellationReason: reason,
      },
    );
  }
  for (const p of livePicks)
    await updateRecord(WAREHOUSE_PATHS.pickings, p.id, { status: "CANCELLED" });
  for (const p of livePacks)
    await updateRecord(WAREHOUSE_PATHS.packings, p.id, { status: "CANCELLED" });
  await settleReservations(f.reservationIds, "RELEASED", performedBy);
  await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
    items: f.items.map((i) => ({ ...i, reservedQty: 0 })),
    reservationIds: null,
  });
  await logRecordAudit(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    "Fulfillment cancelled",
    performedBy,
    reason,
  );
}
