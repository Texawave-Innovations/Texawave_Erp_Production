import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";
import { WarehousesService } from "../warehouses/warehouses.service.js";
import type {
  CreatePurchaseOrderDto,
  QueryPurchaseOrderDto,
} from "./dto/procurement.dto.js";
import {
  assertNoDuplicateProducts,
  assertValidPricing,
  CANCELLABLE_PO_STATUSES,
  CLOSABLE_PO_STATUSES,
  documentTotals,
  lineTotal,
  RECEIVABLE_PO_STATUSES,
} from "./procurement.helpers.js";
import {
  PurchaseOrdersRepository,
  type PurchaseOrderLineData,
} from "./purchase-orders.repository.js";
import { isSupplierActive } from "./rfqs.service.js";
import { SupplierQuotationsService } from "./supplier-quotations.service.js";

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly repository: PurchaseOrdersRepository,
    private readonly products: ScmProductsService,
    private readonly suppliers: SuppliersService,
    private readonly warehouses: WarehousesService,
    private readonly quotations: SupplierQuotationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QueryPurchaseOrderDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      {
        q: query.q,
        status: query.status,
        supplierId: query.supplierId,
        statusIn: query.receivable ? RECEIVABLE_PO_STATUSES : undefined,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Purchase order", id);
    return row;
  }

  /** A PO is raised either from a SELECTED quotation (supplier and lines are
   * then taken from it and locked) or from scratch for an active supplier.
   * All amounts are computed here, never trusted from the client. */
  async create(dto: CreatePurchaseOrderDto) {
    await this.warehouses.findOne(dto.warehouseId);

    let supplierId = dto.supplierId;
    let lines: PurchaseOrderLineData[];
    let rfqId: number | undefined;

    if (dto.quotationId) {
      const q = await this.quotations.findOne(dto.quotationId);
      if (q.status !== "SELECTED") {
        throw new BusinessRuleViolationException(
          `Quotation ${q.quotationNumber} must be selected before a purchase order can be raised.`,
          "QUOTATION_NOT_SELECTED",
        );
      }
      const existing = await this.repository.findLiveForQuotation(
        this.scope,
        q.id,
      );
      if (existing) {
        throw new ResourceConflictException(
          `Quotation ${q.quotationNumber} already has purchase order ${existing.poNumber}.`,
        );
      }
      supplierId = q.supplierId;
      rfqId = q.rfqId;
      lines = q.items.map((it) => {
        const { taxAmount, total } = lineTotal(
          Number(it.quantity),
          Number(it.unitPrice),
          Number(it.discount),
          Number(it.taxRate),
        );
        return {
          productId: it.productId,
          productName: it.productNameSnapshot,
          uom: it.uom,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount),
          taxRate: Number(it.taxRate),
          taxAmount,
          total,
        };
      });
    } else {
      if (!supplierId) {
        throw new BusinessRuleViolationException(
          "Select a supplier",
          "SUPPLIER_REQUIRED",
        );
      }
      if (!dto.items || dto.items.length === 0) {
        throw new BusinessRuleViolationException(
          "Add at least one item with a positive quantity",
          "ITEMS_REQUIRED",
        );
      }
      lines = await Promise.all(
        dto.items.map(async (it) => {
          const p = await this.products.findOne(it.productId);
          const discount = it.discount ?? 0;
          const taxRate = it.taxRate ?? 0;
          const { taxAmount, total } = lineTotal(
            it.quantity,
            it.unitPrice,
            discount,
            taxRate,
          );
          return {
            productId: p.id,
            productName: p.name,
            uom: p.uom,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount,
            taxRate,
            taxAmount,
            total,
          };
        }),
      );
    }

    const supplier = await this.suppliers.findOne(supplierId as number);
    if (!isSupplierActive(supplier.status)) {
      throw new BusinessRuleViolationException(
        "Purchase orders can only be raised for active suppliers",
        "SUPPLIER_INACTIVE",
      );
    }
    assertNoDuplicateProducts(
      lines,
      (id) =>
        lines.find((l) => l.productId === id)?.productName ?? `Product ${id}`,
    );
    const freight = dto.freight ?? 0;
    const discount = dto.discount ?? 0;
    assertValidPricing(lines, freight, discount);
    const { subtotal, taxAmount, total } = documentTotals(
      lines,
      freight,
      discount,
    );

    try {
      return await this.repository.create(
        this.scope,
        {
          supplierId: supplier.id,
          vendorName: supplier.companyName,
          vendorGstin: supplier.gstin,
          rfqId,
          quotationId: dto.quotationId,
          poDate: dto.poDate,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          warehouseId: dto.warehouseId,
          deliveryLocation: dto.deliveryLocation,
          paymentTerms: dto.paymentTerms,
          currency: dto.currency ?? "INR",
          freight,
          discount,
          subtotal,
          taxAmount,
          total,
          notes: dto.notes,
          lines,
        },
        this.actor,
      );
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          "This quotation already has a live purchase order.",
        );
      }
      throw error;
    }
  }

  private async orNotFound<T>(id: number, p: Promise<T | null>) {
    const row = await p;
    if (!row) throw new ResourceNotFoundException("Purchase order", id);
    return row;
  }

  submit(id: number) {
    return this.orNotFound(
      id,
      this.repository.transition(
        this.scope,
        id,
        ["DRAFT"],
        "PENDING_APPROVAL",
        this.actor,
      ),
    );
  }
  approve(id: number) {
    return this.orNotFound(
      id,
      this.repository.approve(this.scope, id, this.actor),
    );
  }
  /** Approval alone is not enough to receive goods — the PO must be sent. */
  send(id: number) {
    return this.orNotFound(
      id,
      this.repository.transition(
        this.scope,
        id,
        ["APPROVED"],
        "SENT",
        this.actor,
      ),
    );
  }
  cancel(id: number) {
    return this.orNotFound(
      id,
      this.repository.end(
        this.scope,
        id,
        CANCELLABLE_PO_STATUSES,
        "CANCELLED",
        this.actor,
      ),
    );
  }
  close(id: number) {
    return this.orNotFound(
      id,
      this.repository.end(
        this.scope,
        id,
        CLOSABLE_PO_STATUSES,
        "CLOSED",
        this.actor,
      ),
    );
  }
}
