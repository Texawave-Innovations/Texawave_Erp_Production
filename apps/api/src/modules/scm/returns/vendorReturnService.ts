import { update } from "firebase/database";
import {
  createRecord,
  database,
  getRecordById,
  ref,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { INVENTORY_PATHS, batchKey } from "../inventory/inventoryPaths";
import {
  adjustBatchQuantity,
  loadAndValidateBatch,
  loadAndValidateSerials,
  makeLineId,
  postStockMovement,
  setSerialStatuses,
} from "../inventory/batchSerialService";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { RETURNS_PATHS } from "./returnsPaths";
import { RETURNABLE_GRN_STATUSES, returnScopeKey } from "./returnHelpers";
import {
  appendReturnLedgerIds,
  createWithReservations,
  getFreshReturn,
  loadSavedReturnLines,
  releaseReturnLines,
  requireStatus,
  reserveReturnLine,
  transitionReturn,
} from "./returnsMasterService";
import type {
  GoodsReceipt,
  ReturnReasonCode,
  ScmReturn,
  ScmReturnItem,
  ScmReturnShipmentInfo,
  StockBatch,
} from "@/types";

export interface VendorReturnItemInput {
  /** Index of the source line in `grn.items`. */
  grnLineIndex: number;
  requestedQuantity: number;
  /** Required for serial-tracked lines: exactly `requestedQuantity` serials from the GRN line. */
  serialNumbers?: string[];
  notes?: string;
}

export interface CreateVendorReturnInput {
  grnId: string;
  reasonCode: ReturnReasonCode;
  reasonDescription?: string;
  items: VendorReturnItemInput[];
  notes?: string;
}

/** Creates a vendor return at REQUESTED. Eligibility is recomputed from the GRN's accepted
 *  quantity (per product + batch) and every other open return. */
export async function createVendorReturn(
  input: CreateVendorReturnInput,
  performedBy: string,
): Promise<string> {
  if (input.items.length === 0)
    throw new Error("Add at least one item to return.");
  if (
    new Set(input.items.map((i) => i.grnLineIndex)).size !== input.items.length
  )
    throw new Error("Each GRN line may appear only once per return.");
  const grn = (await getRecordById(
    PROCUREMENT_PATHS.grns,
    input.grnId,
  )) as GoodsReceipt | null;
  if (!grn) throw new Error("Source GRN not found.");
  if (!RETURNABLE_GRN_STATUSES.has(grn.status))
    throw new Error("Only received GRNs can be returned against.");

  const items: ScmReturnItem[] = [];
  const reservations: Array<{ scopeKey: string; lineId: string }> = [];
  try {
    for (const it of input.items) {
      const line = grn.items?.[it.grnLineIndex];
      if (!line) throw new Error("GRN line not found. Refresh and try again.");
      if (!(it.requestedQuantity > 0))
        throw new Error(
          `Requested quantity for ${line.productCode} must be greater than zero.`,
        );
      const serialNumbers =
        it.serialNumbers && it.serialNumbers.length > 0
          ? it.serialNumbers
          : undefined;
      if (line.serialNumbers && line.serialNumbers.length > 0) {
        if (!serialNumbers || serialNumbers.length !== it.requestedQuantity) {
          throw new Error(
            `${line.productCode}: select exactly ${it.requestedQuantity} serial number(s) to return.`,
          );
        }
        const bad = serialNumbers.find(
          (sn) => !line.serialNumbers?.includes(sn),
        );
        if (bad)
          throw new Error(
            `Serial ${bad} was not received on ${grn.grnNumber}.`,
          );
      }
      const sourceQuantity = grn.items
        .filter(
          (l) =>
            l.productCode === line.productCode &&
            (l.batchNumber || "") === (line.batchNumber || ""),
        )
        .reduce((s, l) => s + (l.acceptedQuantity || 0), 0);
      let batchId: string | undefined;
      if (line.batchNumber) {
        const key = batchKey(
          line.batchNumber,
          line.productCode,
          grn.warehouseId,
        );
        const batch = (await getRecordById(
          INVENTORY_PATHS.batches,
          key,
        )) as StockBatch | null;
        batchId = batch ? key : undefined;
      }
      const lineId = makeLineId();
      const scopeKey = returnScopeKey(
        { returnType: "VENDOR_RETURN", grnId: grn.id },
        {
          productCode: line.productCode,
          batchNumber: line.batchNumber,
          grnId: grn.id,
        },
      );
      const savedLines = await loadSavedReturnLines({
        grnId: grn.id,
        productCode: line.productCode,
        batchNumber: line.batchNumber,
      });
      const previouslyReturnedQuantity = await reserveReturnLine({
        scopeKey,
        lineId,
        quantity: it.requestedQuantity,
        sourceQuantity,
        savedLines,
        productCode: line.productCode,
      });
      reservations.push({ scopeKey, lineId });
      items.push({
        id: lineId,
        productCode: line.productCode,
        productNameSnapshot: line.productName,
        uom: line.uom,
        grnId: grn.id,
        grnNumberSnapshot: grn.grnNumber,
        receivedQuantity: sourceQuantity,
        previouslyReturnedQuantity,
        requestedQuantity: it.requestedQuantity,
        batchId,
        batchNumber: line.batchNumber,
        serialNumbers,
        warehouseId: grn.warehouseId,
        locationId: grn.locationId,
        unitCost: line.unitCost,
        notes: it.notes,
      });
    }
  } catch (err) {
    await releaseReturnLines(reservations);
    throw err;
  }

  let returnNumber = "";
  const id = await createWithReservations(reservations, async () => {
    returnNumber = await reserveDocumentNumber("vendorReturn");
    return createRecord(RETURNS_PATHS.returns, {
      returnNumber,
      returnType: "VENDOR_RETURN",
      purchaseOrderId: grn.purchaseOrderId,
      purchaseOrderNumberSnapshot: grn.purchaseOrderNumber,
      grnId: grn.id,
      grnNumberSnapshot: grn.grnNumber,
      vendorId: grn.vendorId,
      vendorNameSnapshot: grn.vendorNameSnapshot || grn.vendorId,
      warehouseId: grn.warehouseId,
      reasonCode: input.reasonCode,
      reasonDescription: input.reasonDescription,
      items,
      status: "REQUESTED",
      requestedDate: Date.now(),
      ledgerEntryIds: [],
      createdBy: performedBy,
      createdAt: Date.now(),
      notes: input.notes,
    } satisfies Omit<ScmReturn, "id">);
  });

  await logRecordAudit(
    RETURNS_PATHS.returns,
    id,
    "Vendor return created",
    performedBy,
    `${returnNumber} for ${grn.grnNumber}`,
  );
  return id;
}

export async function markVendorReturnReadyToShip(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "READY_TO_SHIP",
    {},
    performedBy,
    "Marked ready to ship",
    ret.returnNumber,
  );
}

/** Posts PURCHASE_RETURN per line (stock physically leaves now), then moves to SHIPPED. Every line
 *  is validated before anything posts; each posted line records its ledger id immediately, so a
 *  partial failure blocks cancellation and a retry skips lines already posted. */
export async function shipVendorReturn(
  retId: string,
  shipmentInfo: ScmReturnShipmentInfo,
  performedBy: string,
): Promise<void> {
  if (!shipmentInfo.carrier?.trim() || !shipmentInfo.trackingNumber?.trim())
    throw new Error(
      "Carrier and tracking number are required to ship a vendor return.",
    );
  const ret = await getFreshReturn(retId);
  requireStatus(ret, "READY_TO_SHIP");

  const toPost = ret.items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item.postedLedgerEntryId);
  const prepared = [];
  for (const { item, idx } of toPost) {
    const quantity = item.requestedQuantity;
    if (item.batchId) {
      const batch = await loadAndValidateBatch(item.batchId, item.productCode);
      if (quantity > (batch.quantity || 0)) {
        throw new Error(
          `Cannot return ${quantity} of ${item.productCode} — batch ${batch.batchNumber} only has ${batch.quantity} on hand.`,
        );
      }
    }
    const serials = await loadAndValidateSerials(
      item.serialNumbers || [],
      item.productCode,
      ["TRANSFERRED", "SOLD"],
    );
    prepared.push({ item, idx, quantity, serials });
  }

  for (const { item, idx, quantity, serials } of prepared) {
    const batchId = item.batchId;
    const ledgerEntryId = await postStockMovement({
      claimType: "VENDOR_RETURN",
      claimId: `${ret.id}:${item.id}`,
      ledger: {
        productCode: item.productCode,
        productName: item.productNameSnapshot,
        warehouseId: item.warehouseId || ret.warehouseId,
        locationId: item.locationId,
        batchId,
        transactionType: "PURCHASE_RETURN",
        referenceType: "VENDOR_RETURN",
        referenceId: `${ret.id}:${item.id}`,
        referenceNumber: ret.returnNumber,
        quantityOut: quantity,
        unitCost: item.unitCost,
        createdBy: performedBy,
      },
      stockRecords: async () => {
        await setSerialStatuses(
          serials,
          "TRANSFERRED",
          ret.returnNumber,
          performedBy,
        );
        if (batchId) {
          const after = await adjustBatchQuantity(batchId, -quantity);
          await logRecordAudit(
            INVENTORY_PATHS.batches,
            batchId,
            "Batch quantity decreased (return to vendor)",
            performedBy,
            `${ret.returnNumber} -${quantity} → ${after}`,
          );
        }
      },
    });
    // 'legacy' marks a line posted under an old claim that recorded no ledger id.
    await update(
      ref(database, `${RETURNS_PATHS.returns}/${ret.id}/items/${idx}`),
      {
        postedLedgerEntryId: ledgerEntryId || "legacy",
        receivedReturnQuantity: quantity,
      },
    );
    await appendReturnLedgerIds(ret.id, [ledgerEntryId]);
  }

  await transitionReturn(
    ret,
    "SHIPPED",
    {
      shippedBy: performedBy,
      shippedDate: Date.now(),
      returnShipment: { ...shipmentInfo, shippedDate: Date.now() },
    },
    performedBy,
    "Return shipped to vendor",
    `${shipmentInfo.carrier} — ${shipmentInfo.trackingNumber}`,
  );
  await notifyAdminFeed(
    "Vendor return shipped",
    `${ret.returnNumber} shipped to ${ret.vendorNameSnapshot || "vendor"}.`,
    "returns",
  );
}

export async function markVendorReturnReceived(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "VENDOR_RECEIVED",
    {
      receivedByVendorDate: Date.now(),
      returnShipment: {
        ...(ret.returnShipment || {}),
        receivedDate: Date.now(),
      },
    },
    performedBy,
    "Vendor confirmed receipt",
    ret.returnNumber,
  );
}

export async function completeVendorReturn(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "COMPLETED",
    { completedBy: performedBy, completedDate: Date.now() },
    performedBy,
    "Return completed",
    ret.returnNumber,
  );
  await notifyAdminFeed(
    "Return completed",
    `${ret.returnNumber} has been completed.`,
    "returns",
  );
}
