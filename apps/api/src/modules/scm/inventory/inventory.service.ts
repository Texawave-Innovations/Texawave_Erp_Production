import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { MasterListValueGuard } from "../master-list-items/master-list-value.guard.js";
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
    private readonly masterListGuard: MasterListValueGuard,
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
    const byStatus = query.stockStatus
      ? all.filter((r) => r.stockStatus === query.stockStatus)
      : all;
    const rows = query.hasBadStock
      ? byStatus.filter((r) => r.damaged > 0)
      : byStatus;
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
      bad: rows.reduce((s, r) => s + r.damaged, 0),
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

  async createAdjustment(dto: CreateAdjustmentDto) {
    await this.masterListGuard.assertValid(
      this.scope,
      "stock_adjustment_reason",
      dto.reason,
      "Adjustment reason",
    );
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

  async removeAdjustment(id: number) {
    const ok = await this.repository.removeAdjustment(
      this.scope,
      id,
      this.actor,
    );
    if (!ok) throw new ResourceNotFoundException("Stock adjustment", id);
  }
  async removeTransfer(id: number) {
    const ok = await this.repository.removeTransfer(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Stock transfer", id);
  }
  async removeBatch(id: number) {
    const ok = await this.repository.removeBatch(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Batch", id);
  }
  async removeSerial(id: number) {
    const ok = await this.repository.removeSerial(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Serial number", id);
  }
  async removeReservation(id: number) {
    const ok = await this.repository.removeReservation(
      this.scope,
      id,
      this.actor,
    );
    if (!ok) throw new ResourceNotFoundException("Reservation", id);
  }

  async reverseLedgerEntry(id: number) {
    const result = await this.repository.reverseLedgerEntry(
      this.scope,
      id,
      this.actor,
    );
    if (!result) throw new ResourceNotFoundException("Ledger entry", id);
    return result;
  }

  /** Create + approve in one step (product page stock edits). */
  async applyAdjustment(dto: CreateAdjustmentDto) {
    await this.masterListGuard.assertValid(
      this.scope,
      "stock_adjustment_reason",
      dto.reason,
      "Adjustment reason",
    );
    return this.repository.applyAdjustment(this.scope, dto, this.actor);
  }
}
