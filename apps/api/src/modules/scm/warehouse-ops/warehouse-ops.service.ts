import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ScmActivityService } from "../common/scm-activity.service.js";
import type {
  CreateMovementDto,
  CreatePutawayDto,
  QueryActivityDto,
  QueryLocationStockDto,
  QueryMovementDto,
  QueryPutawayDto,
  RecordPutawayItemDto,
} from "./dto/warehouse-ops.dto.js";
import { WarehouseOpsRepository } from "./warehouse-ops.repository.js";

export const WAREHOUSE_ENTITY_TYPES = ["scm_putaway", "scm_warehouse_movement"];

@Injectable()
export class WarehouseOpsService {
  constructor(
    private readonly repo: WarehouseOpsRepository,
    private readonly activity: ScmActivityService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }
  private nf<T>(what: string, id: number, row: T | null): T {
    if (!row) throw new ResourceNotFoundException(what, id);
    return row;
  }

  // ---- put-away -----------------------------------------------------------

  async listPutaways(query: QueryPutawayDto) {
    const { items, total } = await this.repo.findPutaways(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getPutaway(id: number) {
    return this.nf("Put-away", id, await this.repo.findPutaway(this.scope, id));
  }
  putawaySources() {
    return this.repo.findPutawaySources(this.scope);
  }
  createPutaway(dto: CreatePutawayDto) {
    return this.repo.createPutaway(this.scope, dto, this.actor);
  }
  async addPutawayLine(
    id: number,
    input: { productId: number; quantity: number },
  ) {
    return this.nf(
      "Put-away",
      id,
      await this.repo.addPutawayLine(this.scope, id, input, this.actor),
    );
  }
  async startPutaway(id: number) {
    return this.nf(
      "Put-away",
      id,
      await this.repo.startPutaway(this.scope, id, this.actor),
    );
  }
  async cancelPutaway(id: number, reason?: string) {
    return this.nf(
      "Put-away",
      id,
      await this.repo.cancelPutaway(this.scope, id, reason, this.actor),
    );
  }
  async recordPutawayItem(
    id: number,
    itemId: number,
    dto: RecordPutawayItemDto,
  ) {
    return this.nf(
      "Put-away line",
      itemId,
      await this.repo.recordPutawayItem(
        this.scope,
        id,
        itemId,
        dto,
        this.actor,
      ),
    );
  }

  // ---- movements ------------------------------------------------------------

  async listMovements(query: QueryMovementDto) {
    const { items, total } = await this.repo.findMovements(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getMovement(id: number) {
    return this.nf(
      "Movement",
      id,
      await this.repo.findMovement(this.scope, id),
    );
  }
  createMovement(dto: CreateMovementDto) {
    return this.repo.createMovement(this.scope, dto, this.actor);
  }
  async submitMovement(id: number) {
    return this.nf(
      "Movement",
      id,
      await this.repo.submitMovement(this.scope, id, this.actor),
    );
  }
  async approveMovement(id: number) {
    return this.nf(
      "Movement",
      id,
      await this.repo.approveMovement(this.scope, id, this.actor),
    );
  }
  async completeMovement(id: number) {
    return this.nf(
      "Movement",
      id,
      await this.repo.completeMovement(this.scope, id, this.actor),
    );
  }
  async cancelMovement(id: number, reason?: string) {
    return this.nf(
      "Movement",
      id,
      await this.repo.cancelMovement(this.scope, id, reason, this.actor),
    );
  }

  // ---- location stock / dashboard / activity ---------------------------------

  async listLocationStock(query: QueryLocationStockDto) {
    const { items, total } = await this.repo.findLocationStock(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  dashboard() {
    return this.repo.dashboard(this.scope);
  }
  listActivity(query: QueryActivityDto) {
    return this.activity.list(WAREHOUSE_ENTITY_TYPES, query, query.q);
  }
}
