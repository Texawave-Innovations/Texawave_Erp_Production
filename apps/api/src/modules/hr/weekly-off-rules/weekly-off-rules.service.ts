import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateWeeklyOffRuleDto,
  EndWeeklyOffRuleDto,
  QueryWeeklyOffRuleDto,
  UpdateWeeklyOffRuleDto,
  VoidWeeklyOffRuleDto,
} from "./dto/weekly-off-rule.dto.js";
import { WeeklyOffRulesRepository } from "./weekly-off-rules.repository.js";

@Injectable()
export class WeeklyOffRulesService {
  constructor(
    private readonly repository: WeeklyOffRulesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryWeeklyOffRuleDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        scope: query.scope,
        workLocationId: query.workLocationId,
        teamId: query.teamId,
        activeOn: query.activeOn,
        includeVoided: query.includeVoided,
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
    if (!row) throw new ResourceNotFoundException("Weekly-off rule", id);
    return row;
  }

  create(dto: CreateWeeklyOffRuleDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateWeeklyOffRuleDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Weekly-off rule", id);
    return row;
  }

  async end(id: number, dto: EndWeeklyOffRuleDto) {
    const row = await this.repository.end(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Weekly-off rule", id);
    return row;
  }

  async void(id: number, dto: VoidWeeklyOffRuleDto) {
    const row = await this.repository.voidOne(
      this.tenantContext.getOrgScope(),
      id,
      dto.reason,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Weekly-off rule", id);
    return row;
  }
}
