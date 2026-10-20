import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateCustomerDto, UpdateCustomerDto } from "./dto/sales.dto.js";

const ENTITY = "scm_customer";
const PREFIX = "CUST-";

const text = (v: string | undefined, cur: string | null) =>
  v === undefined ? cur : v.trim() || null;

@Injectable()
export class CustomersRepository {
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
    const where = tenantWhere<Prisma.ScmCustomerWhereInput>(scope, {
      deletedAt: null,
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { customerCode: { contains: f.q, mode: "insensitive" } },
              { name: { contains: f.q, mode: "insensitive" } },
              { contactPerson: { contains: f.q, mode: "insensitive" } },
              { email: { contains: f.q, mode: "insensitive" } },
              { phone: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.scmCustomer.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      this.prisma.scmCustomer.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOptions(scope: OrgScope) {
    return this.prisma.scmCustomer.findMany({
      where: tenantWhere(scope, { deletedAt: null, status: "Active" }),
      orderBy: { name: "asc" },
    });
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.scmCustomer.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.prisma.scmCustomer.findFirst({
      where: tenantWhere<Prisma.ScmCustomerWhereInput>(scope, {
        customerCode: { equals: code, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  async nextCode(scope: OrgScope): Promise<string> {
    const rows = await this.prisma.scmCustomer.findMany({
      where: tenantWhere(scope, {}),
      select: { customerCode: true },
    });
    const max = rows.reduce((m, r) => {
      const match = /(\d+)$/.exec(r.customerCode);
      return match ? Math.max(m, Number(match[1])) : m;
    }, 0);
    return `${PREFIX}${String(max + 1).padStart(4, "0")}`;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    code: string,
    dto: CreateCustomerDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scmCustomer.create({
        data: {
          organizationId: scope.organizationId,
          customerCode: code,
          name: dto.name,
          contactPerson: text(dto.contactPerson, null),
          email: text(dto.email, null),
          phone: text(dto.phone, null),
          gstin: text(dto.gstin, null),
          billingAddress: text(dto.billingAddress, null),
          shippingAddress: text(dto.shippingAddress, null),
          status: dto.status ?? "Active",
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY,
        entityId: created.id,
        action: "create",
        after: { customerCode: code, name: dto.name },
      });
      return created;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateCustomerDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.scmCustomer.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.scmCustomer.update({
        where: { id },
        data: {
          customerCode: dto.customerCode ?? before.customerCode,
          name: dto.name ?? before.name,
          contactPerson: text(dto.contactPerson, before.contactPerson),
          email: text(dto.email, before.email),
          phone: text(dto.phone, before.phone),
          gstin: text(dto.gstin, before.gstin),
          billingAddress: text(dto.billingAddress, before.billingAddress),
          shippingAddress: text(dto.shippingAddress, before.shippingAddress),
          status: dto.status ?? before.status,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY,
        entityId: id,
        action: before.status === after.status ? "update" : "status_change",
        before: { name: before.name, status: before.status },
        after: { name: after.name, status: after.status },
      });
      return after;
    });
  }
}
