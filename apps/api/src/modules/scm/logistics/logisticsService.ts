import {
  createRecord,
  updateRecord,
  getAllRecords,
  getRecordById,
  getRecordsWhere,
} from "@/services/firebase";
import { LOGISTICS_PATHS } from "./logisticsPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { withActionLock } from "@/modules/scm/shared/actionLock";
import {
  updateFulfillmentDeliveryStatus,
  updateSalesOrderShippedStatus,
} from "../orders/orderFulfillmentService";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  errorMessage,
  formatStatusLabel,
  toLocalDateKey,
} from "@/modules/scm/shared/format";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { notifyAdminFeed } from "@/services/notifications";
import type {
  DeliveryExceptionCode,
  LogisticsCarrier,
  OrderAcknowledgement,
  OrderFulfillment,
  ScmShipment,
  ShipmentException,
  ShipmentPackageRef,
  ShipmentServiceType,
  ShipmentStatus,
  ShipmentTrackingEvent,
  TrackingEventStatus,
  WarehousePacking,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";

/** Controlled forward/exception lifecycle. Deliberately excludes any backward transition
 * (e.g. `DELIVERED -> DISPATCHED`) and excludes `DRAFT`/`CANCELLED` as reachable targets
 * except where explicitly listed — shipments are created directly at `READY_TO_SHIP` since
 * eligibility is already validated at creation time (see `getShipmentBlockers`), so `DRAFT`
 * is not currently used but is kept in the type/status-tone maps for forward compatibility. */
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  DRAFT: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["CARRIER_ASSIGNED", "CANCELLED"],
  CARRIER_ASSIGNED: ["LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "DELIVERY_EXCEPTION"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERY_EXCEPTION"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY", "DELIVERY_EXCEPTION"],
  DELIVERY_EXCEPTION: [
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "FAILED_DELIVERY",
    "DELIVERED",
  ],
  FAILED_DELIVERY: ["OUT_FOR_DELIVERY", "IN_TRANSIT"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionShipment(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

/** Validates `from → to` against the map, then moves the record atomically — a stale tab whose
 *  shipment has since moved on gets an error instead of overwriting. */
async function moveShipment(
  shipment: ScmShipment,
  to: ShipmentStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!canTransitionShipment(shipment.status, to)) {
    throw new Error(
      `Cannot move shipment from ${formatStatusLabel(shipment.status)} to ${formatStatusLabel(to)}.`,
    );
  }
  await transitionStatus<ShipmentStatus>(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    [shipment.status],
    to,
    extra,
  );
}

const CANCELLABLE_STATUSES = new Set<ShipmentStatus>([
  "DRAFT",
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
]);

async function addTrackingEvent(
  shipmentId: string,
  status: TrackingEventStatus,
  performedBy: string,
  description?: string,
  location?: string,
  source: "SYSTEM" | "MANUAL" = "SYSTEM",
): Promise<void> {
  await createRecord(LOGISTICS_PATHS.trackingEvents, {
    shipmentId,
    status,
    location,
    description,
    eventTime: Date.now(),
    source,
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ShipmentTrackingEvent, "id">);
}

/** Read-only eligibility check — returns the exact list of missing requirements (empty =
 * eligible), never throws, so the UI can show precisely what's blocking shipment creation
 * instead of creating an incomplete shipment silently. */
export function getShipmentBlockers(
  fulfillment: OrderFulfillment | null,
  relevantPackings: WarehousePacking[],
  order: OrderAcknowledgement | null,
): string[] {
  const blockers: string[] = [];
  if (!fulfillment) {
    blockers.push("Fulfillment not found");
    return blockers;
  }
  if (fulfillment.status === "CANCELLED")
    blockers.push("Fulfillment is cancelled");
  const livePackings = relevantPackings.filter((p) => p.status !== "CANCELLED");
  if (!["READY_TO_SHIP", "FULFILLED"].includes(fulfillment.status))
    blockers.push("Packing not completed");
  if (fulfillment.stockIssueLedgerEntryIds.length === 0)
    blockers.push("Stock issue not posted");
  if (
    (livePackings.length === 0 ||
      livePackings.some((p) => p.status !== "PACKED")) &&
    !blockers.includes("Packing not completed")
  ) {
    blockers.push("Packing not completed");
  }
  const totalPackages = livePackings.reduce(
    (s, p) => s + (p.packages || []).length,
    0,
  );
  if (totalPackages === 0 && !blockers.includes("Packing not completed"))
    blockers.push("No packages recorded for this fulfillment");
  if (!order) blockers.push("Sales order not found");
  else if (!order.shipToAddress?.trim())
    blockers.push("Delivery address missing");
  return blockers;
}

/** Packings for a fulfillment that have not yet been attached to any non-cancelled shipment —
 * what's left to ship on a partial-shipment-eligible fulfillment. */
export function getUnshippedPackings(
  fulfillmentId: string,
  packings: WarehousePacking[],
  shipments: ScmShipment[],
): WarehousePacking[] {
  const shippedPackingIds = new Set(
    shipments
      .filter(
        (s) => s.fulfillmentId === fulfillmentId && s.status !== "CANCELLED",
      )
      .flatMap((s) => s.packingIds),
  );
  return packings.filter(
    (p) =>
      p.fulfillmentId === fulfillmentId &&
      p.status === "PACKED" &&
      !shippedPackingIds.has(p.id),
  );
}

/** Creates a shipment from one or more already-packed Phase 5 packings belonging to a
 * ready-to-ship Phase 6 fulfillment. Never posts to the stock ledger — stock already left on
 * `SALES_ISSUE` when the fulfillment was finalized. Supports partial shipment: a fulfillment
 * may have multiple shipments, each covering a disjoint set of packings. Serialized per
 * fulfillment and re-checked against fresh shipments/packings, so a double click or second tab
 * can never ship the same packing twice. */
export async function createShipment(
  fulfillment: OrderFulfillment,
  order: OrderAcknowledgement,
  selectedPackingIds: string[],
  performedBy: string,
): Promise<string> {
  if (selectedPackingIds.length === 0)
    throw new Error("Select at least one packed package to ship.");
  if (!order.shipToAddress?.trim())
    throw new Error("Delivery address missing on the sales order.");
  return withActionLock(`shipment-create:${fulfillment.id}`, () =>
    createShipmentLocked(fulfillment, order, selectedPackingIds, performedBy),
  );
}

async function createShipmentLocked(
  fulfillment: OrderFulfillment,
  order: OrderAcknowledgement,
  selectedPackingIds: string[],
  performedBy: string,
): Promise<string> {
  const existingShipments = await getRecordsWhere<ScmShipment>(
    LOGISTICS_PATHS.shipments,
    "fulfillmentId",
    fulfillment.id,
  );
  const alreadyShippedPackingIds = new Set(
    existingShipments
      .filter((s) => s.status !== "CANCELLED")
      .flatMap((s) => s.packingIds || []),
  );
  const selectedPackings = (
    await Promise.all(
      selectedPackingIds.map(
        (id) =>
          getRecordById(
            WAREHOUSE_PATHS.packings,
            id,
          ) as Promise<WarehousePacking | null>,
      ),
    )
  ).filter((p): p is WarehousePacking => p !== null);
  if (selectedPackings.length !== selectedPackingIds.length)
    throw new Error(
      "A selected packing no longer exists. Refresh and try again.",
    );
  const notPacked = selectedPackings.find(
    (p) => p.status !== "PACKED" || p.fulfillmentId !== fulfillment.id,
  );
  if (notPacked)
    throw new Error(
      `Packing ${notPacked.packNumber} is not packed for this fulfillment.`,
    );
  const duplicate = selectedPackings.find((p) =>
    alreadyShippedPackingIds.has(p.id),
  );
  if (duplicate)
    throw new Error(
      `Packing ${duplicate.packNumber} has already been shipped.`,
    );

  const packages: ShipmentPackageRef[] = selectedPackings.flatMap((p) =>
    (p.packages || []).map((pkg) => ({
      packingId: p.id,
      packNumber: p.packNumber,
      packageNumber: pkg.packageNumber,
      packageType: pkg.packageType,
      weight: pkg.weight,
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
      items: pkg.items,
    })),
  );
  if (packages.length === 0)
    throw new Error("Selected packing has no packages recorded.");
  const totalWeight =
    Math.round(packages.reduce((s, p) => s + (p.weight || 0), 0) * 100) / 100;

  const shipmentNumber = await reserveDocumentNumber("shipment");
  const id = await createRecord(LOGISTICS_PATHS.shipments, {
    shipmentNumber,
    fulfillmentId: fulfillment.id,
    salesOrderId: fulfillment.salesOrderId,
    salesOrderNumberSnapshot: fulfillment.salesOrderNumberSnapshot,
    customerId: fulfillment.customerId,
    customerNameSnapshot: fulfillment.customerNameSnapshot,
    warehouseId: fulfillment.warehouseId,
    packingIds: selectedPackings.map((p) => p.id),
    packages,
    totalPackages: packages.length,
    totalWeight,
    shippingAddress: order.shipToAddress,
    billingAddress: order.billToAddress,
    status: "READY_TO_SHIP",
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmShipment, "id">);

  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    id as string,
    "Shipment created",
    performedBy,
    `${shipmentNumber} for ${fulfillment.fulfillmentNumber}`,
  );
  await addTrackingEvent(
    id as string,
    "CREATED",
    performedBy,
    `Shipment created — ${packages.length} package(s) ready to ship`,
  );
  return id as string;
}

export interface CarrierAssignmentInput {
  carrier: LogisticsCarrier;
  serviceType: ShipmentServiceType;
  expectedDeliveryDate?: string;
}

export async function assignCarrier(
  shipment: ScmShipment,
  input: CarrierAssignmentInput,
  performedBy: string,
): Promise<void> {
  if (
    shipment.status !== "READY_TO_SHIP" &&
    shipment.status !== "CARRIER_ASSIGNED"
  ) {
    throw new Error(
      `Carrier cannot be assigned from status ${formatStatusLabel(shipment.status)}.`,
    );
  }
  const carrier = (await getRecordById(
    LOGISTICS_PATHS.carriers,
    input.carrier.id,
  )) as LogisticsCarrier | null;
  if (!carrier || carrier.status !== "ACTIVE")
    throw new Error("Only an active carrier can be assigned.");
  // Re-assigning (CARRIER_ASSIGNED → CARRIER_ASSIGNED) is allowed; the gate still rejects a stale tab.
  await transitionStatus<ShipmentStatus>(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    ["READY_TO_SHIP", "CARRIER_ASSIGNED"],
    "CARRIER_ASSIGNED",
    {
      carrierId: carrier.id,
      carrierNameSnapshot: carrier.carrierName,
      serviceType: input.serviceType,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      carrierAssignedBy: performedBy,
      carrierAssignedAt: Date.now(),
    },
  );
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Carrier assigned",
    performedBy,
    `${input.carrier.carrierName} (${input.serviceType})`,
  );
  await addTrackingEvent(
    shipment.id,
    "CARRIER_ASSIGNED",
    performedBy,
    `Carrier assigned: ${input.carrier.carrierName} — ${input.serviceType}`,
    undefined,
    "MANUAL",
  );
}

/** Records a tracking number (carrier-generated or manually entered) and finalizes the
 * shipment label. Never fabricates a tracking number — if the carrier has a
 * `trackingUrlTemplate`, the tracking URL is derived from the actual number entered. */
export async function createShipmentLabel(
  shipment: ScmShipment,
  trackingNumber: string,
  carrier: LogisticsCarrier | undefined,
  performedBy: string,
): Promise<void> {
  if (shipment.status !== "CARRIER_ASSIGNED")
    throw new Error("Assign a carrier before creating the shipping label.");
  const trimmed = trackingNumber.trim();
  if (!trimmed) throw new Error("Tracking number is required.");
  const trackingUrl = carrier?.trackingUrlTemplate?.includes("{trackingNumber}")
    ? carrier.trackingUrlTemplate.replace(
        "{trackingNumber}",
        encodeURIComponent(trimmed),
      )
    : undefined;

  await moveShipment(shipment, "LABEL_CREATED", {
    trackingNumber: trimmed,
    trackingUrl: trackingUrl ?? null,
  });
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Shipping label created",
    performedBy,
    `Tracking # ${trimmed}`,
  );
  await addTrackingEvent(
    shipment.id,
    "LABEL_CREATED",
    performedBy,
    `Tracking number recorded: ${trimmed}`,
    undefined,
    "MANUAL",
  );
}

/** The only place Phase 7 changes shipment state on dispatch — it never touches inventory.
 * Stock was already reduced by Phase 6's `SALES_ISSUE`; this marks the physical hand-off to the
 * carrier, which is also when the sales order's `shippedStatus` rolls forward. */
export async function dispatchShipment(
  shipment: ScmShipment,
  performedBy: string,
): Promise<void> {
  if (shipment.status !== "LABEL_CREATED")
    throw new Error(
      "Shipment needs a carrier and tracking number/label before it can be dispatched.",
    );
  if (!shipment.carrierId) throw new Error("Assign a carrier before dispatch.");
  if (shipment.totalPackages <= 0) throw new Error("Shipment has no packages.");

  await moveShipment(shipment, "DISPATCHED", {
    dispatchedBy: performedBy,
    dispatchedAt: Date.now(),
    shipmentDate: toLocalDateKey(),
  });
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Shipment dispatched",
    performedBy,
    shipment.shipmentNumber,
  );
  await addTrackingEvent(
    shipment.id,
    "DISPATCHED",
    performedBy,
    `Handed to ${shipment.carrierNameSnapshot || "carrier"}`,
  );
  await notifyAdminFeed(
    "Shipment dispatched",
    `${shipment.shipmentNumber} for ${shipment.salesOrderNumberSnapshot} has been dispatched.`,
    "logistics",
  ).catch(() => {});
  try {
    await updateSalesOrderShippedStatus(shipment.salesOrderId);
  } catch (err: unknown) {
    throw new Error(
      `Shipment dispatched, but the sales order's shipped status could not be updated: ${errorMessage(err, "unknown error")}`,
    );
  }
}

/** Generic forward-status update for IN_TRANSIT / OUT_FOR_DELIVERY, validated against
 * `VALID_TRANSITIONS` so no invalid or backward move is ever accepted. Always appends a new
 * tracking event — existing events are never edited or removed. */
export async function updateShipmentStatus(
  shipment: ScmShipment,
  nextStatus: "IN_TRANSIT" | "OUT_FOR_DELIVERY",
  performedBy: string,
  opts?: { location?: string; description?: string },
): Promise<void> {
  await moveShipment(shipment, nextStatus);
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    `Status updated to ${formatStatusLabel(nextStatus)}`,
    performedBy,
    opts?.description || "",
  );
  await addTrackingEvent(
    shipment.id,
    nextStatus,
    performedBy,
    opts?.description,
    opts?.location,
    "MANUAL",
  );
  if (nextStatus === "OUT_FOR_DELIVERY") {
    await notifyAdminFeed(
      "Shipment out for delivery",
      `${shipment.shipmentNumber} is out for delivery.`,
      "logistics",
    ).catch(() => {});
  }
}

export interface DeliveryConfirmationInput {
  recipientName?: string;
  deliveryNotes?: string;
  proofOfDeliveryUrl?: string;
}

export async function markShipmentDelivered(
  shipment: ScmShipment,
  input: DeliveryConfirmationInput,
  performedBy: string,
): Promise<void> {
  const now = Date.now();
  await moveShipment(shipment, "DELIVERED", {
    actualDeliveryDate: toLocalDateKey(now),
    deliveredAt: now,
    deliveredBy: performedBy,
    recipientName: input.recipientName,
    deliveryNotes: input.deliveryNotes,
    proofOfDeliveryUrl: input.proofOfDeliveryUrl,
  });
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Shipment delivered",
    performedBy,
    input.recipientName || shipment.shipmentNumber,
  );
  await addTrackingEvent(
    shipment.id,
    "DELIVERED",
    performedBy,
    input.deliveryNotes || "Delivered",
    undefined,
    "MANUAL",
  );
  await notifyAdminFeed(
    "Shipment delivered",
    `${shipment.shipmentNumber} for ${shipment.salesOrderNumberSnapshot} was delivered.`,
    "logistics",
  ).catch(() => {});
  try {
    await updateFulfillmentDeliveryStatus(shipment.fulfillmentId);
  } catch (err: unknown) {
    throw new Error(
      `Shipment delivered, but the fulfillment's delivery status could not be updated: ${errorMessage(err, "unknown error")}`,
    );
  }
}

/** Records a delivery exception (customer unavailable, address issue, damage, etc.) without
 * creating a Returns/reversal record — that stays a Phase 8 workflow, even for
 * DAMAGED_PACKAGE. This only flags the shipment and logs what happened. */
export async function recordDeliveryException(
  shipment: ScmShipment,
  exceptionCode: DeliveryExceptionCode,
  description: string,
  performedBy: string,
): Promise<string> {
  await moveShipment(shipment, "DELIVERY_EXCEPTION");
  const id = await createRecord(LOGISTICS_PATHS.exceptions, {
    shipmentId: shipment.id,
    exceptionCode,
    description: description.trim() || exceptionCode,
    occurredAt: Date.now(),
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ShipmentException, "id">);
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Delivery exception recorded",
    performedBy,
    `${exceptionCode}: ${description}`,
  );
  await addTrackingEvent(
    shipment.id,
    "DELIVERY_EXCEPTION",
    performedBy,
    `${formatStatusLabel(exceptionCode)}: ${description}`,
    undefined,
    "MANUAL",
  );
  await notifyAdminFeed(
    "Delivery exception",
    `${shipment.shipmentNumber}: ${formatStatusLabel(exceptionCode)}`,
    "logistics",
  ).catch(() => {});
  return id as string;
}

export async function resolveDeliveryException(
  exception: ShipmentException,
  resolution: string,
  performedBy: string,
): Promise<void> {
  if (exception.resolvedAt)
    throw new Error("This exception has already been resolved.");
  await updateRecord(LOGISTICS_PATHS.exceptions, exception.id, {
    resolution: resolution.trim(),
    resolvedAt: Date.now(),
    resolvedBy: performedBy,
  });
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    exception.shipmentId,
    "Delivery exception resolved",
    performedBy,
    resolution,
  );
}

/** Failed delivery never auto-creates a return — the operator explicitly chooses the next
 * step (retry via a fresh OUT_FOR_DELIVERY update, or record an exception/hold). */
export async function recordFailedDelivery(
  shipment: ScmShipment,
  reason: string,
  performedBy: string,
): Promise<void> {
  if (!reason.trim()) throw new Error("A reason is required.");
  await moveShipment(shipment, "FAILED_DELIVERY");
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Failed delivery recorded",
    performedBy,
    reason,
  );
  await addTrackingEvent(
    shipment.id,
    "FAILED_DELIVERY",
    performedBy,
    reason,
    undefined,
    "MANUAL",
  );
  await notifyAdminFeed(
    "Failed delivery",
    `${shipment.shipmentNumber}: ${reason}`,
    "logistics",
  ).catch(() => {});
}

/** Cancellation is only ever allowed pre-dispatch — once DISPATCHED, the physical shipment
 * exists in the outside world and must be resolved via DELIVERY_EXCEPTION/FAILED_DELIVERY
 * instead, never a silent cancel. */
export async function cancelShipment(
  shipment: ScmShipment,
  reason: string,
  performedBy: string,
): Promise<void> {
  if (!CANCELLABLE_STATUSES.has(shipment.status))
    throw new Error(
      "A dispatched shipment cannot be cancelled — record a delivery exception or failed delivery instead.",
    );
  await moveShipment(shipment, "CANCELLED", {
    cancelledBy: performedBy,
    cancelledAt: Date.now(),
    cancellationReason: reason,
  });
  await logRecordAudit(
    LOGISTICS_PATHS.shipments,
    shipment.id,
    "Shipment cancelled",
    performedBy,
    reason,
  );
  await addTrackingEvent(
    shipment.id,
    "CANCELLED",
    performedBy,
    reason,
    undefined,
    "MANUAL",
  );
}

export interface CarrierInput {
  carrierCode: string;
  carrierName: string;
  serviceTypes: ShipmentServiceType[];
  contact?: string;
  phone?: string;
  email?: string;
  website?: string;
  trackingUrlTemplate?: string;
  notes?: string;
}

export async function createCarrier(
  data: CarrierInput,
  performedBy: string,
): Promise<string> {
  const code = data.carrierCode.trim().toUpperCase();
  if (!code) throw new Error("Carrier code is required.");
  if (!data.carrierName.trim()) throw new Error("Carrier name is required.");
  const existing = (await getAllRecords(
    LOGISTICS_PATHS.carriers,
  )) as LogisticsCarrier[];
  if (existing.some((c) => c.carrierCode === code))
    throw new Error(`Carrier code "${code}" already exists.`);

  const id = await createRecord(LOGISTICS_PATHS.carriers, {
    ...data,
    carrierCode: code,
    status: "ACTIVE",
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<LogisticsCarrier, "id">);
  await logRecordAudit(
    LOGISTICS_PATHS.carriers,
    id as string,
    "Carrier created",
    performedBy,
    data.carrierName,
  );
  return id as string;
}

export async function updateCarrier(
  carrier: LogisticsCarrier,
  updates: Partial<
    Pick<
      LogisticsCarrier,
      | "carrierName"
      | "serviceTypes"
      | "contact"
      | "phone"
      | "email"
      | "website"
      | "trackingUrlTemplate"
      | "notes"
      | "status"
    >
  >,
  performedBy: string,
): Promise<void> {
  await updateRecord(LOGISTICS_PATHS.carriers, carrier.id, {
    ...updates,
    updatedAt: Date.now(),
  });
  await logRecordAudit(
    LOGISTICS_PATHS.carriers,
    carrier.id,
    "Carrier updated",
    performedBy,
    carrier.carrierName,
  );
}
