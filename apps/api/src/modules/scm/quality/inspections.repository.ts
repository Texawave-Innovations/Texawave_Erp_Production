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
import { actorName } from "../common/scm-actor.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { FulfillmentsRepository } from "../fulfillment/fulfillments.repository.js";
import { StockPostingService } from "../inventory/stock-posting.service.js";
import type {
  CreateInspectionDto,
  RecordItemResultDto,
} from "./dto/quality.dto.js";
import { QuarantineRepository } from "./quarantine.repository.js";
import type { StoredCheckpoint } from "./quality-masters.repository.js";
import {
  OPEN_INSPECTION_STATUSES,
  SOURCE_TYPE_FOR,
  STOCK_OUT_DISPOSITIONS,
  computeOverallResult,
  deriveItemResult,
  dispositionQuantity,
  inspectionStatusesLeadingTo,
  isValidDisposition,
  type ItemResult,
} from "./quality.helpers.js";

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const rule = (message: string, code: string) =>
  new BusinessRuleViolationException(message, code);
const label = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

interface ItemSeed {
  productId: number;
  productCode: string;
  productName: string;
  sourceLineId?: number | null;
  batchId?: number | null;
  batchNumber?: string | null;
  serialNumbers?: string[];
  orderedQty?: number | null;
  sourceQty: number;
  warehouseId?: number | null;
  locationId?: number | null;
  unitCost?: number | null;
}

export interface InspectionFilter {
  q?: string | undefined;
  inspectionType?: string | undefined;
  status?: string | undefined;
}

@Injectable()
export class InspectionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly numbering: ScmNumberingService,
    private readonly stock: StockPostingService,
    private readonly quarantine: QuarantineRepository,
    private readonly fulfillments: FulfillmentsRepository,
  ) {}

  // ---- reads ------------------------------------------------------------------

  @OrgScoped()
  async findMany(scope: OrgScope, f: InspectionFilter, page: PaginationDto) {
    const where = tenantWhere<Prisma.ScmQualityInspectionWhereInput>(scope, {
      ...(f.inspectionType ? { inspectionType: f.inspectionType } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { inspectionNumber: { contains: f.q, mode: "insensitive" } },
              { sourceNumber: { contains: f.q, mode: "insensitive" } },
              { supplierName: { contains: f.q, mode: "insensitive" } },
              { customerName: { contains: f.q, mode: "insensitive" } },
              {
                items: {
                  some: {
                    OR: [
                      { productCode: { contains: f.q, mode: "insensitive" } },
                      { batchNumber: { contains: f.q, mode: "insensitive" } },
                      { serialNumbers: { has: f.q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmQualityInspection.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: { items: { orderBy: { lineNo: "asc" } } },
      }),
      this.prisma.scmQualityInspection.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const insp = await this.prisma.scmQualityInspection.findFirst({
      where: tenantWhere(scope, { id }),
      include: { items: { orderBy: { lineNo: "asc" } } },
    });
    if (!insp) return null;
    const [template, warehouse] = await Promise.all([
      insp.templateId
        ? this.prisma.scmQualityTemplate.findFirst({
            where: {
              id: insp.templateId,
              organizationId: scope.organizationId,
            },
          })
        : null,
      insp.warehouseId
        ? this.prisma.scmWarehouse.findFirst({
            where: {
              id: insp.warehouseId,
              organizationId: scope.organizationId,
            },
            select: { id: true, name: true, code: true },
          })
        : null,
    ]);
    return { ...insp, template, warehouse };
  }

  /** Source documents a new inspection of `type` may be raised against. */
  @OrgScoped()
  async findSources(scope: OrgScope, type: string) {
    const org = scope.organizationId;
    if (type === "INCOMING") {
      const rows = await this.prisma.scmGoodsReceipt.findMany({
        where: { organizationId: org, status: "COMPLETED" },
        orderBy: { id: "desc" },
        take: 200,
        select: { id: true, grnNumber: true, vendorNameSnapshot: true },
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.grnNumber,
        party: r.vendorNameSnapshot,
      }));
    }
    if (type === "CUSTOMER_RETURN") {
      const rows = await this.prisma.scmReturn.findMany({
        where: {
          organizationId: org,
          returnType: "CUSTOMER_RETURN",
          status: { in: ["RECEIVED", "INSPECTION_PENDING"] },
        },
        orderBy: { id: "desc" },
        take: 200,
        select: { id: true, returnNumber: true, customerName: true },
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.returnNumber,
        party: r.customerName,
      }));
    }
    if (type === "PRE_DISPATCH") {
      const rows = await this.prisma.scmFulfillment.findMany({
        where: {
          organizationId: org,
          status: { notIn: ["CANCELLED", "FULFILLED"] },
        },
        orderBy: { id: "desc" },
        take: 200,
        select: { id: true, fulfillmentNumber: true, customerName: true },
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.fulfillmentNumber,
        party: r.customerName,
      }));
    }
    return [];
  }

  @OrgScoped()
  async dashboard(scope: OrgScope) {
    const org = scope.organizationId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [
      byStatus,
      byResult,
      completedToday,
      quarantined,
      criticalDefects,
      timed,
      pending,
      recent,
      defectRows,
    ] = await Promise.all([
      this.prisma.scmQualityInspection.groupBy({
        by: ["status"],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.scmQualityInspection.groupBy({
        by: ["result"],
        where: { organizationId: org, result: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.scmQualityInspection.count({
        where: {
          organizationId: org,
          status: "COMPLETED",
          completedAt: { gte: startOfDay },
        },
      }),
      this.prisma.scmQuarantineRecord.count({
        where: {
          organizationId: org,
          status: { in: ["QUARANTINED", "UNDER_REVIEW"] },
        },
      }),
      this.prisma.scmQualityDefect.count({
        where: {
          organizationId: org,
          active: true,
          severity: { in: ["HIGH", "CRITICAL"] },
        },
      }),
      this.prisma.scmQualityInspection.findMany({
        where: {
          organizationId: org,
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: { startedAt: true, completedAt: true },
      }),
      this.prisma.scmQualityInspection.findMany({
        where: { organizationId: org, status: "PENDING_INSPECTION" },
        orderBy: { id: "desc" },
        take: 8,
      }),
      this.prisma.scmQualityInspection.findMany({
        where: { organizationId: org },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      this.prisma.scmQualityInspectionItem.groupBy({
        by: ["defectCode"],
        where: {
          inspection: { organizationId: org },
          defectCode: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { defectCode: "desc" } },
        take: 6,
      }),
    ]);
    const minutes = timed.length
      ? Math.round(
          timed.reduce(
            (s, i) => s + (i.completedAt!.getTime() - i.startedAt!.getTime()),
            0,
          ) /
            timed.length /
            60000,
        )
      : null;
    return {
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      byResult: Object.fromEntries(
        byResult.map((r) => [r.result as string, r._count._all]),
      ),
      completedToday,
      quarantinedActive: quarantined,
      criticalDefects,
      avgInspectionMinutes: minutes,
      pending,
      recent,
      topDefects: defectRows.map((d) => ({
        defectCode: d.defectCode as string,
        count: d._count._all,
      })),
    };
  }

  // ---- create -----------------------------------------------------------------

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateInspectionDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const org = scope.organizationId;
      let templateName: string | null = null;
      if (dto.templateId) {
        const template = await tx.scmQualityTemplate.findFirst({
          where: { id: dto.templateId, organizationId: org },
        });
        if (!template || !template.active) {
          throw rule(
            "The selected QC template is missing or inactive.",
            "QC_TEMPLATE",
          );
        }
        if (template.inspectionType !== dto.inspectionType) {
          throw rule(
            `Template ${template.templateCode} is for ${label(template.inspectionType)} inspections.`,
            "QC_TEMPLATE",
          );
        }
        templateName = template.name;
      }

      const src = await this.resolveSource(tx, scope, dto);
      if (src.items.length === 0) throw rule(src.emptyMessage, "QC_NO_ITEMS");

      const inspectionNumber = await this.numbering.next(
        tx,
        org,
        "qualityInspection",
      );
      const created = await tx.scmQualityInspection.create({
        data: {
          organizationId: org,
          inspectionNumber,
          inspectionType: dto.inspectionType,
          sourceType: SOURCE_TYPE_FOR[dto.inspectionType],
          sourceId: src.sourceId,
          sourceNumber: src.sourceNumber,
          templateId: dto.templateId ?? null,
          templateName,
          supplierId: src.supplierId ?? null,
          supplierName: src.supplierName ?? null,
          customerId: src.customerId ?? null,
          customerName: src.customerName ?? null,
          warehouseId: src.warehouseId ?? null,
          locationId: src.locationId ?? null,
          status: "PENDING_INSPECTION",
          priority: dto.priority ?? "MEDIUM",
          notes: dto.notes?.trim() || null,
          createdBy: actorId,
          items: {
            create: src.items.map((it, idx) => ({
              lineNo: idx + 1,
              productId: it.productId,
              productCode: it.productCode,
              productName: it.productName,
              sourceLineId: it.sourceLineId ?? null,
              batchId: it.batchId ?? null,
              batchNumber: it.batchNumber ?? null,
              serialNumbers: it.serialNumbers ?? [],
              orderedQty: it.orderedQty ?? null,
              sourceQty: it.sourceQty,
              warehouseId: it.warehouseId ?? src.warehouseId ?? null,
              locationId: it.locationId ?? src.locationId ?? null,
              unitCost: it.unitCost ?? null,
            })),
          },
        },
        include: { items: { orderBy: { lineNo: "asc" } } },
      });
      if (dto.inspectionType === "CUSTOMER_RETURN") {
        await tx.scmReturn.update({
          where: { id: src.sourceId },
          data: { qualityInspectionId: created.id },
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: created.id,
        action: "create",
        after: {
          inspectionNumber,
          type: dto.inspectionType,
          source: src.sourceNumber,
        },
      });
      return created;
    });
  }

  /** Builds the inspection header + lines from the source document — never
   * from client-supplied quantities. */
  private async resolveSource(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    dto: CreateInspectionDto,
  ): Promise<{
    sourceId: number;
    sourceNumber: string | null;
    supplierId?: number | null;
    supplierName?: string | null;
    customerId?: number | null;
    customerName?: string | null;
    warehouseId?: number | null;
    locationId?: number | null;
    items: ItemSeed[];
    emptyMessage: string;
  }> {
    const org = scope.organizationId;
    const need = (v: number | undefined, what: string) => {
      if (!v) throw rule(`${what} is required.`, "QC_SOURCE");
      return v;
    };

    if (dto.inspectionType === "INVENTORY") {
      const productId = need(dto.productId, "Product");
      const warehouseId = need(dto.warehouseId, "Warehouse");
      const qty = dto.quantity ?? 0;
      if (!(qty > 0)) {
        throw rule("Quantity to inspect must be greater than zero.", "QC_QTY");
      }
      const [product, warehouse, balance] = await Promise.all([
        tx.scmProduct.findFirst({
          where: { id: productId, organizationId: org },
        }),
        tx.scmWarehouse.findFirst({
          where: { id: warehouseId, organizationId: org },
        }),
        tx.scmStockBalance.findUnique({
          where: { productId_warehouseId: { productId, warehouseId } },
        }),
      ]);
      if (!product) throw rule("Product not found.", "QC_SOURCE");
      if (!warehouse) throw rule("Warehouse not found.", "QC_SOURCE");
      const available = balance
        ? num(balance.onHand) - num(balance.reserved)
        : 0;
      if (qty > available) {
        throw rule(
          `Only ${Math.max(0, available)} available for this product at this warehouse.`,
          "QC_QTY",
        );
      }
      return {
        sourceId: productId,
        sourceNumber: product.productCode,
        warehouseId,
        items: [
          {
            productId,
            productCode: product.productCode,
            productName: product.name,
            sourceQty: qty,
            warehouseId,
          },
        ],
        emptyMessage: "",
      };
    }

    const sourceId = need(dto.sourceId, "Source document");

    if (dto.inspectionType === "INCOMING") {
      const grn = await tx.scmGoodsReceipt.findFirst({
        where: { id: sourceId, organizationId: org },
        include: {
          items: { include: { product: true }, orderBy: { id: "asc" } },
        },
      });
      if (!grn) throw rule("GRN not found.", "QC_SOURCE");
      const items: ItemSeed[] = [];
      for (const it of grn.items) {
        if (num(it.acceptedQuantity) <= 0) continue;
        const batch = it.batchNumber
          ? await tx.scmStockBatch.findFirst({
              where: {
                organizationId: org,
                batchNumber: it.batchNumber,
                productId: it.productId,
                warehouseId: grn.warehouseId,
              },
            })
          : null;
        items.push({
          productId: it.productId,
          productCode: it.product.productCode,
          productName: it.productNameSnapshot,
          sourceLineId: it.id,
          batchId: batch?.id ?? null,
          batchNumber: it.batchNumber,
          serialNumbers: it.serialNumbers,
          orderedQty: num(it.orderedQuantity),
          sourceQty: num(it.acceptedQuantity),
          unitCost: num(it.unitCost),
          warehouseId: grn.warehouseId,
          locationId: grn.locationId,
        });
      }
      return {
        sourceId,
        sourceNumber: grn.grnNumber,
        supplierId: grn.supplierId,
        supplierName: grn.vendorNameSnapshot,
        warehouseId: grn.warehouseId,
        locationId: grn.locationId,
        items,
        emptyMessage: "This GRN has no accepted quantity to inspect.",
      };
    }

    if (dto.inspectionType === "CUSTOMER_RETURN") {
      const ret = await tx.scmReturn.findFirst({
        where: {
          id: sourceId,
          organizationId: org,
          returnType: "CUSTOMER_RETURN",
        },
        include: { items: { orderBy: { lineNo: "asc" } } },
      });
      if (!ret) throw rule("Customer return not found.", "QC_SOURCE");
      if (!["RECEIVED", "INSPECTION_PENDING"].includes(ret.status)) {
        throw rule(
          "Only received returns can be quality-inspected.",
          "QC_SOURCE",
        );
      }
      const items: ItemSeed[] = ret.items
        .map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          sourceLineId: it.id,
          batchId: it.batchId,
          batchNumber: it.batchNumber,
          serialNumbers: it.serialNumbers,
          orderedQty: num(it.requestedQty),
          sourceQty:
            it.receivedReturnQty === null
              ? num(it.requestedQty)
              : num(it.receivedReturnQty),
          unitCost: it.unitCost === null ? null : num(it.unitCost),
          warehouseId: it.warehouseId || ret.warehouseId,
          locationId: it.locationId,
        }))
        .filter((it) => it.sourceQty > 0);
      return {
        sourceId,
        sourceNumber: ret.returnNumber,
        customerId: ret.customerId,
        customerName: ret.customerName,
        warehouseId: ret.warehouseId,
        items,
        emptyMessage: "This return has no received quantity to inspect.",
      };
    }

    const f = await tx.scmFulfillment.findFirst({
      where: { id: sourceId, organizationId: org },
      include: { items: { orderBy: { lineNo: "asc" } } },
    });
    if (!f) throw rule("Fulfillment not found.", "QC_SOURCE");
    if (["CANCELLED", "FULFILLED"].includes(f.status)) {
      throw rule("Pre-dispatch QC needs an open fulfillment.", "QC_SOURCE");
    }
    const items: ItemSeed[] = f.items
      .map((it) => ({
        productId: it.productId,
        productCode: it.itemCode,
        productName: it.itemDescription,
        sourceLineId: it.id,
        orderedQty: num(it.orderedQty),
        sourceQty:
          num(it.reservedQty) || num(it.issuedQty) || num(it.orderedQty),
        warehouseId: f.warehouseId,
      }))
      .filter((it) => it.sourceQty > 0);
    return {
      sourceId,
      sourceNumber: f.fulfillmentNumber,
      customerId: f.customerId,
      customerName: f.customerName,
      warehouseId: f.warehouseId,
      items,
      emptyMessage:
        "This fulfillment has no reserved/issued quantity to inspect.",
    };
  }

  // ---- lifecycle --------------------------------------------------------------

  private async lock(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`SELECT id FROM scm.quality_inspections WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
    return tx.scmQualityInspection.findFirst({
      where: tenantWhere(scope, { id }),
      include: { items: { orderBy: { lineNo: "asc" } } },
    });
  }

  @OrgScoped()
  async start(
    scope: OrgScope,
    id: number,
    inspectorName: string | undefined,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const insp = await this.lock(tx, scope, id);
      if (!insp) return null;
      if (!inspectionStatusesLeadingTo("IN_PROGRESS").includes(insp.status)) {
        throw new InvalidStateTransitionException(
          "Inspection",
          insp.status,
          "IN_PROGRESS",
        );
      }
      const name =
        inspectorName?.trim() ||
        (await actorName(tx, scope.organizationId, actorId));
      const after = await tx.scmQualityInspection.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
          inspectorId: actorId,
          inspectorName: name,
        },
        include: { items: { orderBy: { lineNo: "asc" } } },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: id,
        action: "status_change",
        before: { status: insp.status },
        after: { status: "IN_PROGRESS", inspector: name },
      });
      return after;
    });
  }

  /** Nothing posts before completion, and a completed inspection cannot be
   * cancelled, so the status guard is the whole check. */
  @OrgScoped()
  async cancel(scope: OrgScope, id: number, reason: string, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const insp = await this.lock(tx, scope, id);
      if (!insp) return null;
      if (!inspectionStatusesLeadingTo("CANCELLED").includes(insp.status)) {
        throw new InvalidStateTransitionException(
          "Inspection",
          insp.status,
          "CANCELLED",
        );
      }
      const after = await tx.scmQualityInspection.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledBy: actorId,
          cancelledAt: new Date(),
          cancellationReason: reason || "Cancelled by user",
        },
        include: { items: { orderBy: { lineNo: "asc" } } },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: id,
        action: "status_change",
        before: { status: insp.status },
        after: { status: "CANCELLED" },
        reason,
      });
      return after;
    });
  }

  /** Validates and writes one line's result. */
  @OrgScoped()
  async recordItemResult(
    scope: OrgScope,
    id: number,
    itemId: number,
    dto: RecordItemResultDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const insp = await this.lock(tx, scope, id);
      if (!insp) return null;
      if (insp.status !== "IN_PROGRESS") {
        throw rule(
          `Inspection is ${label(insp.status)}, not In Progress.`,
          "QC_STATE",
        );
      }
      const item = insp.items.find((i) => i.id === itemId);
      if (!item) return null;
      if (dto.inspectedQuantity > num(item.sourceQty)) {
        throw rule(
          `Inspected quantity (${dto.inspectedQuantity}) cannot exceed the source quantity (${num(item.sourceQty)}).`,
          "QC_QTY",
        );
      }
      if (item.batchId) {
        const batch = await tx.scmStockBatch.findFirst({
          where: { id: item.batchId, organizationId: scope.organizationId },
        });
        if (batch && dto.inspectedQuantity > num(batch.quantity)) {
          throw rule(
            `Inspected quantity (${dto.inspectedQuantity}) exceeds the batch's on-hand quantity (${num(batch.quantity)}).`,
            "QC_QTY",
          );
        }
      }
      const result = deriveItemResult(
        dto.acceptedQuantity,
        dto.rejectedQuantity,
        dto.inspectedQuantity,
        !!dto.manualHold,
      );
      if (dto.disposition && !isValidDisposition(result, dto.disposition)) {
        throw rule(
          `${label(dto.disposition)} is not a valid disposition for a ${label(result)} result.`,
          "QC_DISPOSITION",
        );
      }
      if (dto.defectCode) {
        const defect = await tx.scmQualityDefect.findFirst({
          where: {
            organizationId: scope.organizationId,
            defectCode: dto.defectCode,
          },
        });
        if (!defect) {
          throw rule(`Unknown defect code ${dto.defectCode}.`, "QC_DEFECT");
        }
      }

      let checkpointResults: Prisma.InputJsonValue = [];
      if (dto.checkpointResults?.length) {
        const template = insp.templateId
          ? await tx.scmQualityTemplate.findFirst({
              where: {
                id: insp.templateId,
                organizationId: scope.organizationId,
              },
            })
          : null;
        const known = new Map(
          ((template?.checkpoints ?? []) as unknown as StoredCheckpoint[]).map(
            (c) => [c.checkpointId, c],
          ),
        );
        checkpointResults = dto.checkpointResults.map((r) => {
          const cp = known.get(r.checkpointId);
          if (!cp) {
            throw rule(
              `Checkpoint ${r.checkpointId} is not part of this inspection's template.`,
              "QC_CHECKPOINT",
            );
          }
          return {
            checkpointId: cp.checkpointId,
            name: cp.name,
            required: cp.required,
            result: r.result,
            observedValue: r.observedValue ?? null,
            notes: r.notes ?? null,
            defectCode: r.defectCode ?? null,
          };
        });
      }

      const after = await tx.scmQualityInspectionItem.update({
        where: { id: itemId },
        data: {
          inspectedQty: dto.inspectedQuantity,
          acceptedQty: dto.acceptedQuantity,
          rejectedQty: dto.rejectedQuantity,
          inspectionResult: result,
          condition: dto.condition ?? null,
          defectCode: dto.defectCode ?? null,
          defectDescription: dto.defectDescription?.trim() || null,
          disposition: dto.disposition ?? null,
          notes: dto.notes?.trim() || null,
          checkpointResults,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: id,
        action: "record_result",
        after: {
          product: item.productCode,
          result,
          disposition: dto.disposition ?? null,
        },
      });
      return after;
    });
  }

  // ---- complete ---------------------------------------------------------------

  /** Every check that can fail, before anything posts. Returns the
   * HIGH/CRITICAL defects needing attention. */
  private async validateCompletion(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    insp: NonNullable<Awaited<ReturnType<InspectionsRepository["lock"]>>>,
  ) {
    const org = scope.organizationId;
    const template = insp.templateId
      ? await tx.scmQualityTemplate.findFirst({
          where: { id: insp.templateId, organizationId: org },
        })
      : null;
    const required = (
      (template?.checkpoints ?? []) as unknown as StoredCheckpoint[]
    ).filter((c) => c.required);
    const defects = await tx.scmQualityDefect.findMany({
      where: { organizationId: org },
    });
    const defectByCode = new Map(defects.map((d) => [d.defectCode, d]));
    const cumulative =
      insp.inspectionType === "INCOMING" ||
      insp.inspectionType === "CUSTOMER_RETURN";
    const peers = await tx.scmQualityInspection.findMany({
      where: {
        organizationId: org,
        id: { not: insp.id },
        sourceType: insp.sourceType,
        sourceId: insp.sourceId,
        status: cumulative
          ? { not: "CANCELLED" }
          : { in: [...OPEN_INSPECTION_STATUSES] },
      },
      include: { items: true },
    });
    const critical: string[] = [];

    for (const item of insp.items) {
      const code = item.productCode;
      if (!item.inspectionResult) {
        throw rule(
          `${code}: record an inspection result before completing.`,
          "QC_INCOMPLETE",
        );
      }
      const result = item.inspectionResult as ItemResult;
      if (result !== "PASS" && !item.disposition) {
        throw rule(
          `${code}: a disposition is required for a ${label(result)} result.`,
          "QC_DISPOSITION",
        );
      }
      if (item.disposition && !isValidDisposition(result, item.disposition)) {
        throw rule(
          `${code}: ${label(item.disposition)} is not valid for a ${label(result)} result.`,
          "QC_DISPOSITION",
        );
      }
      const done = new Set(
        (
          (item.checkpointResults ?? []) as unknown as {
            checkpointId: string;
          }[]
        ).map((c) => c.checkpointId),
      );
      const missing = required.find((c) => !done.has(c.checkpointId));
      if (missing) {
        throw rule(
          `${code}: complete required checkpoint "${missing.name}" before completing this inspection.`,
          "QC_CHECKPOINT",
        );
      }
      const defect = item.defectCode
        ? defectByCode.get(item.defectCode)
        : undefined;
      if (
        defect &&
        (defect.severity === "HIGH" || defect.severity === "CRITICAL")
      ) {
        if (!item.notes?.trim()) {
          throw rule(
            `${code}: a review note is required for a ${defect.severity} defect (${item.defectCode}).`,
            "QC_NOTE",
          );
        }
        critical.push(`${code} (${item.defectCode})`);
      }

      const sameLine = (oi: {
        sourceLineId: number | null;
        productId: number;
      }) =>
        item.sourceLineId !== null
          ? oi.sourceLineId === item.sourceLineId
          : oi.productId === item.productId;
      const priorQty = peers.reduce(
        (s, o) =>
          s +
          o.items
            .filter(sameLine)
            .reduce((q, oi) => q + num(oi.inspectedQty), 0),
        0,
      );
      let limit = num(item.sourceQty);
      if (insp.inspectionType === "INVENTORY") {
        const balance = item.warehouseId
          ? await tx.scmStockBalance.findUnique({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: item.warehouseId,
                },
              },
            })
          : null;
        limit = Math.min(
          limit,
          balance ? num(balance.onHand) - num(balance.reserved) : 0,
        );
      }
      if (priorQty + num(item.inspectedQty) > limit + 1e-9) {
        throw rule(
          `${code}: ${priorQty + num(item.inspectedQty)} would be under inspection, but only ${Math.max(0, limit)} is available.`,
          "QC_QTY",
        );
      }
      if (cumulative) {
        for (const sn of item.serialNumbers) {
          const dupe = peers.find(
            (o) =>
              o.status === "COMPLETED" &&
              o.items.some((oi) => oi.serialNumbers.includes(sn)),
          );
          if (dupe) {
            throw rule(
              `Serial ${sn} was already inspected in ${dupe.inspectionNumber}.`,
              "QC_SERIAL",
            );
          }
        }
      }
      if (
        insp.inspectionType !== "CUSTOMER_RETURN" &&
        item.disposition &&
        STOCK_OUT_DISPOSITIONS.has(item.disposition)
      ) {
        const qty = dispositionQuantity({
          inspectionResult: item.inspectionResult,
          inspectedQty: num(item.inspectedQty),
          rejectedQty: num(item.rejectedQty),
        });
        if (!(qty > 0) || qty > num(item.sourceQty)) {
          throw rule(
            `${code}: ${label(item.disposition)} quantity must be between 1 and ${num(item.sourceQty)}.`,
            "QC_QTY",
          );
        }
        if (!(item.warehouseId || insp.warehouseId)) {
          throw rule(
            `${code}: a warehouse is required to post a ${label(item.disposition)} disposition.`,
            "QC_WAREHOUSE",
          );
        }
      }
    }
    return critical;
  }

  /** Moves one failed/held line out of sellable stock: QUARANTINE (+ a
   * quarantine record) for QUARANTINE/REJECT/REWORK, or DAMAGE for
   * DAMAGED/SCRAP. */
  private async postLineDisposition(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    insp: NonNullable<Awaited<ReturnType<InspectionsRepository["lock"]>>>,
    item: NonNullable<
      Awaited<ReturnType<InspectionsRepository["lock"]>>
    >["items"][number],
    actorId: number,
  ) {
    const org = scope.organizationId;
    const disposition = item.disposition as string;
    const quarantine = disposition !== "DAMAGED" && disposition !== "SCRAP";
    const warehouseId = (item.warehouseId ?? insp.warehouseId) as number;
    const quantity = dispositionQuantity({
      inspectionResult: item.inspectionResult,
      inspectedQty: num(item.inspectedQty),
      rejectedQty: num(item.rejectedQty),
    });
    const key = `QC_INSPECTION:${insp.id}:${item.id}`;
    const serials = await this.stock.loadAndValidateSerials(
      tx,
      org,
      item.serialNumbers,
      item.productId,
    );

    if (insp.inspectionType === "PRE_DISPATCH") {
      // The stock is reserved for this fulfillment, and QUARANTINE/DAMAGE may
      // only take unreserved stock — shrink the reservation first.
      await this.fulfillments.shrinkReservation(
        tx,
        scope,
        insp.sourceId,
        item.productId,
        quantity,
        actorId,
      );
    }

    const posted = await this.stock.post(tx, {
      organizationId: org,
      productId: item.productId,
      warehouseId,
      locationId: item.locationId,
      batchId: item.batchId,
      transactionType: quarantine ? "QUARANTINE" : "DAMAGE",
      referenceType: "QC_INSPECTION",
      referenceId: insp.id,
      referenceNumber: insp.inspectionNumber,
      quantityOut: quantity,
      unitCost: item.unitCost === null ? null : num(item.unitCost),
      notes: item.notes,
      createdBy: actorId,
      idempotencyKey: key,
    });
    await this.stock.setSerialStatuses(
      tx,
      serials.map((s) => s.id),
      quarantine ? "QUARANTINED" : "DAMAGED",
      insp.inspectionNumber,
      { warehouseId },
    );
    if (item.batchId) {
      const batch = await this.stock.loadAndValidateBatch(
        tx,
        org,
        item.batchId,
        item.productId,
      );
      await this.stock.setBatchStatusIfWhole(
        tx,
        batch,
        quantity,
        quarantine ? "QUARANTINED" : "BLOCKED",
      );
    }

    let quarantineRecordId: number | null = null;
    if (quarantine) {
      const record = await this.quarantine.createRecord(
        tx,
        org,
        {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          serialNumbers: item.serialNumbers,
          warehouseId,
          locationId: item.locationId,
          quantity,
          sourceType: insp.sourceType,
          sourceId: insp.sourceId,
          sourceNumber: insp.sourceNumber,
          inspectionId: insp.id,
          inspectionNumber: insp.inspectionNumber,
          defectCode: item.defectCode,
          reason:
            item.defectDescription || item.notes || `QC ${label(disposition)}`,
        },
        actorId,
      );
      quarantineRecordId = record.id;
    }
    await tx.scmQualityInspectionItem.update({
      where: { id: item.id },
      data: { ledgerEntryId: posted.id, quarantineRecordId },
    });
  }

  /** Validates everything first, then claims COMPLETED and posts each
   * stock-affecting line — all in one transaction, so a posting failure
   * leaves the inspection In Progress and retryable. Customer Return
   * inspections never post: the return's own disposition flow does. */
  @OrgScoped()
  async complete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const insp = await this.lock(tx, scope, id);
      if (!insp) return null;
      if (insp.status !== "IN_PROGRESS") {
        throw rule(
          `Inspection is ${label(insp.status)}, not In Progress.`,
          "QC_STATE",
        );
      }
      const critical = await this.validateCompletion(tx, scope, insp);
      const overall = computeOverallResult(insp.items);

      if (insp.inspectionType !== "CUSTOMER_RETURN") {
        for (const item of insp.items) {
          if (
            item.disposition &&
            STOCK_OUT_DISPOSITIONS.has(item.disposition)
          ) {
            await this.postLineDisposition(tx, scope, insp, item, actorId);
          }
        }
      }
      const after = await tx.scmQualityInspection.update({
        where: { id },
        data: { status: "COMPLETED", result: overall, completedAt: new Date() },
        include: { items: { orderBy: { lineNo: "asc" } } },
      });
      if (insp.inspectionType === "CUSTOMER_RETURN") {
        await tx.scmReturn.update({
          where: { id: insp.sourceId },
          data: { qualityInspectionId: insp.id },
        });
      }
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: id,
        action: "complete",
        before: { status: "IN_PROGRESS" },
        after: { status: "COMPLETED", result: overall, critical },
      });
      return after;
    });
  }

  /** A COMPLETED inspection has already posted ledger/quarantine entries. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmQualityInspection.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      if (row.status === "COMPLETED") {
        throw new BusinessRuleViolationException(
          "Cannot delete: this inspection has already posted ledger/quarantine entries.",
          "INSPECTION_COMPLETED",
        );
      }
      await tx.scmQualityInspection.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_quality_inspection",
        entityId: id,
        action: "delete",
        before: {
          inspectionNumber: row.inspectionNumber,
          status: row.status,
          by: actorId,
        },
      });
      return true;
    });
  }
}
