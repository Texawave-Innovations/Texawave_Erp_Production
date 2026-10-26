import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CarriersRepository } from "./carriers.repository.js";
import type {
  AssignCarrierDto,
  CreateCarrierDto,
  CreateShipmentDto,
  DeliverShipmentDto,
  QueryCarrierDto,
  QueryShipmentDto,
  RecordExceptionDto,
  ShipmentStatusUpdateDto,
  UpdateCarrierDto,
} from "./dto/logistics.dto.js";
import { ShipmentsRepository } from "./shipments.repository.js";

@Injectable()
export class LogisticsService {
  constructor(
    private readonly carriers: CarriersRepository,
    private readonly shipments: ShipmentsRepository,
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

  // ---- carriers ---------------------------------------------------------------

  async listCarriers(query: QueryCarrierDto) {
    const { items, total } = await this.carriers.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  carrierOptions() {
    return this.carriers.findOptions(this.scope);
  }
  async getCarrier(id: number) {
    return this.nf("Carrier", id, await this.carriers.findOne(this.scope, id));
  }
  async createCarrier(dto: CreateCarrierDto) {
    const clash = await this.carriers.findByCode(this.scope, dto.carrierCode);
    if (clash) {
      throw new ResourceConflictException(
        `Carrier code "${dto.carrierCode}" already exists.`,
      );
    }
    try {
      return await this.carriers.create(this.scope, dto, this.actor);
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          `Carrier code "${dto.carrierCode}" already exists.`,
        );
      }
      throw error;
    }
  }
  async updateCarrier(id: number, dto: UpdateCarrierDto) {
    return this.nf(
      "Carrier",
      id,
      await this.carriers.update(this.scope, id, dto, this.actor),
    );
  }

  // ---- shipments --------------------------------------------------------------

  async listShipments(query: QueryShipmentDto) {
    const { items, total } = await this.shipments.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getShipment(id: number) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.findOne(this.scope, id),
    );
  }
  shippable() {
    return this.shipments.findShippable(this.scope);
  }
  async listEvents(query: PaginationDto & { q?: string }) {
    const { items, total } = await this.shipments.findEvents(
      this.scope,
      query,
      query.q,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  createShipment(dto: CreateShipmentDto) {
    return this.shipments.create(this.scope, dto, this.actor);
  }
  async assignCarrier(id: number, dto: AssignCarrierDto) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.assignCarrier(this.scope, id, dto, this.actor),
    );
  }
  async createLabel(id: number, trackingNumber: string) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.createLabel(
        this.scope,
        id,
        trackingNumber,
        this.actor,
      ),
    );
  }
  async dispatch(id: number) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.dispatch(this.scope, id, this.actor),
    );
  }
  async updateStatus(id: number, dto: ShipmentStatusUpdateDto) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.updateStatus(
        this.scope,
        id,
        dto.status,
        this.actor,
        dto,
      ),
    );
  }
  async deliver(id: number, dto: DeliverShipmentDto) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.deliver(this.scope, id, dto, this.actor),
    );
  }
  async recordException(id: number, dto: RecordExceptionDto) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.recordException(this.scope, id, dto, this.actor),
    );
  }
  async resolveException(id: number, exceptionId: number, resolution: string) {
    return this.nf(
      "Shipment exception",
      exceptionId,
      await this.shipments.resolveException(
        this.scope,
        id,
        exceptionId,
        resolution,
        this.actor,
      ),
    );
  }
  async failDelivery(id: number, reason: string) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.failDelivery(
        this.scope,
        id,
        reason.trim(),
        this.actor,
      ),
    );
  }
  async cancel(id: number, reason: string) {
    return this.nf(
      "Shipment",
      id,
      await this.shipments.cancel(this.scope, id, reason.trim(), this.actor),
    );
  }

  async removeCarrier(id: number) {
    const ok = await this.carriers.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Carrier", id);
  }
  async removeShipment(id: number) {
    const ok = await this.shipments.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Shipment", id);
  }
}
