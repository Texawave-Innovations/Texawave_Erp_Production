import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CodeFormat } from "../master-list/code-formats.rules.js";
import {
  type DocumentFilter,
  issueDocumentNumber,
  liveLines,
  searchWhere,
} from "./document-repository.helpers.js";
import type { CustomerSnapshot } from "./documents.rules.js";
import type { DcStatus } from "./dto/delivery-challan.dto.js";

const ENTITY_TYPE = "sales_delivery_challan";

const INCLUDE = {
  lines: liveLines,
  sourceInvoice: { select: { id: true, invoiceNumber: true } },
} satisfies Prisma.SalesDeliveryChallanInclude;

type DcRow = Prisma.SalesDeliveryChallanGetPayload<{
  include: typeof INCLUDE;
}>;

export interface DcLine {
  lineNo: number;
  description: string;
  hsnCode: string | null;
  quantity: number;
}

export interface DeliveryChallanData {
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  dcDate: Date;
  status: DcStatus;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  notes: string | null;
  customFields: Record<string, unknown>;
  lines: DcLine[];
}

export interface DeliveryChallanFilter extends DocumentFilter {
  status?: DcStatus | undefined;
}

function toView(row: DcRow) {
  const { lines, ...rest } = row;
  return {
    ...rest,
    itemsCount: lines.length,
    lines: lines.map((l) => ({
      lineNo: l.lineNo,
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: l.quantity,
    })),
  };
}

export type DeliveryChallanView = ReturnType<typeof toView>;

function snapshot(row: DcRow) {
  return {
    dcNumber: row.dcNumber,
    dcDate: row.dcDate,
    customerId: row.customerId,
    status: row.status,
    sourceInvoiceId: row.sourceInvoiceId,
    lines: row.lines.length,
  };
}

function columns(data: Omit<DeliveryChallanData, "lines">) {
  const { customerSnapshot, customFields, ...rest } = data;
  return {
    ...rest,
    customerSnapshot: customerSnapshot as unknown as Prisma.InputJsonValue,
    customFields: customFields as Prisma.InputJsonValue,
  };
}

function lineRows(
  organizationId: number,
  deliveryChallanId: number,
  lines: readonly DcLine[],
  actorId: number,
) {
  return lines.map((l) => ({
    ...l,
    organizationId,
    deliveryChallanId,
    createdBy: actorId,
    updatedBy: actorId,
  }));
}

/** The only place `PrismaService` is called for delivery challans. */
@Injectable()
export class DeliveryChallansRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: DeliveryChallanFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SalesDeliveryChallanWhereInput>(scope, {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.from || filter.to
        ? {
            dcDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...searchWhere(filter.search, "dcNumber"),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesDeliveryChallan.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { dcDate: pagination.order ?? "desc" },
          { id: pagination.order ?? "desc" },
        ],
      }),
      this.prisma.salesDeliveryChallan.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.salesDeliveryChallan.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** `sourceInvoiceId` set → created from that tax invoice, which must
   * still be live (checked under its row lock); null if it is not. */
  @OrgScoped()
  async create(
    scope: OrgScope,
    input: DeliveryChallanData,
    number: { format: CodeFormat; fiscalYear: string },
    actorId: number,
    sourceInvoiceId: number | null = null,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      if (sourceInvoiceId !== null) {
        await tx.$queryRaw`
          SELECT id FROM sales.invoices
           WHERE id = ${sourceInvoiceId} AND organization_id = ${scope.organizationId}
           FOR UPDATE`;
        const source = await tx.salesInvoice.findFirst({
          where: tenantWhere(scope, {
            id: sourceInvoiceId,
            deletedAt: null,
          }),
          select: { id: true },
        });
        if (!source) return null;
      }
      const dcNumber = await issueDocumentNumber(
        tx,
        scope.organizationId,
        "delivery_challan",
        number.format,
        number.fiscalYear,
      );
      const created = await tx.salesDeliveryChallan.create({
        data: {
          ...columns(data),
          dcNumber,
          sourceInvoiceId,
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.salesDeliveryChallanLine.createMany({
        data: lineRows(scope.organizationId, created.id, lines, actorId),
      });
      const row = await tx.salesDeliveryChallan.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** null when not in scope (→ 404). */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    input: DeliveryChallanData,
    actorId: number,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return null;
      await tx.salesDeliveryChallan.update({
        where: { id },
        data: { ...columns(data), updatedBy: actorId },
      });
      await tx.salesDeliveryChallanLine.updateMany({
        where: { deliveryChallanId: id, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.salesDeliveryChallanLine.createMany({
        data: lineRows(scope.organizationId, id, lines, actorId),
      });
      const after = await tx.salesDeliveryChallan.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return false;
      const now = new Date();
      await tx.salesDeliveryChallan.update({
        where: { id },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.salesDeliveryChallanLine.updateMany({
        where: { deliveryChallanId: id, deletedAt: null },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
      });
      return true;
    });
  }

  private async lockLive(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.delivery_challans
       WHERE id = ${id} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    return tx.salesDeliveryChallan.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
  }
}
