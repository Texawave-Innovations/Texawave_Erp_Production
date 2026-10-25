import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateProposalTemplateDto,
  UpdateProposalTemplateDto,
} from "./dto/template.dto.js";
import { ProposalTemplatesService } from "./proposal-templates.service.js";

@ApiTags("Proposal Templates")
@ApiBearerAuth()
@Controller("proposals/templates")
export class ProposalTemplatesController {
  constructor(private readonly service: ProposalTemplatesService) {}

  @Get()
  @RequirePermission("projects.proposals.read")
  @ApiOperation({ summary: "List proposal templates" })
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @RequirePermission("projects.proposals.read")
  @ApiOperation({ summary: "Get a proposal template by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({ summary: "Create a proposal template" })
  create(@Body() dto: CreateProposalTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({
    summary: "Update a proposal template (publishing sets status to active)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProposalTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/publish")
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({
    summary: "Publish a draft template version (locks it; retires its parent)",
  })
  publish(@Param("id", ParseIntPipe) id: number) {
    return this.service.publish(id);
  }

  @Post(":id/duplicate")
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({ summary: "Duplicate a template as an independent draft" })
  duplicate(@Param("id", ParseIntPipe) id: number) {
    return this.service.duplicate(id);
  }

  @Post(":id/new-version")
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({
    summary: "Create the next draft version of a published template",
  })
  createNewVersion(@Param("id", ParseIntPipe) id: number) {
    return this.service.createNewVersion(id);
  }

  @Delete(":id")
  @RequirePermission("projects.proposals.manage_templates")
  @ApiOperation({ summary: "Archive a proposal template" })
  softDelete(@Param("id", ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }
}
