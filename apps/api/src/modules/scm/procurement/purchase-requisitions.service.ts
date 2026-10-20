import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { WarehousesService } from "../warehouses/warehouses.service.js";
import type {
  QueryRequisitionDto,
  RejectRequisitionDto,
  RequisitionPayloadDto,
} from "./dto/procurement.dto.js";
import { assertNoDuplicateProducts, round2 } from "./procurement.helpers.js";
import {
  PurchaseRequisitionsRepository,
  type RequisitionData,
} from "./purchase-requisitions.repository.js";

@Injectable()
export class PurchaseRequisitionsService {
  constructor(
    private readonly repository: PurchaseRequisitionsRepository,
    private readonly products: ScmProductsService,
    private readonly warehouses: WarehousesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QueryRequisitionDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Purchase requisition", id);
    return row;
  }

  /** Looks up products and computes every amount server-side. */
  private async prepare(dto: RequisitionPayloadDto): Promise<RequisitionData> {
    await this.warehouses.findOne(dto.warehouseId);
    const lines = await Promise.all(
      dto.items.map(async (it) => {
        const product = await this.products.findOne(it.productId);
        const cost = it.estimatedUnitCost ?? 0;
        return {
          productId: product.id,
          productName: product.name,
          uom: product.uom,
          quantity: it.quantity,
          estimatedUnitCost: cost,
          estimatedTotal: round2(it.quantity * cost),
          requiredDate: it.requiredDate,
          notes: it.notes,
        };
      }),
    );
    assertNoDuplicateProducts(
      lines,
      (id) =>
        lines.find((l) => l.productId === id)?.productName ?? `Product ${id}`,
    );
    const subtotal = round2(lines.reduce((s, l) => s + l.estimatedTotal, 0));
    const tax = round2(dto.tax ?? 0);
    return {
      department: dto.department,
      requestDate: dto.requestDate,
      requiredDate: dto.requiredDate,
      priority: dto.priority ?? "Normal",
      warehouseId: dto.warehouseId,
      purpose: dto.purpose,
      notes: dto.notes,
      subtotal,
      tax,
      total: round2(subtotal + tax),
      lines,
    };
  }

  async create(dto: RequisitionPayloadDto) {
    return this.repository.create(
      this.scope,
      await this.prepare(dto),
      this.actor,
    );
  }

  async update(id: number, dto: RequisitionPayloadDto) {
    const row = await this.repository.update(
      this.scope,
      id,
      await this.prepare(dto),
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Purchase requisition", id);
    return row;
  }

  private async move(
    id: number,
    from: readonly string[],
    to: string,
    extra: { rejectionReason?: string } = {},
  ) {
    const row = await this.repository.transition(
      this.scope,
      id,
      from,
      to,
      this.actor,
      extra,
    );
    if (!row) throw new ResourceNotFoundException("Purchase requisition", id);
    return row;
  }

  submit(id: number) {
    return this.move(id, ["DRAFT"], "SUBMITTED");
  }
  approve(id: number) {
    return this.move(id, ["SUBMITTED"], "APPROVED");
  }
  reject(id: number, dto: RejectRequisitionDto) {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BusinessRuleViolationException(
        "A rejection reason is required",
        "REASON_REQUIRED",
      );
    }
    return this.move(id, ["SUBMITTED"], "REJECTED", {
      rejectionReason: reason,
    });
  }
  cancel(id: number) {
    return this.move(id, ["DRAFT", "SUBMITTED"], "CANCELLED");
  }
}
