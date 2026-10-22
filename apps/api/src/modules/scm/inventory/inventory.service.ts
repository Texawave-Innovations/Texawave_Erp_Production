import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateAdjustmentDto,
  CreateBatchDto,
  CreateReservationDto,
  CreateSerialsDto,
  CreateTransferDto,
  OpeningBalanceDto,
  QueryInventoryDocsDto,
  QueryLedgerDto,
  QueryOverviewDto,
  UpdateBatchStatusDto,
  UpdateSerialStatusDto,
} from "./dto/inventory.dto.js";
import { InventoryRepository } from "./inventory.repository.js";

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  // ---- overview -----------------------------------------------------------

  async overview(query: QueryOverviewDto) {
    const all = await this.repository.overviewRows(this.scope, {
      q: query.q,
      warehouseId: query.warehouseId,
    });
    const rows = query.stockStatus
      ? all.filter((r) => r.stockStatus === query.stockStatus)
      : all;
    const start = (query.page - 1) * query.limit;
    return new PaginatedResponseDto(
      rows.slice(start, start + query.limit),
      rows.length,
      query.page,
      query.limit,
    );
  }

  /** KPI strip for the Stock Overview page (legacy KPI cards). */
  async overviewKpis(query: QueryOverviewDto) {
    const rows = await this.repository.overviewRows(this.scope, {
      q: query.q,
      warehouseId: query.warehouseId,
    });
    const skus = new Set(rows.map((r) => r.productId));
    return {
      totalValue: rows.reduce((s, r) => s + r.value, 0),
      totalSkus: skus.size,
      available: rows.reduce((s, r) => s + r.available, 0),
      reserved: rows.reduce((s, r) => s + r.reserved, 0),
      incoming: rows.reduce((s, r) => s + r.incoming, 0),
      lowStock: rows.filter((r) => r.stockStatus === "Low Stock").length,
      outOfStock: rows.filter((r) => r.stockStatus === "Out of Stock").length,
    };
  }

  async productDetail(productId: number) {
    const detail = await this.repository.productDetail(this.scope, productId);
    if (!detail) throw new ResourceNotFoundException("Product", productId);
    return detail;
  }

  async ledger(query: QueryLedgerDto) {
    const { items, total } = await this.repository.findLedger(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  postOpeningBalance(dto: OpeningBalanceDto) {
    return this.repository.postOpeningBalance(this.scope, dto, this.actor);
  }

  // ---- reservations -------------------------------------------------------

  async reservations(query: QueryInventoryDocsDto) {
    const { items, total } = await this.repository.findReservations(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createReservation(dto: CreateReservationDto) {
    return this.repository.createReservation(this.scope, dto, this.actor);
  }

  async releaseReservation(id: number, status: "RELEASED" | "CANCELLED") {
    const row = await this.repository.releaseReservation(
      this.scope,
      id,
      status,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Reservation", id);
    return row;
  }

  // ---- transfers ----------------------------------------------------------

  async transfers(query: QueryInventoryDocsDto) {
    const { items, total } = await this.repository.findTransfers(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createTransfer(dto: CreateTransferDto) {
    return this.repository.createTransfer(this.scope, dto, this.actor);
  }

  async transitionTransfer(
    id: number,
    action: "approve" | "dispatch" | "receive" | "cancel",
  ) {
    const row = await this.repository.transitionTransfer(
      this.scope,
      id,
      action,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Transfer", id);
    return row;
  }

  // ---- adjustments --------------------------------------------------------

  async adjustments(query: QueryInventoryDocsDto) {
    const { items, total } = await this.repository.findAdjustments(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createAdjustment(dto: CreateAdjustmentDto) {
    return this.repository.createAdjustment(this.scope, dto, this.actor);
  }

  async decideAdjustment(id: number, decision: "APPROVED" | "REJECTED") {
    const row = await this.repository.decideAdjustment(
      this.scope,
      id,
      decision,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Adjustment", id);
    return row;
  }

  // ---- batches / serials --------------------------------------------------

  async batches(query: QueryInventoryDocsDto) {
    const { items, total } = await this.repository.findBatches(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createBatch(dto: CreateBatchDto) {
    return this.repository.createBatch(this.scope, dto, this.actor);
  }

  async setBatchStatus(id: number, dto: UpdateBatchStatusDto) {
    const row = await this.repository.setBatchStatus(
      this.scope,
      id,
      dto.status,
    );
    if (!row) throw new ResourceNotFoundException("Batch", id);
    return row;
  }

  async serials(query: QueryInventoryDocsDto) {
    const { items, total } = await this.repository.findSerials(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createSerials(dto: CreateSerialsDto) {
    return this.repository.createSerials(this.scope, dto, this.actor);
  }

  async setSerialStatus(id: number, dto: UpdateSerialStatusDto) {
    const row = await this.repository.setSerialStatus(
      this.scope,
      id,
      dto.status,
    );
    if (!row) throw new ResourceNotFoundException("Serial number", id);
    return row;
  }
}
