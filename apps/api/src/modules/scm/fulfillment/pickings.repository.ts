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
import { FulfillmentsRepository } from "./fulfillments.repository.js";
import type { RecordPickDto } from "./dto/fulfillment.dto.js";

const include = {
  items: { orderBy: { id: "asc" } },
  warehouse: { select: { id: true, name: true, code: true } },
  fulfillment: { select: { id: true, fulfillmentNumber: true, status: true } },
} satisfies Prisma.ScmPickingInclude;

const num = (d: Prisma.Decimal | number) => Number(d);

@Injectable()
export class PickingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly fulfillments: FulfillmentsRepository,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: {
      q?: string | undefined;
      status?: string | undefined;
      packable?: boolean | undefined;
    },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmPickingWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.packable
        ? {
            status: "COMPLETED",
            stockIssuedAt: null,
            packings: { none: { status: { not: "CANCELLED" } } },
          }
        : {}),
      ...(f.q
        ? {
            OR: [
              { pickNumber: { contains: f.q, mode: "insensitive" } },
              { salesOrderNumber: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmPicking.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { id: "desc" },
        include,
      }),
      this.prisma.scmPicking.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmPicking.findFirst({
      where: tenantWhere(scope, { id }),
      include,
    });
  }

  private async move(
    scope: OrgScope,
    id: number,
    from: readonly string[],
    to: string,
    actorId: number,
    data: Prisma.ScmPickingUncheckedUpdateManyInput = {},
    audit?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scmPicking.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!current) return null;
      if (!from.includes(current.status)) {
        throw new InvalidStateTransitionException(
          "Pick list",
          current.status,
          to,
        );
      }
      const claimed = await tx.scmPicking.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: { in: [...from] },
        },
        data: { status: to, updatedBy: actorId, ...data },
      });
      if (claimed.count === 0) {
        throw new InvalidStateTransitionException("Pick list", "changed", to);
      }
      await this.fulfillments.syncProgress(tx, current.fulfillmentId);
      await this.audit.write(tx, {
        entityType: "scm_picking",
        entityId: id,
        action: audit ?? to.toLowerCase(),
        before: { status: current.status },
        after: { status: to },
      });
      return tx.scmPicking.findUniqueOrThrow({ where: { id }, include });
    });
  }

  @OrgScoped()
  start(scope: OrgScope, id: number, actorId: number) {
    return this.move(
      scope,
      id,
      ["PENDING", "ASSIGNED"],
      "IN_PROGRESS",
      actorId,
      {
        startedAt: new Date(),
      },
      "start",
    );
  }

  @OrgScoped()
  async assign(
    scope: OrgScope,
    id: number,
    pickerName: string,
    actorId: number,
  ) {
    return this.move(
      scope,
      id,
      ["PENDING", "ASSIGNED"],
      "ASSIGNED",
      actorId,
      {
        pickerName,
      },
      "assign",
    );
  }

  @OrgScoped()
  cancel(scope: OrgScope, id: number, actorId: number) {
    return this.move(
      scope,
      id,
      ["PENDING", "ASSIGNED", "IN_PROGRESS", "PARTIALLY_PICKED"],
      "CANCELLED",
      actorId,
      {},
      "cancel",
    );
  }

  /** Records picked quantities. A pick is COMPLETED once everything is picked,
   * or earlier when it is "closed short" (only picked units are issued);
   * otherwise it is PARTIALLY_PICKED / IN_PROGRESS. */
  @OrgScoped()
  async record(
    scope: OrgScope,
    id: number,
    dto: RecordPickDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pick = await tx.scmPicking.findFirst({
        where: tenantWhere(scope, { id }),
        include: { items: true },
      });
      if (!pick) return null;
      if (!["IN_PROGRESS", "PARTIALLY_PICKED"].includes(pick.status)) {
        throw new InvalidStateTransitionException(
          "Pick list",
          pick.status,
          "COMPLETED",
        );
      }
      const byId = new Map(dto.items.map((i) => [i.pickingItemId, i]));
      for (const it of pick.items) {
        const sent = byId.get(it.id);
        if (!sent) continue;
        if (sent.pickedQuantity > num(it.requestedQuantity)) {
          throw new BusinessRuleViolationException(
            `${it.productName}: cannot pick more than requested (${num(it.requestedQuantity)})`,
            "PICK_OVER",
          );
        }
      }
      const picked = pick.items.map((it) => ({
        id: it.id,
        requested: num(it.requestedQuantity),
        picked: byId.get(it.id)?.pickedQuantity ?? num(it.pickedQuantity),
      }));
      const allPicked = picked.every((p) => p.picked >= p.requested);
      const anyPicked = picked.some((p) => p.picked > 0);
      const next =
        allPicked || (dto.closeShort && anyPicked)
          ? "COMPLETED"
          : anyPicked
            ? "PARTIALLY_PICKED"
            : "IN_PROGRESS";
      for (const p of picked) {
        const sent = byId.get(p.id);
        await tx.scmPickingItem.update({
          where: { id: p.id },
          data: {
            pickedQuantity: p.picked,
            ...(sent?.sourceLocationId !== undefined
              ? { sourceLocationId: sent.sourceLocationId }
              : {}),
          },
        });
      }
      await tx.scmPicking.update({
        where: { id },
        data: {
          status: next,
          completedAt: next === "COMPLETED" ? new Date() : null,
          updatedBy: actorId,
        },
      });
      await this.fulfillments.syncProgress(tx, pick.fulfillmentId);
      await this.audit.write(tx, {
        entityType: "scm_picking",
        entityId: id,
        action: "record",
        before: { status: pick.status },
        after: {
          status: next,
          closedShort: !allPicked && next === "COMPLETED",
        },
      });
      return tx.scmPicking.findUniqueOrThrow({ where: { id }, include });
    });
  }

  /** A pick list a packing already references cannot be deleted. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.scmPicking.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!row) return false;
      const packings = await tx.scmPacking.count({ where: { pickingId: id } });
      if (packings > 0) {
        throw new BusinessRuleViolationException(
          "Cannot delete: a packing already references this pick list.",
          "PICKING_HAS_PACKING",
        );
      }
      await tx.scmPicking.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: "scm_picking",
        entityId: id,
        action: "delete",
        before: { pickNumber: row.pickNumber, status: row.status, by: actorId },
      });
      return true;
    });
  }
}
