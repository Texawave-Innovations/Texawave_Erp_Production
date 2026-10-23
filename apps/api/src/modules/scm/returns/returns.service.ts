import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CompleteReturnInspectionDto,
  CreateCustomerReturnDto,
  CreateVendorReturnDto,
  DispositionDto,
  QueryReturnDto,
  ReceiveReturnDto,
  ReturnShipmentDto,
  ShipVendorReturnDto,
} from "./dto/returns.dto.js";
import { ReturnsRepository } from "./returns.repository.js";

@Injectable()
export class ReturnsService {
  constructor(
    private readonly returns: ReturnsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }
  private nf<T>(id: number, row: T | null): T {
    if (!row) throw new ResourceNotFoundException("Return", id);
    return row;
  }

  async list(query: QueryReturnDto) {
    const { items, total } = await this.returns.findMany(
      this.scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
  async get(id: number) {
    return this.nf(id, await this.returns.findOne(this.scope, id));
  }
  dashboard() {
    return this.returns.dashboard(this.scope);
  }
  customerSources() {
    return this.returns.customerSources(this.scope);
  }
  vendorSources() {
    return this.returns.vendorSources(this.scope);
  }
  createCustomer(dto: CreateCustomerReturnDto) {
    return this.returns.createCustomer(this.scope, dto, this.actor);
  }
  createVendor(dto: CreateVendorReturnDto) {
    return this.returns.createVendor(this.scope, dto, this.actor);
  }

  async submit(id: number) {
    return this.nf(id, await this.returns.submit(this.scope, id, this.actor));
  }
  async approve(id: number) {
    return this.nf(id, await this.returns.approve(this.scope, id, this.actor));
  }
  async reject(id: number, reason: string) {
    return this.nf(
      id,
      await this.returns.reject(this.scope, id, reason.trim(), this.actor),
    );
  }
  async cancel(id: number, reason?: string) {
    return this.nf(
      id,
      await this.returns.cancel(
        this.scope,
        id,
        reason?.trim() ?? "",
        this.actor,
      ),
    );
  }
  async markInTransit(id: number, info: ReturnShipmentDto) {
    return this.nf(
      id,
      await this.returns.markInTransit(this.scope, id, info, this.actor),
    );
  }
  async receive(id: number, dto: ReceiveReturnDto) {
    return this.nf(
      id,
      await this.returns.receive(this.scope, id, dto, this.actor),
    );
  }
  async startInspection(id: number) {
    return this.nf(
      id,
      await this.returns.startInspection(this.scope, id, this.actor),
    );
  }
  async completeInspection(id: number, dto: CompleteReturnInspectionDto) {
    return this.nf(
      id,
      await this.returns.completeInspection(this.scope, id, dto, this.actor),
    );
  }
  async moveToDisposition(id: number) {
    return this.nf(
      id,
      await this.returns.moveToDisposition(this.scope, id, this.actor),
    );
  }
  async disposition(id: number, dto: DispositionDto) {
    return this.nf(
      id,
      await this.returns.disposition(this.scope, id, dto, this.actor),
    );
  }
  async markReadyToShip(id: number) {
    return this.nf(
      id,
      await this.returns.markReadyToShip(this.scope, id, this.actor),
    );
  }
  async shipVendor(id: number, dto: ShipVendorReturnDto) {
    return this.nf(
      id,
      await this.returns.shipVendor(this.scope, id, dto, this.actor),
    );
  }
  async markVendorReceived(id: number) {
    return this.nf(
      id,
      await this.returns.markVendorReceived(this.scope, id, this.actor),
    );
  }
  async complete(id: number) {
    const type = this.nf(id, await this.returns.typeOf(this.scope, id));
    return this.nf(
      id,
      type === "CUSTOMER_RETURN"
        ? await this.returns.completeCustomer(this.scope, id, this.actor)
        : await this.returns.completeVendor(this.scope, id, this.actor),
    );
  }

  async remove(id: number) {
    const ok = await this.returns.remove(this.scope, id, this.actor);
    if (!ok) throw new ResourceNotFoundException("Return", id);
  }
}
