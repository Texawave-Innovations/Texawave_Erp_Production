import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CompleteMeetingDto,
  CreateMeetingDto,
  QueryMeetingDto,
  RescheduleMeetingDto,
  UpdateMeetingDto,
  UpdateMeetingStatusDto,
} from "./dto/meeting.dto.js";
import { MeetingsRepository } from "./meetings.repository.js";

@Injectable()
export class MeetingsService {
  constructor(
    private readonly repository: MeetingsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryMeetingDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        relatedType: query.relatedType,
        relatedId: query.relatedId,
        status: query.status,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }

  create(dto: CreateMeetingDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateMeetingDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }

  async updateStatus(id: number, dto: UpdateMeetingStatusDto) {
    const row = await this.repository.updateStatus(
      this.tenantContext.getOrgScope(),
      id,
      dto.status,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }

  async complete(id: number, dto: CompleteMeetingDto) {
    const row = await this.repository.complete(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }

  async reschedule(id: number, dto: RescheduleMeetingDto) {
    const row = await this.repository.reschedule(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Meeting", id);
    return row;
  }
}
