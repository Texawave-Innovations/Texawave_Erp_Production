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
import { StockPostingService } from "../inventory/stock-posting.service.js";
import { OPEN_QUARANTINE_STATUSES } from "./quality.helpers.js";

export interface NewQuarantineRecord {
  productId: number;
  productCode: string;
  productName: string;
  batchId?: number | null | undefined;
  batchNumber?: string | null | undefined;
  serialNumbers?: string[] | undefined;
  warehouseId: number;
  locationId?: number | null | undefined;
  quantity: number;
  sourceType: string;
  sourceId?: number | null | undefined;
  sourceNumber?: string | null | undefined;
  inspectionId?: number | null | undefined;
  inspectionNumber?: string | null | undefined;
  defectCode?: string | null | undefined;
  reason?: string | null | undefined;
}

const num = (d: Prisma.Decimal | number) => Number(d);

@Injectable()
export class QuarantineRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly stock: StockPostingService,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: { q?: string | undefined; status?: string | undefined },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmQuarantineRecordWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { productCode: { contains: f.q, mode: "insensitive" } },
              { productName: { contains: f.q, mode: "insensitive" } },
              { batchNumber: { contains: f.q, mode: "insensitive" } },
              { sourceNumber: { contains: f.q, mode: "insensitive" } },
              { inspectionNumber: { contains: f.q, mode: "insensitive" } },
              { serialNumbers: { has: f.q } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmQuarantineRecord.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.scmQuarantineRecord.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmQuarantineRecord.findFirst({
      where: tenantWhere(scope, { id }),
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
  }

  /** Adds stock to the quarantine register. The caller must already have
   * posted the QUARANTINE ledger entry that moved the quantity into the
   * quarantine bucket (same transaction). */
  async createRecord(
    tx: Prisma.TransactionClient,
    organizationId: number,
    input: NewQuarantineRecord,
    actorId: number,
  ) {
    const created = await tx.scmQuarantineRecord.create({
      data: {
        organizationId,
        productId: input.productId,
        productCode: input.productCode,
        productName: input.productName,
        batchId: input.batchId ?? null,
        batchNumber: input.batchNumber ?? null,
        serialNumbers: input.serialNumbers ?? [],
        warehouseId: input.warehouseId,
        locationId: input.locationId ?? null,
        quantity: input.quantity,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        sourceNumber: input.sourceNumber ?? null,
        inspectionId: input.inspectionId ?? null,
        inspectionNumber: input.inspectionNumber ?? null,
        defectCode: input.defectCode ?? null,
        reason: input.reason ?? null,
        status: "QUARANTINED",
        createdBy: actorId,
      },
    });
    await this.audit.write(tx, {
      entityType: "scm_quarantine",
      entityId: created.id,
      action: "create",
      after: {
        product: input.productCode,
        quantity: input.quantity,
        source: input.inspectionNumber ?? input.sourceNumber ?? null,
      },
    });
    return created;
  }

  @OrgScoped()
  async review(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.scmQuarantineRecord.updateMany({
        where: tenantWhere(scope, { id, status: "QUARANTINED" }),
        data: {
          status: "UNDER_REVIEW",
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0)
        return this.explain(tx, scope, id, "UNDER_REVIEW");
      await this.audit.write(tx, {
        entityType: "scm_quarantine",
        entityId: id,
        action: "status_change",
        after: { status: "UNDER_REVIEW" },
      });
      return tx.scmQuarantineRecord.findUniqueOrThrow({ where: { id } });
    });
  }

  /** Distinguishes "not found" (null) from "wrong state" (409). */
  private async explain(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
    to: string,
  ) {
    const current = await tx.scmQuarantineRecord.findFirst({
      where: tenantWhere(scope, { id }),
      select: { status: true },
    });
    if (!current) return null;
    throw new InvalidStateTransitionException("Quarantine", current.status, to);
  }

  /** Controlled release back to sellable on-hand via QC_RELEASE. Mutually
   * exclusive with reject: the status is claimed atomically, and the claim
   * rolls back with the posting if anything fails. */
  @OrgScoped()
  async release(
    scope: OrgScope,
    id: number,
    notes: string | undefined,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.scmQuarantineRecord.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!record) return null;
      const claimed = await tx.scmQuarantineRecord.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...OPEN_QUARANTINE_STATUSES] },
        },
        data: {
          status: "RELEASED",
          releasedBy: actorId,
          releasedAt: new Date(),
          ...(notes ? { notes } : {}),
        },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Quarantine",
          record.status,
          "RELEASED",
        );
      }
      const serials = await this.stock.loadAndValidateSerials(
        tx,
        scope.organizationId,
        record.serialNumbers,
        record.productId,
      );
      const batch = record.batchId
        ? await this.stock.loadAndValidateBatch(
            tx,
            scope.organizationId,
            record.batchId,
            record.productId,
          )
        : null;
      const reference =
        record.inspectionNumber ?? record.sourceNumber ?? `QUARANTINE-${id}`;
      const posted = await this.stock.post(tx, {
        organizationId: scope.organizationId,
        productId: record.productId,
        warehouseId: record.warehouseId,
        locationId: record.locationId,
        batchId: record.batchId,
        transactionType: "QC_RELEASE",
        referenceType: "QC_QUARANTINE_RELEASE",
        referenceId: id,
        referenceNumber: reference,
        quantityIn: num(record.quantity),
        notes: notes ?? null,
        createdBy: actorId,
        idempotencyKey: `QC_QUARANTINE_RELEASE:${id}`,
      });
      await this.stock.setSerialStatuses(
        tx,
        serials.map((s) => s.id),
        "AVAILABLE",
        reference,
      );
      if (batch && batch.status === "QUARANTINED") {
        const others = await tx.scmQuarantineRecord.count({
          where: {
            organizationId: scope.organizationId,
            batchId: batch.id,
            id: { not: id },
            status: { in: [...OPEN_QUARANTINE_STATUSES] },
          },
        });
        if (others === 0) {
          await tx.scmStockBatch.update({
            where: { id: batch.id },
            data: { status: "ACTIVE" },
          });
        }
      }
      const after = await tx.scmQuarantineRecord.update({
        where: { id },
        data: { releaseLedgerEntryId: posted.id },
      });
      await this.audit.write(tx, {
        entityType: "scm_quarantine",
        entityId: id,
        action: "release",
        after: { product: record.productCode, quantity: num(record.quantity) },
        reason: notes,
      });
      return after;
    });
  }

  /** Permanent write-off of quarantined stock via QC_REJECT (quarantine
   * bucket -> damaged; on-hand was already reduced by the QUARANTINE post). */
  @OrgScoped()
  async reject(
    scope: OrgScope,
    id: number,
    notes: string | undefined,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.scmQuarantineRecord.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!record) return null;
      const claimed = await tx.scmQuarantineRecord.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...OPEN_QUARANTINE_STATUSES] },
        },
        data: {
          status: "REJECTED",
          rejectedBy: actorId,
          rejectedAt: new Date(),
          ...(notes ? { notes } : {}),
        },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException(
          "Quarantine",
          record.status,
          "REJECTED",
        );
      }
      const serials = await this.stock.loadAndValidateSerials(
        tx,
        scope.organizationId,
        record.serialNumbers,
        record.productId,
      );
      const batch = record.batchId
        ? await this.stock.loadAndValidateBatch(
            tx,
            scope.organizationId,
            record.batchId,
            record.productId,
          )
        : null;
      const reference =
        record.inspectionNumber ?? record.sourceNumber ?? `QUARANTINE-${id}`;
      const posted = await this.stock.post(tx, {
        organizationId: scope.organizationId,
        productId: record.productId,
        warehouseId: record.warehouseId,
        locationId: record.locationId,
        batchId: record.batchId,
        transactionType: "QC_REJECT",
        referenceType: "QC_QUARANTINE_REJECT",
        referenceId: id,
        referenceNumber: reference,
        quantityOut: num(record.quantity),
        notes: notes ?? null,
        createdBy: actorId,
        idempotencyKey: `QC_QUARANTINE_REJECT:${id}`,
      });
      await this.stock.setSerialStatuses(
        tx,
        serials.map((s) => s.id),
        "DAMAGED",
        reference,
      );
      if (batch) {
        await this.stock.setBatchStatusIfWhole(
          tx,
          batch,
          num(record.quantity),
          "BLOCKED",
        );
      }
      const after = await tx.scmQuarantineRecord.update({
        where: { id },
        data: { rejectLedgerEntryId: posted.id },
      });
      await this.audit.write(tx, {
        entityType: "scm_quarantine",
        entityId: id,
        action: "reject",
        after: { product: record.productCode, quantity: num(record.quantity) },
        reason: notes,
      });
      return after;
    });
  }

  /** A released/rejected record has already posted a stock ledger entry. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmQuarantineRecord.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      if (row.status === "RELEASED" || row.status === "REJECTED") {
        throw new BusinessRuleViolationException(
          "Cannot delete: this quarantine record has already posted a stock ledger entry.",
          "QUARANTINE_RESOLVED",
        );
      }
      await tx.scmQuarantineRecord.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_quarantine_record",
        entityId: id,
        action: "delete",
        before: { status: row.status, by: actorId },
      });
      return true;
    });
  }
}
