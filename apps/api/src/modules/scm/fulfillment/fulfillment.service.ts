import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  AssignPickerDto,
  CreateFulfillmentDto,
  CreatePackingDto,
  QueryFulfillmentDto,
  QueryPackingDto,
  QueryPickingDto,
  RecordPickDto,
} from "./dto/fulfillment.dto.js";
import { FulfillmentsRepository } from "./fulfillments.repository.js";
import { PackingsRepository } from "./packings.repository.js";
import { PickingsRepository } from "./pickings.repository.js";

/** Orchestrates fulfillment, picking and packing (legacy
 * `orderFulfillmentService` + the warehouse picking/packing screens). */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly fulfillments: FulfillmentsRepository,
    private readonly pickings: PickingsRepository,
    private readonly packings: PackingsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  private orNotFound<T>(what: string, id: number, row: T | null): T {
    if (!row) throw new ResourceNotFoundException(what, id);
    return row;
  }

  // ---- fulfillments ---------------------------------------------------------

  async listFulfillments(query: QueryFulfillmentDto) {
    const { items, total } = await this.fulfillments.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getFulfillment(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.findOne(this.scope, id),
    );
  }
  createFulfillment(dto: CreateFulfillmentDto) {
    return this.fulfillments.create(this.scope, dto, this.actor);
  }
  async reserve(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.reserve(this.scope, id, this.actor),
    );
  }
  async release(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.release(this.scope, id, this.actor),
    );
  }
  async createPick(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.createPick(this.scope, id, this.actor),
    );
  }
  async shortageRequisition(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.createShortageRequisition(
        this.scope,
        id,
        this.actor,
      ),
    );
  }
  async finalize(id: number) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.finalize(this.scope, id, this.actor),
    );
  }
  async cancel(id: number, reason: string) {
    return this.orNotFound(
      "Fulfillment",
      id,
      await this.fulfillments.cancel(this.scope, id, reason.trim(), this.actor),
    );
  }

  // ---- pickings -------------------------------------------------------------

  async listPickings(query: QueryPickingDto) {
    const { items, total } = await this.pickings.findMany(
      this.scope,
      { q: query.q, status: query.status, packable: Boolean(query.packable) },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getPicking(id: number) {
    return this.orNotFound(
      "Pick list",
      id,
      await this.pickings.findOne(this.scope, id),
    );
  }
  async startPick(id: number) {
    return this.orNotFound(
      "Pick list",
      id,
      await this.pickings.start(this.scope, id, this.actor),
    );
  }
  async assignPick(id: number, dto: AssignPickerDto) {
    return this.orNotFound(
      "Pick list",
      id,
      await this.pickings.assign(
        this.scope,
        id,
        dto.pickerName.trim(),
        this.actor,
      ),
    );
  }
  async recordPick(id: number, dto: RecordPickDto) {
    return this.orNotFound(
      "Pick list",
      id,
      await this.pickings.record(this.scope, id, dto, this.actor),
    );
  }
  async cancelPick(id: number) {
    return this.orNotFound(
      "Pick list",
      id,
      await this.pickings.cancel(this.scope, id, this.actor),
    );
  }

  // ---- packings -------------------------------------------------------------

  async listPackings(query: QueryPackingDto) {
    const { items, total } = await this.packings.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async getPacking(id: number) {
    return this.orNotFound(
      "Packing",
      id,
      await this.packings.findOne(this.scope, id),
    );
  }
  createPacking(dto: CreatePackingDto) {
    return this.packings.create(this.scope, dto, this.actor);
  }
  async markPacked(id: number) {
    return this.orNotFound(
      "Packing",
      id,
      await this.packings.transition(
        this.scope,
        id,
        ["PENDING", "IN_PROGRESS"],
        "PACKED",
        this.actor,
      ),
    );
  }
  async cancelPacking(id: number) {
    return this.orNotFound(
      "Packing",
      id,
      await this.packings.transition(
        this.scope,
        id,
        ["PENDING", "IN_PROGRESS", "PACKED"],
        "CANCELLED",
        this.actor,
      ),
    );
  }

  async removeFulfillment(id: number) {
    const ok = await this.fulfillments.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Fulfillment", id);
  }
  async removePicking(id: number) {
    const ok = await this.pickings.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Pick list", id);
  }
  async removePacking(id: number) {
    const ok = await this.packings.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Packing", id);
  }
}
