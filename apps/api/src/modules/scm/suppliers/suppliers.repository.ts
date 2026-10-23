import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
} from "./dto/supplier.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

export const SUPPLIER_ENTITY_TYPE = "scm_supplier";
export const SUPPLIER_CODE_PREFIX = "VEND-";

export interface SupplierFilter {
  q?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
}

type SupplierRow = Prisma.SupplierGetPayload<object>;

function snapshot(row: SupplierRow) {
  return {
    supplierCode: row.supplierCode,
    companyName: row.companyName,
    type: row.type,
    status: row.status,
    gstin: row.gstin,
    pan: row.pan,
    contactPerson: row.contactPerson,
    phone: row.phone,
    email: row.email,
    street: row.street,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    paymentTerms: row.paymentTerms,
    creditLimit: row.creditLimit.toString(),
    currency: row.currency,
    leadTimeDays: row.leadTimeDays,
    rating: row.rating,
    notes: row.notes,
  };
}

/** Search across code/company/contact/email/phone/GSTIN, mirroring legacy's
 * `matchesSupplierSearch` (case-insensitive substring). */
function filterWhere(filter: SupplierFilter): Prisma.SupplierWhereInput {
  const clauses: Prisma.SupplierWhereInput[] = [{ deletedAt: null }];
  if (filter.q) {
    const contains = { contains: filter.q, mode: "insensitive" as const };
    clauses.push({
      OR: [
        { supplierCode: contains },
        { companyName: contains },
        { contactPerson: contains },
        { email: contains },
        { phone: contains },
        { gstin: contains },
      ],
    });
  }
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.type) clauses.push({ type: filter.type });
  return { AND: clauses };
}

/** Form text fields: "" clears the column, undefined leaves it untouched. */
const text = (
  value: string | undefined,
  current: string | null,
): string | null => (value === undefined ? current : value.trim() || null);

/** The only place PrismaService is called for this module. Org-wide
 * reference data with no team dimension, same shape as ProductsRepository. */
@Injectable()
export class SuppliersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: SupplierFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SupplierWhereInput>(
      scope,
      filterWhere(filter),
    );
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "asc" }],
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.supplier.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, supplierCode: string) {
    return this.prisma.supplier.findFirst({
      where: tenantWhere<Prisma.SupplierWhereInput>(scope, {
        supplierCode: { equals: supplierCode, mode: "insensitive" },
      }),
    });
  }

  @OrgScoped()
  findByGstin(scope: OrgScope, gstin: string) {
    return this.prisma.supplier.findFirst({
      where: tenantWhere<Prisma.SupplierWhereInput>(scope, {
        gstin: { equals: gstin, mode: "insensitive" },
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async findDistinctTypes(scope: OrgScope): Promise<string[]> {
    const rows = await this.prisma.supplier.findMany({
      where: tenantWhere(scope, { deletedAt: null, type: { not: null } }),
      select: { type: true },
      distinct: ["type"],
      orderBy: { type: "asc" },
    });
    return rows.map((r) => r.type).filter((t): t is string => Boolean(t));
  }

  /** One past the highest numeric suffix in use (not count+1, which repeats
   * a code once any supplier is removed) — legacy `nextSupplierCode`. */
  @OrgScoped()
  async nextCode(scope: OrgScope): Promise<string> {
    const rows = await this.prisma.supplier.findMany({
      where: tenantWhere(scope, {}),
      select: { supplierCode: true },
    });
    const max = rows.reduce((m, r) => {
      const match = /(\d+)$/.exec(r.supplierCode);
      return match ? Math.max(m, Number(match[1])) : m;
    }, 0);
    return `${SUPPLIER_CODE_PREFIX}${String(max + 1).padStart(4, "0")}`;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    supplierCode: string,
    dto: CreateSupplierDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          organizationId: scope.organizationId,
          supplierCode,
          companyName: dto.companyName,
          type: text(dto.type, null),
          status: dto.status ?? "Active",
          gstin: text(dto.gstin, null),
          pan: text(dto.pan, null),
          contactPerson: dto.contactPerson,
          phone: text(dto.phone, null),
          email: text(dto.email, null),
          street: text(dto.street, null),
          city: text(dto.city, null),
          state: text(dto.state, null),
          country:
            dto.country === undefined ? "India" : text(dto.country, null),
          pincode: text(dto.pincode, null),
          paymentTerms:
            dto.paymentTerms === undefined
              ? "30 Days"
              : text(dto.paymentTerms, null),
          creditLimit: dto.creditLimit ?? 0,
          currency: dto.currency ?? "INR",
          leadTimeDays: dto.leadTimeDays ?? 0,
          rating: dto.rating ?? null,
          notes: text(dto.notes, null),
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
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
    dto: UpdateSupplierDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.supplier.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      const after = await tx.supplier.update({
        where: { id },
        data: {
          supplierCode: dto.supplierCode ?? before.supplierCode,
          companyName: dto.companyName ?? before.companyName,
          type: text(dto.type, before.type),
          status: dto.status ?? before.status,
          gstin: text(dto.gstin, before.gstin),
          pan: text(dto.pan, before.pan),
          contactPerson: dto.contactPerson ?? before.contactPerson,
          phone: text(dto.phone, before.phone),
          email: text(dto.email, before.email),
          street: text(dto.street, before.street),
          city: text(dto.city, before.city),
          state: text(dto.state, before.state),
          country: text(dto.country, before.country),
          pincode: text(dto.pincode, before.pincode),
          paymentTerms: text(dto.paymentTerms, before.paymentTerms),
          creditLimit: dto.creditLimit ?? before.creditLimit,
          currency: dto.currency ?? before.currency,
          leadTimeDays: dto.leadTimeDays ?? before.leadTimeDays,
          rating: dto.rating === undefined ? before.rating : dto.rating,
          notes: text(dto.notes, before.notes),
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: id,
        action: before.status === after.status ? "update" : "status_change",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Audit rows for one supplier, newest first, with the actor's name. */
  @OrgScoped()
  async findActivity(scope: OrgScope, id: number) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: scope.organizationId,
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: BigInt(id),
      },
      orderBy: { id: "desc" },
      take: 200,
    });
    const actorIds = [
      ...new Set(
        logs.map((l) => l.actorUserId).filter((v): v is number => v !== null),
      ),
    ];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: scope.organizationId, id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    return logs.map((l) => ({
      id: Number(l.id),
      action: l.action,
      before: l.before,
      after: l.after,
      at: l.at,
      byName: l.actorUserId ? (names.get(l.actorUserId) ?? null) : null,
    }));
  }

  /** Everything procurement knows about one supplier (legacy detail tabs:
   * RFQs, quotations, POs, GRNs, products supplied, performance basics). */
  @OrgScoped()
  async findProcurementSummary(scope: OrgScope, supplierId: number) {
    const where = { organizationId: scope.organizationId, supplierId };
    const [rfqLinks, quotations, purchaseOrders, receipts] = await Promise.all([
      this.prisma.scmRfqSupplier.findMany({
        where: { supplierId, rfq: { organizationId: scope.organizationId } },
        include: {
          rfq: {
            select: {
              id: true,
              rfqNumber: true,
              status: true,
              issueDate: true,
            },
          },
        },
        orderBy: { id: "desc" },
        take: 100,
      }),
      this.prisma.scmSupplierQuotation.findMany({
        where,
        orderBy: { id: "desc" },
        take: 100,
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          quotationDate: true,
          total: true,
          currency: true,
          rfq: { select: { rfqNumber: true } },
        },
      }),
      this.prisma.scmPurchaseOrder.findMany({
        where,
        orderBy: { id: "desc" },
        take: 200,
        include: { items: true },
      }),
      this.prisma.scmGoodsReceipt.findMany({
        where,
        orderBy: { id: "desc" },
        take: 100,
        include: {
          purchaseOrder: { select: { poNumber: true } },
          items: { select: { acceptedQuantity: true, rejectedQuantity: true } },
        },
      }),
    ]);

    const live = purchaseOrders.filter((p) => p.status !== "CANCELLED");
    const open = purchaseOrders.filter((p) =>
      ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(p.status),
    );

    const products = new Map<
      number,
      {
        productId: number;
        name: string;
        lastRate: number;
        lastDate: Date;
        totalQty: number;
        pos: number;
      }
    >();
    for (const po of live) {
      for (const it of po.items) {
        const cur = products.get(it.productId);
        const rate = Number(it.unitPrice);
        const qty = Number(it.quantity);
        if (!cur) {
          products.set(it.productId, {
            productId: it.productId,
            name: it.productNameSnapshot,
            lastRate: rate,
            lastDate: po.poDate,
            totalQty: qty,
            pos: 1,
          });
        } else {
          cur.totalQty += qty;
          cur.pos += 1;
          if (po.poDate > cur.lastDate) {
            cur.lastRate = rate;
            cur.lastDate = po.poDate;
          }
        }
      }
    }

    const accepted = receipts.reduce(
      (s, g) => s + g.items.reduce((a, i) => a + Number(i.acceptedQuantity), 0),
      0,
    );
    const rejected = receipts.reduce(
      (s, g) => s + g.items.reduce((a, i) => a + Number(i.rejectedQuantity), 0),
      0,
    );

    return {
      kpis: {
        purchaseOrders: live.length,
        totalPoValue: live.reduce((s, p) => s + Number(p.total), 0),
        openPurchaseOrders: open.length,
        receipts: receipts.length,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        rejectionRate:
          accepted + rejected > 0 ? rejected / (accepted + rejected) : 0,
      },
      rfqs: rfqLinks.map((l) => l.rfq),
      quotations,
      purchaseOrders: purchaseOrders.map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        status: p.status,
        poDate: p.poDate,
        total: p.total,
        currency: p.currency,
      })),
      receipts: receipts.map((g) => ({
        id: g.id,
        grnNumber: g.grnNumber,
        receiptDate: g.receiptDate,
        poNumber: g.purchaseOrder.poNumber,
        status: g.status,
      })),
      productsSupplied: [...products.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  /** Soft-deletes a supplier (the row stays so history keeps resolving).
   * Never while purchase orders or accounts-payable records exist against it
   * — those would be left naming a supplier that can no longer be opened. */
  @OrgScoped()
  async remove(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!supplier) return false;
      const [orders, bills, payments] = await Promise.all([
        tx.scmPurchaseOrder.count({ where: { supplierId: id } }),
        tx.scmSupplierBill.count({ where: { supplierId: id } }),
        tx.scmSupplierPayment.count({ where: { supplierId: id } }),
      ]);
      if (orders > 0) {
        throw new BusinessRuleViolationException(
          `Cannot delete — ${orders} purchase order(s) exist against this supplier.`,
          "SUPPLIER_HAS_PURCHASE_ORDERS",
        );
      }
      if (bills + payments > 0) {
        throw new BusinessRuleViolationException(
          `Cannot delete — ${bills} bill(s) and ${payments} payment(s) are recorded against this supplier.`,
          "SUPPLIER_HAS_PAYABLES",
        );
      }
      await tx.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: SUPPLIER_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(supplier),
      });
      return true;
    });
  }
}
