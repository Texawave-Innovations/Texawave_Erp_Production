import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import type {
  AssignCarrierDto,
  DeliverShipmentDto,
  RecordExceptionDto,
} from "./dto/logistics.dto.js";
import {
  canTransition,
  CANCELLABLE_SHIPMENT_STATUSES,
  DISPATCHED_STATUSES,
  type PackageSnapshot,
  packagedQtyByProduct,
} from "./logistics.helpers.js";

const include = {
  carrier: { select: { id: true, carrierCode: true, carrierName: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  fulfillment: { select: { id: true, fulfillmentNumber: true } },
  exceptions: { orderBy: { id: "desc" } },
} satisfies Prisma.ScmShipmentInclude;

const num = (d: Prisma.Decimal | number) => Number(d);
const today = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const BLOCKED_SHIPMENT_DELETE_STATUSES = [
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
];

@Injectable()
export class ShipmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
  ) {}

  // ---- reads ----------------------------------------------------------------

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      carrierId?: number | undefined;
      fulfillmentId?: number | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmShipmentWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.carrierId ? { carrierId: f.carrierId } : {}),
      ...(f.fulfillmentId ? { fulfillmentId: f.fulfillmentId } : {}),
      ...(f.q
        ? {
            OR: [
              { shipmentNumber: { contains: f.q, mode: "insensitive" } },
              { salesOrderNumber: { contains: f.q, mode: "insensitive" } },
              { customerName: { contains: f.q, mode: "insensitive" } },
              { trackingNumber: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmShipment.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmShipment.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const s = await this.prisma.scmShipment.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
    if (!s) return null;
    const events = await this.prisma.scmShipmentTrackingEvent.findMany({
      where: { shipmentId: id },
      orderBy: { eventTime: "desc" },
    });
    return { ...s, trackingEvents: events };
  }

  /** Tracking events across shipments (legacy Tracking page). */
  @OrgScoped()
  async findEvents(scope: OrgScope, page: PaginationDto, q?: string) {
    const where: Prisma.ScmShipmentTrackingEventWhereInput = {
      organizationId: scope.organizationId,
      ...(q
        ? {
            shipment: {
              OR: [
                { shipmentNumber: { contains: q, mode: "insensitive" } },
                { trackingNumber: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.scmShipmentTrackingEvent.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { eventTime: "desc" },
        include: {
          shipment: {
            select: { id: true, shipmentNumber: true, trackingNumber: true },
          },
        },
      }),
      this.prisma.scmShipmentTrackingEvent.count({ where }),
    ]);
    return { items, total };
  }

  /** Fulfillments that have packed, not-yet-shipped packings (Deliveries page). */
  @OrgScoped()
  async findShippable(scope: OrgScope) {
    const fulfillments = await this.prisma.scmFulfillment.findMany({
      where: tenantWhere<Prisma.ScmFulfillmentWhereInput>(scope, {
        status: { in: ["READY_TO_SHIP", "FULFILLED"] },
      }),
      orderBy: { id: "desc" },
      include: {
        salesOrder: { select: { shipToAddress: true } },
        packings: {
          where: { status: "PACKED" },
          include: { packages: { include: { items: true } } },
        },
        shipments: {
          where: { status: { not: "CANCELLED" } },
          include: { packingLinks: true },
        },
      },
    });
    const issued = await this.prisma.scmStockLedgerEntry.groupBy({
      by: ["referenceId"],
      where: {
        organizationId: scope.organizationId,
        referenceType: "FULFILLMENT",
        referenceId: { in: fulfillments.map((f) => f.id) },
      },
      _count: { _all: true },
    });
    const issuedIds = new Set(issued.map((g) => g.referenceId));
    return fulfillments.map((f) => {
      const shipped = new Set(
        f.shipments.flatMap((s) => s.packingLinks.map((l) => l.packingId)),
      );
      const unshipped = f.packings.filter((p) => !shipped.has(p.id));
      const blockers: string[] = [];
      if (!issuedIds.has(f.id)) blockers.push("Stock issue not posted");
      if (f.packings.length === 0) blockers.push("Packing not completed");
      if (!f.salesOrder.shipToAddress?.trim())
        blockers.push("Delivery address missing");
      return {
        id: f.id,
        fulfillmentNumber: f.fulfillmentNumber,
        salesOrderNumber: f.salesOrderNumber,
        customerName: f.customerName,
        status: f.status,
        blockers,
        unshippedPackings: unshipped.map((p) => ({
          id: p.id,
          packNumber: p.packNumber,
          packages: p.packages.length,
        })),
      };
    });
  }

  // ---- create ---------------------------------------------------------------

  /** Creates a shipment from one or more packed packings of a fulfilled
   * fulfillment. Never posts to the stock ledger — stock already left on
   * SALES_ISSUE. The fulfillment is locked and shipments re-read inside the
   * lock, so one packing can never ship twice. */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: { fulfillmentId: number; packingIds: number[] },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM scm.fulfillments WHERE id = ${input.fulfillmentId} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const f = await tx.scmFulfillment.findFirst({
        where: tenantWhere(scope, { id: input.fulfillmentId }),
        include: { salesOrder: true },
      });
      if (!f) {
        throw new BusinessRuleViolationException(
          "Fulfillment not found.",
          "FULFILLMENT_NOT_FOUND",
        );
      }
      const issued = await tx.scmStockLedgerEntry.count({
        where: { referenceType: "FULFILLMENT", referenceId: f.id },
      });
      const blockers: string[] = [];
      if (f.status === "CANCELLED") blockers.push("Fulfillment is cancelled");
      if (!["READY_TO_SHIP", "FULFILLED"].includes(f.status))
        blockers.push("Packing not completed");
      if (issued === 0) blockers.push("Stock issue not posted");
      if (!f.salesOrder.shipToAddress?.trim())
        blockers.push("Delivery address missing");
      if (blockers.length > 0) {
        throw new BusinessRuleViolationException(
          `Cannot ship yet: ${blockers.join("; ")}.`,
          "SHIPMENT_BLOCKED",
        );
      }

      const packings = await tx.scmPacking.findMany({
        where: tenantWhere(scope, { id: { in: input.packingIds } }),
        include: { packages: { include: { items: true } } },
      });
      if (packings.length !== new Set(input.packingIds).size) {
        throw new BusinessRuleViolationException(
          "A selected packing no longer exists.",
          "PACKING_NOT_FOUND",
        );
      }
      const alreadyShipped = new Set(
        (
          await tx.scmShipmentPacking.findMany({
            where: {
              packingId: { in: input.packingIds },
              shipment: { status: { not: "CANCELLED" } },
            },
          })
        ).map((l) => l.packingId),
      );
      for (const p of packings) {
        if (p.status !== "PACKED" || p.fulfillmentId !== f.id) {
          throw new BusinessRuleViolationException(
            `Packing ${p.packNumber} is not packed for this fulfillment.`,
            "PACKING_NOT_PACKED",
          );
        }
        if (alreadyShipped.has(p.id)) {
          throw new BusinessRuleViolationException(
            `Packing ${p.packNumber} has already been shipped.`,
            "PACKING_ALREADY_SHIPPED",
          );
        }
      }

      const packages: PackageSnapshot[] = packings.flatMap((p) =>
        p.packages.map((pkg) => ({
          packingId: p.id,
          packNumber: p.packNumber,
          packageNumber: pkg.packageNumber,
          packageType: pkg.packageType,
          weight: pkg.weight === null ? null : num(pkg.weight),
          length: pkg.length === null ? null : num(pkg.length),
          width: pkg.width === null ? null : num(pkg.width),
          height: pkg.height === null ? null : num(pkg.height),
          items: pkg.items.map((i) => ({
            productId: i.productId,
            productCode: i.productCode,
            productName: i.productName,
            quantity: num(i.quantity),
          })),
        })),
      );
      if (packages.length === 0) {
        throw new BusinessRuleViolationException(
          "Selected packing has no packages recorded.",
          "NO_PACKAGES",
        );
      }
      const totalWeight =
        Math.round(packages.reduce((s, p) => s + (p.weight ?? 0), 0) * 100) /
        100;

      const shipmentNumber = await this.numbering.next(
        tx,
        scope.organizationId,
        "shipment",
      );
      const created = await tx.scmShipment.create({
        data: {
          organizationId: scope.organizationId,
          shipmentNumber,
          fulfillmentId: f.id,
          salesOrderId: f.salesOrderId,
          salesOrderNumber: f.salesOrderNumber,
          customerId: f.customerId,
          customerName: f.customerName,
          warehouseId: f.warehouseId,
          packages: packages as unknown as Prisma.InputJsonValue,
          totalPackages: packages.length,
          totalWeight,
          shippingAddress: f.salesOrder.shipToAddress as string,
          billingAddress: f.salesOrder.billToAddress,
          currency: f.salesOrder.currency,
          createdBy: actorId,
          updatedBy: actorId,
          packingLinks: { create: packings.map((p) => ({ packingId: p.id })) },
        },
        include,
      });
      await this.event(tx, scope, created.id, "CREATED", actorId, {
        description: `Shipment created — ${packages.length} package(s) ready to ship`,
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: created.id,
        action: "create",
        after: { shipmentNumber, fulfillment: f.fulfillmentNumber },
      });
      return created;
    });
  }

  // ---- lifecycle --------------------------------------------------------------

  private event(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    shipmentId: number,
    status: string,
    actorId: number,
    extra: {
      description?: string;
      location?: string;
      source?: "SYSTEM" | "MANUAL";
    } = {},
  ) {
    return tx.scmShipmentTrackingEvent.create({
      data: {
        organizationId: scope.organizationId,
        shipmentId,
        status,
        description: extra.description ?? null,
        location: extra.location ?? null,
        source: extra.source ?? "SYSTEM",
        createdBy: actorId,
      },
    });
  }

  /** Validates `from -> to` against the lifecycle map and claims the move
   * atomically, so a stale tab gets an error instead of overwriting. */
  private async move(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
    to: string,
    actorId: number,
    data: Prisma.ScmShipmentUncheckedUpdateManyInput = {},
  ) {
    const current = await tx.scmShipment.findFirst({
      where: tenantWhere(scope, { id }),
    });
    if (!current) return null;
    if (!canTransition(current.status, to)) {
      throw new InvalidStateTransitionException("Shipment", current.status, to);
    }
    const claimed = await tx.scmShipment.updateMany({
      where: {
        id,
        organizationId: scope.organizationId,
        status: current.status,
      },
      data: { status: to, updatedBy: actorId, ...data },
    });
    if (claimed.count === 0) {
      throw new InvalidStateTransitionException("Shipment", "changed", to);
    }
    return current;
  }

  private fresh(tx: Prisma.TransactionClient, id: number) {
    return tx.scmShipment.findUniqueOrThrow({ where: { id }, include });
  }

  @OrgScoped()
  async assignCarrier(
    scope: OrgScope,
    id: number,
    dto: AssignCarrierDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const carrier = await tx.scmCarrier.findFirst({
        where: tenantWhere(scope, { id: dto.carrierId }),
      });
      if (!carrier || carrier.status !== "ACTIVE") {
        throw new BusinessRuleViolationException(
          "Only an active carrier can be assigned.",
          "CARRIER_INACTIVE",
        );
      }
      const current = await this.move(
        tx,
        scope,
        id,
        "CARRIER_ASSIGNED",
        actorId,
        {
          carrierId: carrier.id,
          carrierName: carrier.carrierName,
          serviceType: dto.serviceType,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
          shippingCost: dto.shippingCost ?? null,
          carrierAssignedBy: actorId,
          carrierAssignedAt: new Date(),
        },
      );
      if (!current) return null;
      await this.event(tx, scope, id, "CARRIER_ASSIGNED", actorId, {
        description: `Carrier assigned: ${carrier.carrierName} — ${dto.serviceType}`,
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "assign_carrier",
        after: { carrier: carrier.carrierName, serviceType: dto.serviceType },
      });
      return this.fresh(tx, id);
    });
  }

  /** Records a tracking number and finalizes the label. Never fabricates a
   * number; the tracking URL is derived from the carrier's template. */
  @OrgScoped()
  async createLabel(
    scope: OrgScope,
    id: number,
    trackingNumber: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.scmShipment.findFirst({
        where: tenantWhere(scope, { id }),
        include: { carrier: true },
      });
      if (!s) return null;
      if (s.status !== "CARRIER_ASSIGNED") {
        throw new BusinessRuleViolationException(
          "Assign a carrier before creating the shipping label.",
          "CARRIER_REQUIRED",
        );
      }
      const tn = trackingNumber.trim();
      const template = s.carrier?.trackingUrlTemplate;
      const url = template?.includes("{trackingNumber}")
        ? template.replace("{trackingNumber}", encodeURIComponent(tn))
        : null;
      await this.move(tx, scope, id, "LABEL_CREATED", actorId, {
        trackingNumber: tn,
        trackingUrl: url,
      });
      await this.event(tx, scope, id, "LABEL_CREATED", actorId, {
        description: `Tracking number recorded: ${tn}`,
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "label",
        after: { trackingNumber: tn },
      });
      return this.fresh(tx, id);
    });
  }

  /** Marks the physical hand-off to the carrier. Never touches inventory;
   * also rolls the sales order's shipped status forward. */
  @OrgScoped()
  async dispatch(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.scmShipment.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!s) return null;
      if (s.status !== "LABEL_CREATED") {
        throw new BusinessRuleViolationException(
          "Shipment needs a carrier and tracking number/label before it can be dispatched.",
          "LABEL_REQUIRED",
        );
      }
      if (!s.carrierId) {
        throw new BusinessRuleViolationException(
          "Assign a carrier before dispatch.",
          "CARRIER_REQUIRED",
        );
      }
      await this.move(tx, scope, id, "DISPATCHED", actorId, {
        dispatchedBy: actorId,
        dispatchedAt: new Date(),
        shipmentDate: today(),
      });
      await this.event(tx, scope, id, "DISPATCHED", actorId, {
        description: `Handed to ${s.carrierName ?? "carrier"}`,
      });
      await this.rollShippedStatus(tx, scope, s.salesOrderId);
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "dispatch",
        after: { shipmentNumber: s.shipmentNumber },
      });
      return this.fresh(tx, id);
    });
  }

  @OrgScoped()
  async updateStatus(
    scope: OrgScope,
    id: number,
    to: "IN_TRANSIT" | "OUT_FOR_DELIVERY",
    actorId: number,
    extra: { location?: string | undefined; description?: string | undefined },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.move(tx, scope, id, to, actorId);
      if (!current) return null;
      await this.event(tx, scope, id, to, actorId, {
        ...(extra.description ? { description: extra.description } : {}),
        ...(extra.location ? { location: extra.location } : {}),
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: to.toLowerCase(),
        before: { status: current.status },
        after: { status: to },
      });
      return this.fresh(tx, id);
    });
  }

  @OrgScoped()
  async deliver(
    scope: OrgScope,
    id: number,
    dto: DeliverShipmentDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await this.move(tx, scope, id, "DELIVERED", actorId, {
        actualDeliveryDate: today(),
        deliveredAt: now,
        deliveredBy: actorId,
        recipientName: dto.recipientName?.trim() || null,
        deliveryNotes: dto.deliveryNotes?.trim() || null,
        proofOfDeliveryUrl: dto.proofOfDeliveryUrl?.trim() || null,
      });
      if (!current) return null;
      await this.event(tx, scope, id, "DELIVERED", actorId, {
        description: dto.deliveryNotes?.trim() || "Delivered",
        source: "MANUAL",
      });
      await this.rollDeliveryStatus(tx, current.fulfillmentId);
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "deliver",
        after: { recipientName: dto.recipientName ?? null },
      });
      return this.fresh(tx, id);
    });
  }

  @OrgScoped()
  async recordException(
    scope: OrgScope,
    id: number,
    dto: RecordExceptionDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.move(
        tx,
        scope,
        id,
        "DELIVERY_EXCEPTION",
        actorId,
      );
      if (!current) return null;
      await tx.scmShipmentException.create({
        data: {
          organizationId: scope.organizationId,
          shipmentId: id,
          exceptionCode: dto.exceptionCode,
          description: dto.description.trim() || dto.exceptionCode,
          createdBy: actorId,
        },
      });
      await this.event(tx, scope, id, "DELIVERY_EXCEPTION", actorId, {
        description: `${dto.exceptionCode}: ${dto.description}`,
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "exception",
        after: { exceptionCode: dto.exceptionCode },
      });
      return this.fresh(tx, id);
    });
  }

  @OrgScoped()
  async resolveException(
    scope: OrgScope,
    shipmentId: number,
    exceptionId: number,
    resolution: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ex = await tx.scmShipmentException.findFirst({
        where: {
          id: exceptionId,
          shipmentId,
          organizationId: scope.organizationId,
        },
      });
      if (!ex) return null;
      if (ex.resolvedAt) {
        throw new BusinessRuleViolationException(
          "This exception has already been resolved.",
          "EXCEPTION_RESOLVED",
        );
      }
      await tx.scmShipmentException.update({
        where: { id: exceptionId },
        data: {
          resolution: resolution.trim(),
          resolvedAt: new Date(),
          resolvedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: shipmentId,
        action: "exception_resolved",
        after: { resolution },
      });
      return this.fresh(tx, shipmentId);
    });
  }

  /** Failed delivery never auto-creates a return — the operator chooses the
   * next step. */
  @OrgScoped()
  async failDelivery(
    scope: OrgScope,
    id: number,
    reason: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.move(
        tx,
        scope,
        id,
        "FAILED_DELIVERY",
        actorId,
      );
      if (!current) return null;
      await this.event(tx, scope, id, "FAILED_DELIVERY", actorId, {
        description: reason,
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "failed_delivery",
        after: { reason },
      });
      return this.fresh(tx, id);
    });
  }

  /** Only ever pre-dispatch: once with the carrier, a shipment must be
   * resolved through an exception or failed delivery, never silently cancelled. */
  @OrgScoped()
  async cancel(scope: OrgScope, id: number, reason: string, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.scmShipment.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!s) return null;
      if (
        !(CANCELLABLE_SHIPMENT_STATUSES as readonly string[]).includes(s.status)
      ) {
        throw new BusinessRuleViolationException(
          "A dispatched shipment cannot be cancelled — record a delivery exception or failed delivery instead.",
          "SHIPMENT_DISPATCHED",
        );
      }
      await this.move(tx, scope, id, "CANCELLED", actorId, {
        cancelledBy: actorId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      });
      await this.event(tx, scope, id, "CANCELLED", actorId, {
        description: reason,
        source: "MANUAL",
      });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "cancel",
        after: { reason },
      });
      return this.fresh(tx, id);
    });
  }

  // ---- roll-ups ---------------------------------------------------------------

  /** Sales order shipped status from every dispatched shipment's packaged qty. */
  private async rollShippedStatus(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    salesOrderId: number,
  ) {
    const [order, shipments] = await Promise.all([
      tx.scmSalesOrder.findFirst({
        where: tenantWhere(scope, { id: salesOrderId }),
        include: { items: true },
      }),
      tx.scmShipment.findMany({
        where: { salesOrderId, status: { in: [...DISPATCHED_STATUSES] } },
        select: { packages: true },
      }),
    ]);
    if (!order) return;
    const shipped = packagedQtyByProduct(
      shipments.map((s) => s.packages as unknown as PackageSnapshot[]),
    );
    const ordered = new Map<number, number>();
    for (const it of order.items) {
      ordered.set(
        it.productId,
        (ordered.get(it.productId) ?? 0) + num(it.salesQty),
      );
    }
    let totalOrdered = 0;
    let totalShipped = 0;
    for (const [productId, qty] of ordered) {
      totalOrdered += qty;
      totalShipped += Math.min(qty, shipped.get(productId) ?? 0);
    }
    const shippedStatus =
      totalShipped <= 0
        ? "Not Shipped"
        : totalShipped >= totalOrdered
          ? "Shipped"
          : "Partially Shipped";
    await tx.scmSalesOrder.update({
      where: { id: salesOrderId },
      data: { shippedStatus },
    });
  }

  /** Fulfillment delivery status from its delivered shipments. */
  private async rollDeliveryStatus(
    tx: Prisma.TransactionClient,
    fulfillmentId: number,
  ) {
    const [f, shipments] = await Promise.all([
      tx.scmFulfillment.findUnique({
        where: { id: fulfillmentId },
        include: { items: true },
      }),
      tx.scmShipment.findMany({
        where: { fulfillmentId, status: "DELIVERED" },
        select: { packages: true },
      }),
    ]);
    if (!f) return;
    const delivered = packagedQtyByProduct(
      shipments.map((s) => s.packages as unknown as PackageSnapshot[]),
    );
    const issued = new Map<number, number>();
    for (const it of f.items) {
      issued.set(
        it.productId,
        (issued.get(it.productId) ?? 0) + num(it.issuedQty),
      );
    }
    let any = false;
    let all = issued.size > 0;
    for (const [productId, qty] of issued) {
      if (qty <= 0) continue;
      const d = delivered.get(productId) ?? 0;
      if (d > 0) any = true;
      if (d < qty) all = false;
    }
    await tx.scmFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        deliveryStatus: all
          ? "DELIVERED"
          : any
            ? "PARTIALLY_DELIVERED"
            : "NOT_DELIVERED",
        deliveredAt: all ? new Date() : null,
      },
    });
  }

  /** Once handed to the carrier a shipment is history — only pre-dispatch
   * shipments (and cancelled ones) can be deleted. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmShipment.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      if (BLOCKED_SHIPMENT_DELETE_STATUSES.includes(row.status)) {
        throw new BusinessRuleViolationException(
          "Cannot delete: this shipment has already been dispatched to the carrier.",
          "SHIPMENT_DISPATCHED",
        );
      }
      await tx.scmShipmentTrackingEvent.deleteMany({
        where: { shipmentId: id },
      });
      await tx.scmShipmentException.deleteMany({ where: { shipmentId: id } });
      await tx.scmShipment.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_shipment",
        entityId: id,
        action: "delete",
        before: {
          shipmentNumber: row.shipmentNumber,
          status: row.status,
          by: actorId,
        },
      });
      return true;
    });
  }
}
