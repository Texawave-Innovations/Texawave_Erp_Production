import {
  createRecord,
  updateRecord,
  getRecordById,
  database,
  ref,
  runTransaction,
} from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import {
  getStockBalance,
  applyReservationDelta,
} from "../inventory/stockLedgerService";
import { ORDER_PATHS } from "./orderPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import type {
  FulfillmentStatus,
  OrderFulfillmentItem,
  StockReservation,
  WarehousePicking,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  PRE_RESERVE_STATUSES,
  loadByIds,
  loadFulfillment,
} from "./fulfillmentStore";

export async function settleReservations(
  reservationIds: string[],
  toStatus: "RELEASED" | "FULFILLED",
  performedBy: string,
): Promise<void> {
  for (const resId of reservationIds) {
    const res = (await getRecordById(
      INVENTORY_PATHS.reservations,
      resId,
    )) as StockReservation | null;
    if (!res || res.status !== "ACTIVE") continue;
    try {
      await transitionStatus(
        INVENTORY_PATHS.reservations,
        resId,
        ["ACTIVE"],
        toStatus,
        { releasedBy: performedBy, releasedAt: Date.now() },
      );
    } catch {
      continue; // settled concurrently by another caller
    }
    await applyReservationDelta(
      res.productCode,
      res.warehouseId,
      -res.quantity,
    );
  }
}

/** Reserves whatever is currently available for each line via the Phase 3 reservation engine.
 * Supports partial reservation. The status gate runs first (so a double click or second tab is
 * rejected), each reservation id is written onto the fulfillment as soon as it exists, and if a
 * later line fails every reservation made in this run is released again. */
export async function reserveFulfillmentStock(
  fulfillmentId: string,
  performedBy: string,
): Promise<void> {
  const fresh = await loadFulfillment(fulfillmentId);
  if (fresh.reservationIds.length > 0)
    throw new Error("Stock has already been reserved for this fulfillment.");
  const previous = await transitionStatus<FulfillmentStatus>(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    PRE_RESERVE_STATUSES,
    "RESERVED",
  );

  const reservationIds: string[] = [];
  const items: OrderFulfillmentItem[] = fresh.items.map((i) => ({
    ...i,
    reservedQty: 0,
  }));
  try {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const balance = await getStockBalance(item.itemCode, fresh.warehouseId);
      const toReserve = Math.min(
        item.orderedQty,
        Math.max(0, (balance?.onHand || 0) - (balance?.reserved || 0)),
      );
      if (toReserve <= 0) continue;

      await applyReservationDelta(item.itemCode, fresh.warehouseId, toReserve);
      let resId: string | null = null;
      try {
        resId = await createRecord(INVENTORY_PATHS.reservations, {
          productCode: item.itemCode,
          productName: item.itemDescription,
          warehouseId: fresh.warehouseId,
          salesOrderId: fresh.salesOrderId,
          salesOrderNumber: fresh.salesOrderNumberSnapshot,
          fulfillmentId,
          quantity: toReserve,
          status: "ACTIVE",
          createdBy: performedBy,
          createdAt: Date.now(),
        } satisfies Omit<StockReservation, "id">);
      } catch (err) {
        await applyReservationDelta(
          item.itemCode,
          fresh.warehouseId,
          -toReserve,
        ).catch(() => undefined);
        throw err;
      }
      reservationIds.push(resId as string);
      items[idx] = { ...item, reservedQty: toReserve };
      await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
        items,
        reservationIds,
      });
    }
  } catch (err) {
    await settleReservations(reservationIds, "RELEASED", performedBy).catch(
      () => undefined,
    );
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
      items: fresh.items.map((i) => ({ ...i, reservedQty: 0 })),
      reservationIds: null,
      status: previous,
    }).catch(() => undefined);
    throw err;
  }

  if (reservationIds.length === 0) {
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
      status: previous,
    });
    throw new Error(
      "No stock is currently available to reserve for this fulfillment.",
    );
  }
  await logRecordAudit(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    "Stock reserved",
    performedBy,
    items
      .map((i) => `${i.itemCode}: ${i.reservedQty}/${i.orderedQty}`)
      .join(", "),
  );
}

/** Releases every active reservation on a reserved fulfillment that has no live pick list yet,
 * and clears `reservationIds` so stock can be reserved again later. */
export async function releaseFulfillmentReservations(
  fulfillmentId: string,
  performedBy: string,
  nextStatus: "AVAILABLE" | "PARTIALLY_AVAILABLE",
): Promise<void> {
  const f = await loadFulfillment(fulfillmentId);
  if (f.stockIssueLedgerEntryIds.length > 0) {
    throw new Error(
      "Stock has already been issued for this fulfillment; reservations cannot be released.",
    );
  }
  const livePicks = (
    await loadByIds<WarehousePicking>(WAREHOUSE_PATHS.pickings, f.pickingIds)
  ).filter((p) => p.status !== "CANCELLED");
  if (livePicks.length > 0)
    throw new Error("Cancel the pick list before releasing the reservation.");

  await transitionStatus<FulfillmentStatus>(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    ["RESERVED"],
    nextStatus,
  );
  await settleReservations(f.reservationIds, "RELEASED", performedBy);
  await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, {
    items: f.items.map((i) => ({ ...i, reservedQty: 0 })),
    reservationIds: null,
  });
  await logRecordAudit(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
    "Reservations released",
    performedBy,
    f.fulfillmentNumber,
  );
}

/**
 * Shrinks a fulfillment's reservation of `productCode` by up to `quantity` — used when stock
 * reserved for the fulfillment is pulled out of sellable stock (e.g. failed pre-dispatch QC). The
 * reservation records, the fulfillment line's `reservedQty` and the stock balance's `reserved`
 * all move together, so a later release/finalize never releases the same units twice.
 * Returns the quantity actually unreserved.
 */
export async function shrinkFulfillmentReservation(
  fulfillmentId: string,
  productCode: string,
  quantity: number,
  performedBy: string,
): Promise<number> {
  const f = await loadFulfillment(fulfillmentId);
  let remaining = quantity;
  for (const resId of f.reservationIds) {
    if (remaining <= 0) break;
    let taken = 0;
    const result = await runTransaction(
      ref(database, `${INVENTORY_PATHS.reservations}/${resId}`),
      (current: StockReservation | null) => {
        taken = 0;
        if (current === null) return null;
        if (current.status !== "ACTIVE" || current.productCode !== productCode)
          return; // abort
        taken = Math.min(remaining, current.quantity);
        const left = current.quantity - taken;
        return left > 0
          ? { ...current, quantity: left }
          : {
              ...current,
              quantity: 0,
              status: "RELEASED",
              releasedBy: performedBy,
              releasedAt: Date.now(),
            };
      },
    );
    if (!result.committed || taken <= 0) continue;
    await applyReservationDelta(productCode, f.warehouseId, -taken);
    remaining -= taken;
  }

  const unreserved = quantity - remaining;
  if (unreserved > 0) {
    let left = unreserved;
    const items: OrderFulfillmentItem[] = f.items.map((i) => {
      if (i.itemCode !== productCode || left <= 0) return i;
      const take = Math.min(left, i.reservedQty);
      left -= take;
      return { ...i, reservedQty: i.reservedQty - take };
    });
    await updateRecord(ORDER_PATHS.fulfillments, fulfillmentId, { items });
    await logRecordAudit(
      ORDER_PATHS.fulfillments,
      fulfillmentId,
      "Reservation reduced",
      performedBy,
      `${productCode}: ${unreserved} unit(s) removed from sellable stock`,
    );
  }
  return unreserved;
}
