import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PipelineStagesRepository } from "./pipeline-stages.repository.js";
import type {
  CreatePipelineStageDto,
  ReorderPipelineStagesDto,
  UpdatePipelineStageDto,
} from "./dto/pipeline-stage.dto.js";

@Injectable()
export class PipelineStagesService {
  constructor(
    private readonly repository: PipelineStagesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  findAll() {
    return this.repository.findAll(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
    );
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("PipelineStage", id);
    return row;
  }

  create(dto: CreatePipelineStageDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdatePipelineStageDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("PipelineStage", id);
    return row;
  }

  reorder(dto: ReorderPipelineStagesDto) {
    return this.repository.reorder(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("PipelineStage", id);
    return row;
  }
}
