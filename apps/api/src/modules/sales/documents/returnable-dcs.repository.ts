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
  issueDocumentNumber,
  liveLines,
} from "./document-repository.helpers.js";
import type { CustomerSnapshot } from "./documents.rules.js";
import type { RdcStatus } from "./dto/returnable-dc.dto.js";

const ENTITY_TYPE = "sales_returnable_dc";
const DAY_MS = 86_400_000;

const INCLUDE = {
  lines: liveLines,
} satisfies Prisma.SalesReturnableDcInclude;

type RdcRow = Prisma.SalesReturnableDcGetPayload<{ include: typeof INCLUDE }>;

export interface RdcLine {
  lineNo: number;
  description: string;
  quantity: number;
}

export interface ReturnableDcData {
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  issueDate: Date;
  purpose: string;
  expectedReturnDate: Date;
  takenBy: string | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  notes: string | null;
  customFields: Record<string, unknown>;
  lines: RdcLine[];
}

export interface ReturnableDcFilter {
  search?: string | undefined;
  customerId?: number | undefined;
  status?: RdcStatus | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

function toView(row: RdcRow, today: Date) {
  const { lines, ...rest } = row;
  const late = Math.floor(
    (today.getTime() - row.expectedReturnDate.getTime()) / DAY_MS,
  );
  return {
    ...rest,
    /** Days past the expected return date while still out, else null. */
    overdueDays: row.status === "ISSUED" && late >= 1 ? late : null,
    itemsCount: lines.length,
    lines: lines.map((l) => ({
      lineNo: l.lineNo,
      description: l.description,
      quantity: l.quantity,
    })),
  };
}

export type ReturnableDcView = ReturnType<typeof toView>;

function snapshot(row: RdcRow) {
  return {
    rdcNumber: row.rdcNumber,
    customerId: row.customerId,
    issueDate: row.issueDate,
    purpose: row.purpose,
    expectedReturnDate: row.expectedReturnDate,
    takenBy: row.takenBy,
    status: row.status,
    returnedDate: row.returnedDate,
    lines: row.lines.length,
  };
}

function columns(data: Omit<ReturnableDcData, "lines">) {
  const { customerSnapshot, customFields, ...rest } = data;
  return {
    ...rest,
    customerSnapshot: customerSnapshot as unknown as Prisma.InputJsonValue,
    customFields: customFields as Prisma.InputJsonValue,
  };
}

function lineRows(
  organizationId: number,
  returnableDcId: number,
  lines: readonly RdcLine[],
  actorId: number,
) {
  return lines.map((l) => ({
    ...l,
    organizationId,
    returnableDcId,
    createdBy: actorId,
    updatedBy: actorId,
  }));
}

function searchWhere(
  search: string | undefined,
): Prisma.SalesReturnableDcWhereInput {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" } as const;
  return {
    OR: [
      { rdcNumber: contains },
      { purpose: contains },
      { takenBy: contains },
      { preparedBy: contains },
      { customer: { companyName: contains } },
      { customer: { customerCode: contains } },
    ],
  };
}

/** The only place `PrismaService` is called for returnable delivery
 * challans. Every write is one transaction with its audit row. */
@Injectable()
export class ReturnableDcsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ReturnableDcFilter,
    pagination: PaginationDto,
    today: Date,
  ) {
    const where = tenantWhere<Prisma.SalesReturnableDcWhereInput>(scope, {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.from || filter.to
        ? {
            issueDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...searchWhere(filter.search),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesReturnableDc.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { issueDate: pagination.order ?? "desc" },
          { id: pagination.order ?? "desc" },
        ],
      }),
      this.prisma.salesReturnableDc.count({ where }),
    ]);
    return { items: rows.map((r) => toView(r, today)), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number, today: Date) {
    const row = await this.prisma.salesReturnableDc.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row, today) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: ReturnableDcData,
    number: { format: CodeFormat; fiscalYear: string },
    actorId: number,
    today: Date,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const rdcNumber = await issueDocumentNumber(
        tx,
        scope.organizationId,
        "returnable_dc",
        number.format,
        number.fiscalYear,
      );
      const created = await tx.salesReturnableDc.create({
        data: {
          ...columns(data),
          rdcNumber,
          status: "ISSUED",
          organizationId: scope.organizationId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.salesReturnableDcLine.createMany({
        data: lineRows(scope.organizationId, created.id, lines, actorId),
      });
      const row = await tx.salesReturnableDc.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row, today);
    });
  }

  /**
   * null when not in scope (→ 404). `check` runs on the locked row before
   * the change (e.g. "not returned yet") and may throw.
   */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    input: ReturnableDcData,
    actorId: number,
    today: Date,
    check: (current: { status: string; rdcNumber: string }) => void,
  ) {
    const { lines, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return null;
      check(before);
      await tx.salesReturnableDc.update({
        where: { id },
        data: { ...columns(data), updatedBy: actorId },
      });
      await tx.salesReturnableDcLine.updateMany({
        where: { returnableDcId: id, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.salesReturnableDcLine.createMany({
        data: lineRows(scope.organizationId, id, lines, actorId),
      });
      return this.finish(tx, id, before, "update", today);
    });
  }

  /** ISSUED ⇄ RETURNED. null when not in scope; `check` as in update(). */
  @OrgScoped()
  async setStatus(
    scope: OrgScope,
    id: number,
    status: RdcStatus,
    returnedDate: Date | null,
    actorId: number,
    today: Date,
    check: (current: {
      status: string;
      rdcNumber: string;
      issueDate: Date;
    }) => void,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return null;
      check(before);
      await tx.salesReturnableDc.update({
        where: { id },
        data: { status, returnedDate, updatedBy: actorId },
      });
      return this.finish(
        tx,
        id,
        before,
        status === "RETURNED" ? "mark_returned" : "reopen",
        today,
      );
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, scope, id);
      if (!before) return false;
      const now = new Date();
      await tx.salesReturnableDc.update({
        where: { id },
        data: { deletedAt: now, updatedBy: actorId },
      });
      await tx.salesReturnableDcLine.updateMany({
        where: { returnableDcId: id, deletedAt: null },
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

  private async finish(
    tx: Prisma.TransactionClient,
    id: number,
    before: RdcRow,
    action: string,
    today: Date,
  ) {
    const after = await tx.salesReturnableDc.findUniqueOrThrow({
      where: { id },
      include: INCLUDE,
    });
    await this.audit.write(tx, {
      entityType: ENTITY_TYPE,
      entityId: id,
      action,
      before: snapshot(before),
      after: snapshot(after),
    });
    return toView(after, today);
  }

  private async lockLive(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.returnable_delivery_challans
       WHERE id = ${id} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    return tx.salesReturnableDc.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
  }
}
