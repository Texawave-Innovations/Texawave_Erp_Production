import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateInterviewDto,
  QueryInterviewDto,
  UpdateInterviewStatusDto,
} from "./dto/interview.dto.js";
import { InterviewsRepository } from "./interviews.repository.js";

/** Legacy `InterviewSchedule.tsx` defaults: mode starts as ONLINE. */
const DEFAULT_MODE = "ONLINE" as const;

@Injectable()
export class InterviewsService {
  constructor(
    private readonly repository: InterviewsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryInterviewDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { search: query.search, status: query.status },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Interview", id);
    return row;
  }

  create(dto: CreateInterviewDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        candidateName: dto.candidateName,
        roleTitle: dto.roleTitle,
        interviewerName: dto.interviewerName,
        interviewDate: dto.interviewDate,
        interviewTime: dto.interviewTime,
        mode: dto.mode ?? DEFAULT_MODE,
        notes: dto.notes ? dto.notes : null,
      },
      this.tenantContext.getUserId(),
    );
  }

  async setStatus(id: number, dto: UpdateInterviewStatusDto) {
    const row = await this.repository.setStatus(
      this.tenantContext.getOrgScope(),
      id,
      dto.status,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Interview", id);
    return row;
  }
}
