import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";
import type {
  CreateQuotationDto,
  QueryQuotationDto,
  SaveComparisonDto,
} from "./dto/procurement.dto.js";
import {
  assertNoDuplicateProducts,
  assertValidPricing,
  documentTotals,
  lineTotal,
} from "./procurement.helpers.js";
import { SupplierQuotationsRepository } from "./supplier-quotations.repository.js";

@Injectable()
export class SupplierQuotationsService {
  constructor(
    private readonly repository: SupplierQuotationsRepository,
    private readonly products: ScmProductsService,
    private readonly suppliers: SuppliersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QueryQuotationDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Supplier quotation", id);
    return row;
  }

  async create(dto: CreateQuotationDto) {
    const supplier = await this.suppliers.findOne(dto.supplierId);
    const lines = await Promise.all(
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
          promisedDeliveryDate: it.promisedDeliveryDate,
          notes: it.notes,
        };
      }),
    );
    assertNoDuplicateProducts(
      lines,
      (id) =>
        lines.find((l) => l.productId === id)?.productName ?? `Product ${id}`,
    );
    const freight = dto.freight ?? 0;
    const discount = dto.discount ?? 0;
    const priced = lines.map((l) => ({ ...l, productName: l.productName }));
    assertValidPricing(priced, freight, discount);
    const { subtotal, taxAmount, total } = documentTotals(
      priced,
      freight,
      discount,
    );

    return this.repository.create(
      this.scope,
      {
        supplierQuotationNumber: dto.supplierQuotationNumber,
        rfqId: dto.rfqId,
        supplierId: supplier.id,
        vendorName: supplier.companyName,
        vendorGstin: supplier.gstin,
        quotationDate: dto.quotationDate,
        validUntil: dto.validUntil,
        currency: dto.currency ?? "INR",
        paymentTerms: dto.paymentTerms,
        deliveryTerms: dto.deliveryTerms,
        freight,
        discount,
        tax: taxAmount,
        subtotal,
        total,
        notes: dto.notes,
        lines,
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
    if (!row) throw new ResourceNotFoundException("Supplier quotation", id);
    return row;
  }

  reject(id: number) {
    return this.move(id, ["RECEIVED", "SHORTLISTED"], "REJECTED");
  }
  cancel(id: number) {
    return this.move(id, ["RECEIVED", "SHORTLISTED", "REJECTED"], "CANCELLED");
  }

  // ---- comparison ---------------------------------------------------------

  comparisonData(rfqId: number) {
    return this.repository.findForComparison(this.scope, rfqId);
  }

  comparisonHistory(rfqId: number) {
    return this.repository.findComparisons(this.scope, rfqId);
  }

  saveComparison(dto: SaveComparisonDto) {
    return this.repository.saveComparison(this.scope, dto, this.actor);
  }
}
