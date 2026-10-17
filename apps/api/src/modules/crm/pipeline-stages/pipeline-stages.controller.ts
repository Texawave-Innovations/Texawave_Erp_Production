import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { PipelineStagesService } from "./pipeline-stages.service.js";
import {
  CreatePipelineStageDto,
  ReorderPipelineStagesDto,
  UpdatePipelineStageDto,
} from "./dto/pipeline-stage.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
 * pipelineStagesService.ts (RTDB `crm/pipelineStages`, self-seeded on
 * first read — see seed.ts). Organization-wide configuration, not
 * team/owner-scoped — see the catalog.ts note on crm.pipeline_stage.*. */
@ApiTags("crm-pipeline-stages")
@Controller("crm/pipeline-stages")
export class PipelineStagesController {
  constructor(private readonly stages: PipelineStagesService) {}

  @Get()
  @RequirePermission("crm.pipeline_stage.read")
  @ApiOperation({
    summary:
      "List every pipeline stage for this organization, ordered for the board",
  })
  findAll() {
    return this.stages.findAll();
  }

  @Get(":id")
  @RequirePermission("crm.pipeline_stage.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.stages.findOne(id);
  }

  @Post()
  @RequirePermission("crm.pipeline_stage.write")
  @ApiOperation({ summary: "Create a custom pipeline stage" })
  create(@Body() dto: CreatePipelineStageDto) {
    return this.stages.create(dto);
  }

  @Patch("reorder")
  @RequirePermission("crm.pipeline_stage.write")
  @ApiOperation({ summary: "Reassign every stage's order in one pass" })
  reorder(@Body() dto: ReorderPipelineStagesDto) {
    return this.stages.reorder(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.pipeline_stage.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    return this.stages.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("crm.pipeline_stage.write")
  @ApiOperation({
    summary:
      "Soft-delete a stage (refused if any opportunity is currently in it)",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.stages.remove(id);
  }
}
