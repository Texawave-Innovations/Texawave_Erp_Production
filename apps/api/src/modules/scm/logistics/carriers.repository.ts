import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateCarrierDto,
  UpdateCarrierDto,
} from "./dto/logistics.dto.js";

const text = (v: string | undefined, cur: string | null) =>
  v === undefined ? cur : v.trim() || null;

@Injectable()
export class CarriersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    f: { q?: string | undefined; status?: string | undefined },
    page: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ScmCarrierWhereInput>(scope, {
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { carrierCode: { contains: f.q, mode: "insensitive" } },
              { carrierName: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.scmCarrier.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ carrierName: "asc" }, { id: "asc" }],
        include: { _count: { select: { shipments: true } } },
      }),
      this.prisma.scmCarrier.count({ where }),
    ]);
    return { items: rows, total };
  }

  @OrgScoped()
  findOptions(scope: OrgScope) {
    return this.prisma.scmCarrier.findMany({
      where: tenantWhere(scope, { status: "ACTIVE" }),
      orderBy: { carrierName: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmCarrier.findFirst({
      where: tenantWhere(scope, { id }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.scmCarrier.findFirst({
      where: tenantWhere<Prisma.ScmCarrierWhereInput>(scope, {
        carrierCode: { equals: code, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateCarrierDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmCarrier.create({
        data: {
          organizationId: scope.organizationId,
          carrierCode: dto.carrierCode,
          carrierName: dto.carrierName,
          serviceTypes: dto.serviceTypes ?? [],
          contact: text(dto.contact, null),
          phone: text(dto.phone, null),
          email: text(dto.email, null),
          website: text(dto.website, null),
          trackingUrlTemplate: text(dto.trackingUrlTemplate, null),
          status: dto.status ?? "ACTIVE",
          notes: text(dto.notes, null),
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_carrier",
        entityId: created.id,
        action: "create",
        after: { carrierCode: dto.carrierCode, carrierName: dto.carrierName },
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateCarrierDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmCarrier.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;
      const after = await tx.scmCarrier.update({
        where: { id },
        data: {
          carrierName: dto.carrierName ?? before.carrierName,
          serviceTypes: dto.serviceTypes ?? before.serviceTypes,
          contact: text(dto.contact, before.contact),
          phone: text(dto.phone, before.phone),
          email: text(dto.email, before.email),
          website: text(dto.website, before.website),
          trackingUrlTemplate: text(
            dto.trackingUrlTemplate,
            before.trackingUrlTemplate,
          ),
          status: dto.status ?? before.status,
          notes: text(dto.notes, before.notes),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: "scm_carrier",
        entityId: id,
        action: before.status === after.status ? "update" : "status_change",
        before: { status: before.status },
        after: { status: after.status },
      });
      return after;
    });
  }
}
