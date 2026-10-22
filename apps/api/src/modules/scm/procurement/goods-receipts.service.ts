import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateGoodsReceiptDto,
  QueryGoodsReceiptDto,
} from "./dto/procurement.dto.js";
import { GoodsReceiptsRepository } from "./goods-receipts.repository.js";

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly repository: GoodsReceiptsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  async findAll(query: QueryGoodsReceiptDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Goods receipt", id);
    return row;
  }

  create(dto: CreateGoodsReceiptDto) {
    return this.repository.create(
      this.scope,
      dto,
      this.tenantContext.getUserId(),
    );
  }
}
