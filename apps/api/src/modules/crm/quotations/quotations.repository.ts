import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { computeLineBreakdown, round2 } from "../shared/money.js";
import type { QuotationPayloadDto } from "./dto/quotation.dto.js";

const ENTITY_TYPE = "crm_quotation";

export interface QuotationFilter {
  q?: string | undefined;
  status?: string | undefined;
  accountId?: number | undefined;
  opportunityId?: number | undefined;
}

const INCLUDE = {
  account: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true, opportunityNumber: true } },
  contact: { select: { id: true, name: true } },
  lineItems: {
    orderBy: { lineOrder: "asc" },
    include: { product: { select: { id: true, code: true, isActive: true } } },
  },
} satisfies Prisma.QuotationInclude;
type QuotationRow = Prisma.QuotationGetPayload<{ include: typeof INCLUDE }>;

function snapshot(
  row: Pick<
    QuotationRow,
    "quotationNumber" | "subject" | "status" | "grandTotal" | "isActive"
  >,
) {
  return {
    quotationNumber: row.quotationNumber,
    subject: row.subject,
    status: row.status,
    grandTotal: row.grandTotal.toString(),
    isActive: row.isActive,
  };
}

function filterWhere(filter: QuotationFilter): Prisma.QuotationWhereInput {
  const clauses: Prisma.QuotationWhereInput[] = [{ deletedAt: null }];
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.accountId !== undefined)
    clauses.push({ accountId: filter.accountId });
  if (filter.opportunityId !== undefined)
    clauses.push({ opportunityId: filter.opportunityId });
  if (filter.q) {
    clauses.push({
      OR: [
        { quotationNumber: { contains: filter.q, mode: "insensitive" } },
        { subject: { contains: filter.q, mode: "insensitive" } },
        { account: { name: { contains: filter.q, mode: "insensitive" } } },
      ],
    });
  }
  return { AND: clauses };
}

/**
 * Validates accountId/contactId/opportunityId cross-references inside the
 * caller's transaction — approved decision D5
 * (Docs/CRM_QUOTES_LEGACY_PARITY.md §6): legacy only filters these in the
 * UI (no server exists to enforce them any other way); production has a
 * real service layer, so same-organization AND same-account AND
 * (for opportunities) OPEN-status are all enforced here, not left
 * advisory.
 */
async function requireRelationships(
  tx: Prisma.TransactionClient,
  organizationId: number,
  dto: QuotationPayloadDto,
) {
  const account = await tx.account.findFirst({
    where: { id: dto.accountId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!account) {
    throw new BusinessRuleViolationException(
      `Account ${dto.accountId} does not exist in this organization`,
      "INVALID_ACCOUNT",
    );
  }

  if (dto.contactId !== undefined) {
    const contact = await tx.contact.findFirst({
      where: { id: dto.contactId, organizationId, deletedAt: null },
      select: { id: true, accountId: true },
    });
    if (!contact || contact.accountId !== dto.accountId) {
      throw new BusinessRuleViolationException(
        `Contact ${dto.contactId} does not exist in this organization or does not belong to account ${dto.accountId}`,
        "INVALID_CONTACT",
      );
    }
  }

  if (dto.opportunityId !== undefined) {
    const opportunity = await tx.opportunity.findFirst({
      where: { id: dto.opportunityId, organizationId, deletedAt: null },
      select: { id: true, accountId: true, status: true },
    });
    if (!opportunity || opportunity.accountId !== dto.accountId) {
      throw new BusinessRuleViolationException(
        `Opportunity ${dto.opportunityId} does not exist in this organization or does not belong to account ${dto.accountId}`,
        "INVALID_OPPORTUNITY",
      );
    }
    if (opportunity.status !== "OPEN") {
      throw new BusinessRuleViolationException(
        `Opportunity ${dto.opportunityId} is not OPEN`,
        "INVALID_OPPORTUNITY",
      );
    }
  }
}

/**
 * Builds every line row's persisted shape from the validated input —
 * `listPrice` is derived from the live `Product` row (or `0` for a
 * free-text line, matching legacy exactly — see
 * Docs/CRM_QUOTES_LEGACY_PARITY.md §1.3), and every computed field comes
 * from the shared `computeLineBreakdown` port, never re-derived
 * (approved decision D4). Also validates each `productId` belongs to
 * this organization and is active, same "only active products
 * selectable" rule `OpportunityProduct`/`QuoteProductPicker` already
 * enforce.
 */
async function buildLineItems(
  tx: Prisma.TransactionClient,
  organizationId: number,
  items: QuotationPayloadDto["items"],
) {
  const rows: Prisma.QuotationLineItemCreateManyQuotationInput[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const [index, item] of items.entries()) {
    let listPrice = 0;
    let productCode: string | null = null;
    if (item.productId !== undefined) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, organizationId, deletedAt: null },
      });
      if (!product) {
        throw new BusinessRuleViolationException(
          `Product ${item.productId} does not exist in this organization`,
          "INVALID_PRODUCT",
        );
      }
      if (!product.isActive) {
        throw new BusinessRuleViolationException(
          `Product "${product.name}" is inactive and cannot be added to a quote`,
          "INACTIVE_PRODUCT",
        );
      }
      listPrice = Number(product.unitPrice);
      productCode = product.code;
    }

    const discountPercent = item.discountPercent ?? 0;
    const taxPercent = item.taxPercent ?? 0;
    const { gross, discountAmount, taxAmount, total } = computeLineBreakdown(
      item.quantity,
      item.unitPrice,
      discountPercent,
      taxPercent,
    );
    subtotal += gross;
    totalDiscount += discountAmount;
    totalTax += taxAmount;

    rows.push({
      organizationId,
      productId: item.productId ?? null,
      productCode,
      description: item.description,
      uom: item.uom ?? null,
      quantity: item.quantity,
      listPrice,
      unitPrice: item.unitPrice,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      amount: total,
      lineOrder: index,
    });
  }

  return {
    rows,
    totals: {
      subtotal: round2(subtotal),
      totalDiscount: round2(totalDiscount),
      totalTax: round2(totalTax),
    },
  };
}

@Injectable()
export class QuotationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: QuotationFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.QuotationWhereInput>(
      scope,
      filterWhere(filter),
    );
    const [items, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "asc" }],
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.quotation.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
  }

  /**
   * Create: validates relationships, builds/validates line items,
   * inserts the header with a placeholder number, then overwrites it
   * with `QUO-<id, zero-padded to 6>` — approved decision D3. All one
   * transaction: a failure anywhere (bad relationship, bad product,
   * numbering) leaves nothing behind.
   */
  @OrgScoped()
  async create(scope: OrgScope, dto: QuotationPayloadDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await requireRelationships(tx, scope.organizationId, dto);
      const { rows, totals } = await buildLineItems(
        tx,
        scope.organizationId,
        dto.items,
      );
      const adjustment = dto.adjustment ?? 0;
      const grandTotal = round2(
        totals.subtotal - totals.totalDiscount + totals.totalTax + adjustment,
      );

      const created = await tx.quotation.create({
        data: {
          organizationId: scope.organizationId,
          accountId: dto.accountId,
          opportunityId: dto.opportunityId ?? null,
          contactId: dto.contactId ?? null,
          quotationNumber: "PENDING",
          subject: dto.subject,
          status: dto.status ?? "Draft",
          quoteOwner: dto.quoteOwner ?? null,
          currency: dto.currency ?? "INR",
          quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : new Date(),
          validUntil: new Date(dto.validUntil),
          customerReference: dto.customerReference ?? null,
          billingStreet: dto.billingStreet ?? null,
          billingCity: dto.billingCity ?? null,
          billingState: dto.billingState ?? null,
          billingPostalCode: dto.billingPostalCode ?? null,
          billingCountry: dto.billingCountry ?? null,
          shippingStreet: dto.shippingStreet ?? null,
          shippingCity: dto.shippingCity ?? null,
          shippingState: dto.shippingState ?? null,
          shippingPostalCode: dto.shippingPostalCode ?? null,
          shippingCountry: dto.shippingCountry ?? null,
          carrier: dto.carrier ?? null,
          deliveryNotes: dto.deliveryNotes ?? null,
          termsConditions: dto.termsConditions ?? null,
          paymentTerms: dto.paymentTerms ?? null,
          deliveryTerms: dto.deliveryTerms ?? null,
          notes: dto.notes ?? null,
          subtotal: totals.subtotal,
          totalDiscount: totals.totalDiscount,
          totalTax: totals.totalTax,
          adjustment,
          grandTotal,
          createdBy: actorId,
          updatedBy: actorId,
          lineItems: { createMany: { data: rows } },
        },
      });
      const numbered = await tx.quotation.update({
        where: { id: created.id },
        data: { quotationNumber: `QUO-${String(created.id).padStart(6, "0")}` },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: numbered.id,
        action: "create",
        after: snapshot(numbered),
      });
      return numbered;
    });
  }

  /**
   * Full replace-all update (approved decision D2): header fields and
   * every line item are overwritten in one transaction — existing line
   * items are hard-deleted and recreated (see the model's own doc
   * comment for why that's safe here, unlike everywhere else in this
   * schema). `quotationNumber` is never changed after creation.
   */
  @OrgScoped()
  async replace(
    scope: OrgScope,
    id: number,
    dto: QuotationPayloadDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.quotation.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;

      await requireRelationships(tx, scope.organizationId, dto);
      const { rows, totals } = await buildLineItems(
        tx,
        scope.organizationId,
        dto.items,
      );
      const adjustment = dto.adjustment ?? 0;
      const grandTotal = round2(
        totals.subtotal - totals.totalDiscount + totals.totalTax + adjustment,
      );

      await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
      const after = await tx.quotation.update({
        where: { id },
        data: {
          accountId: dto.accountId,
          opportunityId: dto.opportunityId ?? null,
          contactId: dto.contactId ?? null,
          subject: dto.subject,
          status: dto.status ?? before.status,
          quoteOwner: dto.quoteOwner ?? null,
          currency: dto.currency ?? "INR",
          quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : before.quoteDate,
          validUntil: new Date(dto.validUntil),
          customerReference: dto.customerReference ?? null,
          billingStreet: dto.billingStreet ?? null,
          billingCity: dto.billingCity ?? null,
          billingState: dto.billingState ?? null,
          billingPostalCode: dto.billingPostalCode ?? null,
          billingCountry: dto.billingCountry ?? null,
          shippingStreet: dto.shippingStreet ?? null,
          shippingCity: dto.shippingCity ?? null,
          shippingState: dto.shippingState ?? null,
          shippingPostalCode: dto.shippingPostalCode ?? null,
          shippingCountry: dto.shippingCountry ?? null,
          carrier: dto.carrier ?? null,
          deliveryNotes: dto.deliveryNotes ?? null,
          termsConditions: dto.termsConditions ?? null,
          paymentTerms: dto.paymentTerms ?? null,
          deliveryTerms: dto.deliveryTerms ?? null,
          notes: dto.notes ?? null,
          subtotal: totals.subtotal,
          totalDiscount: totals.totalDiscount,
          totalTax: totals.totalTax,
          adjustment,
          grandTotal,
          updatedBy: actorId,
          lineItems: { createMany: { data: rows } },
        },
        include: INCLUDE,
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

  /** Soft-delete only. Gated at the controller by the SEPARATE
   * `crm.quotation.delete` permission, not `.write` — see the
   * catalog.ts note. Does not touch the quote's line items (they become
   * unreachable once the parent is excluded from reads — see the
   * model's own doc comment) and does not touch the linked Account/
   * Contact/Opportunity/Products, matching legacy's own confirm-dialog
   * copy exactly ("linked Account, Contact, Deal, and Products are
   * never affected"). */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.quotation.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.quotation.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
        include: INCLUDE,
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
