import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { round2 } from "../procurement/procurement.helpers.js";
import type {
  CreateSalesOrderDto,
  QuerySalesOrderDto,
} from "./dto/sales.dto.js";
import { SalesOrdersRepository } from "./sales-orders.repository.js";

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly repository: SalesOrdersRepository,
    private readonly products: ScmProductsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QuerySalesOrderDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Sales order", id);
    return row;
  }

  async create(dto: CreateSalesOrderDto) {
    const lines = await Promise.all(
      dto.items.map(async (it) => {
        const p = await this.products.findOne(it.productId);
        const taxRate = it.taxRate ?? 0;
        const net = round2(it.quantity * it.unitPrice);
        const total = round2(net + round2(net * (taxRate / 100)));
        return {
          productId: p.id,
          itemCode: p.productCode,
          itemDescription: p.name,
          uom: p.uom,
          salesQty: it.quantity,
          unitPrice: it.unitPrice,
          taxRate,
          total,
        };
      }),
    );
    if (new Set(lines.map((l) => l.productId)).size !== lines.length) {
      throw new BusinessRuleViolationException(
        "A product appears on more than one line — combine them into one line",
        "DUPLICATE_PRODUCT",
      );
    }
    const subtotal = round2(
      lines.reduce((s, l) => s + round2(l.salesQty * l.unitPrice), 0),
    );
    const total = round2(lines.reduce((s, l) => s + l.total, 0));
    return this.repository.create(
      this.scope,
      {
        customerId: dto.customerId,
        orderDate: dto.orderDate,
        expectedDate: dto.expectedDate,
        shipToAddress: dto.shipToAddress,
        billToAddress: dto.billToAddress,
        currency: dto.currency ?? "INR",
        notes: dto.notes,
        lines,
        subtotal,
        taxAmount: round2(total - subtotal),
        total,
      },
      this.actor,
    );
  }

  private async move(id: number, from: readonly string[], to: string) {
    const row = await this.repository.transition(
      this.scope,
      id,
      from,
      to,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Sales order", id);
    return row;
  }

  confirm(id: number) {
    return this.move(id, ["DRAFT"], "CONFIRMED");
  }
  cancel(id: number) {
    return this.move(id, ["DRAFT", "CONFIRMED"], "CANCELLED");
  }
}
