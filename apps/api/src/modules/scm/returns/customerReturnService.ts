import { createRecord, getRecordById } from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { makeLineId } from "../inventory/batchSerialService";
import { ORDER_PATHS } from "../orders/orderPaths";
import { RETURNS_PATHS } from "./returnsPaths";
import {
  RETURNABLE_FULFILLMENT_STATUSES,
  receivedQty,
  returnScopeKey,
} from "./returnHelpers";
import {
  createWithReservations,
  getCostPrice,
  getFreshReturn,
  loadSavedReturnLines,
  releaseReturnLines,
  requireStatus,
  reserveReturnLine,
  transitionReturn,
} from "./returnsMasterService";
import type {
  OrderFulfillment,
  ReturnInspectionResult,
  ReturnItemCondition,
  ReturnReasonCode,
  ScmReturn,
  ScmReturnInspection,
  ScmReturnItem,
  ScmReturnShipmentInfo,
} from "@/types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CustomerReturnItemInput {
  productCode: string;
  requestedQuantity: number;
  batchId?: string;
  batchNumber?: string;
  serialNumbers?: string[];
  notes?: string;
}

export interface CreateCustomerReturnInput {
  fulfillmentId: string;
  shipmentId?: string;
  shipmentNumberSnapshot?: string;
  reasonCode: ReturnReasonCode;
  reasonDescription?: string;
  items: CustomerReturnItemInput[];
  notes?: string;
}

/** Creates a customer return at REQUESTED. Eligibility is recomputed here from the fulfillment
 *  (issued quantity) and every other open return — never from client-passed quantities. */
export async function createCustomerReturn(
  input: CreateCustomerReturnInput,
  performedBy: string,
): Promise<string> {
  if (input.items.length === 0)
    throw new Error("Add at least one item to return.");
  if (
    new Set(input.items.map((i) => i.productCode)).size !== input.items.length
  )
    throw new Error("Each product may appear only once per return.");
  const fulfillment = (await getRecordById(
    ORDER_PATHS.fulfillments,
    input.fulfillmentId,
  )) as OrderFulfillment | null;
  if (!fulfillment) throw new Error("Source fulfillment not found.");
  if (!RETURNABLE_FULFILLMENT_STATUSES.has(fulfillment.status))
    throw new Error("Only fulfilled (shipped) orders can be returned.");

  const items: ScmReturnItem[] = [];
  const reservations: Array<{ scopeKey: string; lineId: string }> = [];
  const warehouseId = fulfillment.warehouseId;
  try {
    for (const it of input.items) {
      if (!(it.requestedQuantity > 0))
        throw new Error(
          `Requested quantity for ${it.productCode} must be greater than zero.`,
        );
      const lines = (fulfillment.items || []).filter(
        (l) => l.itemCode === it.productCode,
      );
      const fulfilledQuantity = lines.reduce(
        (s, l) => s + (l.issuedQty || 0),
        0,
      );
      if (lines.length === 0 || fulfilledQuantity <= 0)
        throw new Error(
          `${it.productCode} was not issued on ${fulfillment.fulfillmentNumber}.`,
        );
      const lineId = makeLineId();
      const scopeKey = returnScopeKey(
        { returnType: "CUSTOMER_RETURN", fulfillmentId: fulfillment.id },
        { productCode: it.productCode },
      );
      const savedLines = await loadSavedReturnLines({
        fulfillmentId: fulfillment.id,
        productCode: it.productCode,
      });
      const previouslyReturnedQuantity = await reserveReturnLine({
        scopeKey,
        lineId,
        quantity: it.requestedQuantity,
        sourceQuantity: fulfilledQuantity,
        savedLines,
        productCode: it.productCode,
      });
      reservations.push({ scopeKey, lineId });
      items.push({
        id: lineId,
        productCode: it.productCode,
        productNameSnapshot: lines[0].itemDescription,
        uom: lines[0].uom,
        orderedQuantity: lines.reduce((s, l) => s + (l.orderedQty || 0), 0),
        fulfilledQuantity,
        previouslyReturnedQuantity,
        requestedQuantity: it.requestedQuantity,
        batchId: it.batchId,
        batchNumber: it.batchNumber,
        serialNumbers:
          it.serialNumbers && it.serialNumbers.length > 0
            ? it.serialNumbers
            : undefined,
        warehouseId,
        unitCost: await getCostPrice(it.productCode),
        notes: it.notes,
      });
    }
  } catch (err) {
    await releaseReturnLines(reservations);
    throw err;
  }

  let returnNumber = "";
  const id = await createWithReservations(reservations, async () => {
    returnNumber = await reserveDocumentNumber("customerReturn");
    return createRecord(RETURNS_PATHS.returns, {
      returnNumber,
      returnType: "CUSTOMER_RETURN",
      salesOrderId: fulfillment.salesOrderId,
      salesOrderNumberSnapshot: fulfillment.salesOrderNumberSnapshot,
      fulfillmentId: fulfillment.id,
      fulfillmentNumberSnapshot: fulfillment.fulfillmentNumber,
      shipmentId: input.shipmentId,
      shipmentNumberSnapshot: input.shipmentNumberSnapshot,
      customerId: fulfillment.customerId,
      customerNameSnapshot: fulfillment.customerNameSnapshot,
      warehouseId,
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
    "Customer return created",
    performedBy,
    `${returnNumber} for ${fulfillment.fulfillmentNumber}`,
  );
  return id;
}

// ---------------------------------------------------------------------------
// Transit / receive / inspection
// ---------------------------------------------------------------------------

export async function markCustomerReturnInTransit(
  ret: ScmReturn,
  shipmentInfo: ScmReturnShipmentInfo | undefined,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "IN_TRANSIT",
    { returnShipment: shipmentInfo || ret.returnShipment || null },
    performedBy,
    "Marked in transit",
    ret.returnNumber,
  );
}

export interface ReceiveCustomerReturnInput {
  receivedQuantities: Record<string, number>; // itemId -> received quantity
  warehouseId?: string;
  notes?: string;
}

export async function receiveCustomerReturn(
  retId: string,
  input: ReceiveCustomerReturnInput,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshReturn(retId);
  requireStatus(fresh, "IN_TRANSIT");
  const items = fresh.items.map((it) => {
    const qty = input.receivedQuantities[it.id] ?? it.requestedQuantity;
    if (!Number.isFinite(qty) || qty < 0)
      throw new Error(
        `${it.productCode}: received quantity cannot be negative.`,
      );
    if (qty > it.requestedQuantity)
      throw new Error(
        `${it.productCode}: received ${qty} exceeds the requested ${it.requestedQuantity}.`,
      );
    return { ...it, receivedReturnQuantity: qty };
  });
  const total = items.reduce((s, i) => s + (i.receivedReturnQuantity || 0), 0);
  if (total <= 0)
    throw new Error("Enter the quantity received for at least one line.");
  await transitionReturn(
    fresh,
    "RECEIVED",
    {
      items,
      receivedBy: performedBy,
      receivedDate: Date.now(),
      warehouseId: input.warehouseId || fresh.warehouseId,
      notes: input.notes ?? fresh.notes,
      returnShipment: {
        ...(fresh.returnShipment || {}),
        receivedDate: Date.now(),
      },
    },
    performedBy,
    "Return received",
    `${total} unit(s) across ${items.length} line(s)`,
  );
  await notifyAdminFeed(
    "Return received",
    `${fresh.returnNumber} has been received and is pending inspection.`,
    "returns",
  );
}

export async function startCustomerReturnInspection(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "INSPECTION_PENDING",
    {},
    performedBy,
    "Inspection started",
    ret.returnNumber,
  );
  await notifyAdminFeed(
    "Return inspection pending",
    `${ret.returnNumber} is awaiting inspection.`,
    "returns",
  );
}

export interface InspectionLineResult {
  condition: ReturnItemCondition;
  acceptedQuantity: number;
  rejectedQuantity: number;
}

export interface CompleteInspectionInput {
  itemResults: Record<string, InspectionLineResult>;
  notes?: string;
}

/** Basic return inspection: every line's accepted + rejected must equal what was received.
 *  Disposition is a separate, later decision. */
export async function completeCustomerReturnInspection(
  retId: string,
  input: CompleteInspectionInput,
  performedBy: string,
): Promise<string> {
  const fresh = await getFreshReturn(retId);
  requireStatus(fresh, "INSPECTION_PENDING");
  const items = fresh.items.map((it) => {
    const r = input.itemResults[it.id];
    if (!r)
      throw new Error(
        `${it.productCode}: record an inspection result for every line.`,
      );
    if (!(r.acceptedQuantity >= 0) || !(r.rejectedQuantity >= 0))
      throw new Error(`${it.productCode}: quantities cannot be negative.`);
    if (r.acceptedQuantity + r.rejectedQuantity !== receivedQty(it)) {
      throw new Error(
        `${it.productCode}: accepted + rejected must equal the ${receivedQty(it)} received.`,
      );
    }
    return {
      ...it,
      condition: r.condition,
      acceptedQuantity: r.acceptedQuantity,
      rejectedQuantity: r.rejectedQuantity,
    };
  });
  const accepted = items.reduce((s, i) => s + (i.acceptedQuantity || 0), 0);
  const rejected = items.reduce((s, i) => s + (i.rejectedQuantity || 0), 0);
  if (accepted + rejected <= 0)
    throw new Error("Nothing was received on this return to inspect.");
  const result: ReturnInspectionResult =
    rejected === 0
      ? "ACCEPTED"
      : accepted === 0
        ? "REJECTED"
        : "PARTIALLY_ACCEPTED";
  const conditions = new Set(items.map((i) => i.condition));

  await transitionReturn(
    fresh,
    "INSPECTED",
    { items, inspectedBy: performedBy, inspectedDate: Date.now() },
    performedBy,
    "Inspection completed",
    `${result} — accepted ${accepted}, rejected ${rejected}`,
  );

  const inspectionId = await createRecord(RETURNS_PATHS.inspections, {
    returnId: fresh.id,
    returnNumberSnapshot: fresh.returnNumber,
    inspectorId: performedBy,
    inspectionDate: Date.now(),
    condition:
      conditions.size === 1
        ? (items[0].condition as ReturnItemCondition)
        : "UNKNOWN",
    acceptedQuantity: accepted,
    rejectedQuantity: rejected,
    inspectionResult: result,
    items: items.map((i) => ({
      itemId: i.id,
      condition: i.condition as ReturnItemCondition,
      acceptedQuantity: i.acceptedQuantity || 0,
      rejectedQuantity: i.rejectedQuantity || 0,
    })),
    notes: input.notes,
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmReturnInspection, "id">);
  return inspectionId as string;
}

export async function moveCustomerReturnToDisposition(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "DISPOSITION_PENDING",
    {},
    performedBy,
    "Moved to disposition",
    ret.returnNumber,
  );
  await notifyAdminFeed(
    "Return disposition pending",
    `${ret.returnNumber} is awaiting a disposition decision.`,
    "returns",
  );
}
