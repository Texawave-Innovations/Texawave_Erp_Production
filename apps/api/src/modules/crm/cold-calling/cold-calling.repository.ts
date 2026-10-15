import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateCrmColdCallingEntryDto,
  UpdateCrmColdCallingEntryDto,
} from "./dto/cold-calling.dto.js";

const ENTITY_TYPE = "crm_cold_calling_entry";

export interface ColdCallingFilter {
  search?: string | undefined;
  linkedAccountId?: number | undefined;
}

function snapshot(row: {
  companyName: string;
  status: string | null;
  linkedAccountId: number | null;
}) {
  return {
    companyName: row.companyName,
    status: row.status,
    linkedAccountId: row.linkedAccountId,
  };
}

function filterWhere(
  filter: ColdCallingFilter,
): Prisma.CrmColdCallingEntryWhereInput {
  const clauses: Prisma.CrmColdCallingEntryWhereInput[] = [{ deletedAt: null }];
  if (filter.search) {
    clauses.push({
      OR: [
        { companyName: { contains: filter.search, mode: "insensitive" } },
        { prospectName: { contains: filter.search, mode: "insensitive" } },
        { status: { contains: filter.search, mode: "insensitive" } },
      ],
    });
  }
  if (filter.linkedAccountId !== undefined)
    clauses.push({ linkedAccountId: filter.linkedAccountId });
  return { AND: clauses };
}

@Injectable()
export class CrmColdCallingRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ColdCallingFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere(scope, filterWhere(filter));
    const [items, total] = await Promise.all([
      this.prisma.crmColdCallingEntry.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.crmColdCallingEntry.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.crmColdCallingEntry.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateCrmColdCallingEntryDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.crmColdCallingEntry.create({
        data: {
          organizationId: scope.organizationId,
          serialNo: dto.serialNo ?? null,
          callDate: dto.callDate ? new Date(dto.callDate) : null,
          companyName: dto.companyName,
          prospectName: dto.prospectName ?? null,
          designation: dto.designation ?? null,
          status: dto.status ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateCrmColdCallingEntryDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmColdCallingEntry.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmColdCallingEntry.update({
        where: { id },
        data: {
          serialNo:
            dto.serialNo === undefined ? before.serialNo : dto.serialNo || null,
          callDate:
            dto.callDate === undefined
              ? before.callDate
              : dto.callDate
                ? new Date(dto.callDate)
                : null,
          companyName: dto.companyName ?? before.companyName,
          prospectName:
            dto.prospectName === undefined
              ? before.prospectName
              : dto.prospectName || null,
          designation:
            dto.designation === undefined
              ? before.designation
              : dto.designation || null,
          status: dto.status === undefined ? before.status : dto.status || null,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Links this row to an Account (the only non-automatic bridge into the
   * Account.statusTag queues) — matches legacy `handleLinkAccount`'s
   * field-write side. Finding-or-creating the Account itself is the
   * caller's job (reuses the existing Accounts list/create endpoints), same
   * cross-module-call-stays-out-of-the-repository reasoning as
   * `AccountsRepository.changeStatusTag`. */
  @OrgScoped()
  async linkAccount(
    scope: OrgScope,
    id: number,
    accountId: number,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmColdCallingEntry.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const account = await tx.account.findFirst({
        where: {
          id: accountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) return undefined;
      const after = await tx.crmColdCallingEntry.update({
        where: { id },
        data: { linkedAccountId: accountId, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Records which disposition tag a row was routed to — informational
   * only, matches legacy `handleDispositionRecorded`. The Account's actual
   * `statusTag` is changed separately via the existing accounts
   * status-tag endpoint. */
  @OrgScoped()
  async recordDisposition(
    scope: OrgScope,
    id: number,
    dispositionTag: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmColdCallingEntry.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      return tx.crmColdCallingEntry.update({
        where: { id },
        data: { dispositionTag, dispositionAt: new Date(), updatedBy: actorId },
      });
    });
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmColdCallingEntry.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.crmColdCallingEntry.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }
}
