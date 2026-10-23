import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";
import { WarehousesService } from "../warehouses/warehouses.service.js";
import type { CreateRfqDto, QueryRfqDto } from "./dto/procurement.dto.js";
import { assertNoDuplicateProducts } from "./procurement.helpers.js";
import { RfqsRepository } from "./rfqs.repository.js";

/** Suppliers that may be sent RFQs/POs: legacy `isSupplierActive`. */
export const isSupplierActive = (status: string | null | undefined) =>
  !status || status === "Active";

@Injectable()
export class RfqsService {
  constructor(
    private readonly repository: RfqsRepository,
    private readonly products: ScmProductsService,
    private readonly suppliers: SuppliersService,
    private readonly warehouses: WarehousesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QueryRfqDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("RFQ", id);
    return row;
  }

  findWithQuotations() {
    return this.repository.findWithQuotations(this.scope);
  }

  async create(dto: CreateRfqDto) {
    await this.warehouses.findOne(dto.warehouseId);

    // Supplier list is re-filtered against currently-active vendors even
    // after selection (legacy rule).
    const found = await Promise.all(
      [...new Set(dto.supplierIds)].map((id) => this.suppliers.findOne(id)),
    );
    const active = found.filter((s) => isSupplierActive(s.status));
    if (active.length === 0) {
      throw new BusinessRuleViolationException(
        "Select at least one active supplier",
        "NO_ACTIVE_SUPPLIER",
      );
    }

    const lines = await Promise.all(
      dto.items.map(async (it) => {
        const p = await this.products.findOne(it.productId);
        return {
          productId: p.id,
          productName: p.name,
          uom: p.uom,
          quantity: it.quantity,
          notes: it.notes,
        };
      }),
    );
    assertNoDuplicateProducts(
      lines,
      (id) =>
        lines.find((l) => l.productId === id)?.productName ?? `Product ${id}`,
    );

    try {
      return await this.repository.create(
        this.scope,
        {
          requisitionId: dto.requisitionId,
          issueDate: dto.issueDate,
          responseDueDate: dto.responseDueDate,
          warehouseId: dto.warehouseId,
          deliveryLocation: dto.deliveryLocation,
          currency: dto.currency ?? "INR",
          paymentTerms: dto.paymentTerms,
          deliveryTerms: dto.deliveryTerms,
          notes: dto.notes,
          suppliers: active.map((s) => ({
            supplierId: s.id,
            name: s.companyName,
          })),
          lines,
        },
        this.actor,
      );
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          "This requisition has already been converted to an RFQ.",
        );
      }
      throw error;
    }
  }

  private async move(id: number, from: readonly string[], to: string) {
    const row = await this.repository.transition(
      this.scope,
      id,
      from,
      to,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("RFQ", id);
    return row;
  }

  /** Issuing jumps DRAFT straight to RESPONSES_PENDING (legacy). */
  issue(id: number) {
    return this.move(id, ["DRAFT"], "RESPONSES_PENDING");
  }
  close(id: number) {
    return this.move(
      id,
      ["RESPONSES_PENDING", "PARTIALLY_RESPONDED", "RESPONDED"],
      "CLOSED",
    );
  }
  cancel(id: number) {
    return this.move(
      id,
      ["DRAFT", "RESPONSES_PENDING", "PARTIALLY_RESPONDED"],
      "CANCELLED",
    );
  }

  async remove(id: number) {
    const ok = await this.repository.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("RFQ", id);
  }
}
