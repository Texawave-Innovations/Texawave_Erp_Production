import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  OpportunitiesRepository,
  type OpportunityFilter,
} from "./opportunities.repository.js";
import type {
  ChangeStageDto,
  CreateOpportunityDto,
  MarkLostDto,
  MarkWonDto,
  QueryOpportunityDto,
  ReopenDto,
  SetOnHoldDto,
  SetStuckReasonDto,
  UpdateOpportunityDto,
} from "./dto/opportunity.dto.js";

const READ = "crm.opportunity.read";
const WRITE = "crm.opportunity.write";

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly repository: OpportunitiesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryOpportunityDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async findStageHistory(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.findStageHistory(scope, id);
    if (rows === null) throw new ResourceNotFoundException("Opportunity", id);
    return rows;
  }

  async create(dto: CreateOpportunityDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateOpportunityDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async changeStage(id: number, dto: ChangeStageDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.changeStage(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async markWon(id: number, dto: MarkWonDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.markWon(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async markLost(id: number, dto: MarkLostDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.markLost(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async setOnHold(id: number, dto: SetOnHoldDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.setOnHold(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async reopen(id: number, dto: ReopenDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.reopen(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async setStuckReason(id: number, dto: SetStuckReasonDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.setStuckReason(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  async remove(id: number) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Opportunity", id);
    return row;
  }

  private filterOf(query: QueryOpportunityDto): OpportunityFilter {
    return {
      q: query.q,
      accountId: query.accountId,
      stageId: query.stageId,
      status: query.status,
    };
  }
}
