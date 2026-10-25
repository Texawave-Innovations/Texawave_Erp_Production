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
  CreateMomTemplateDto,
  UpdateMomTemplateDto,
} from "./dto/template.dto.js";
import { MomTemplatesService } from "./mom-templates.service.js";

@ApiTags("MoM Templates")
@ApiBearerAuth()
@Controller("mom/templates")
export class MomTemplatesController {
  constructor(private readonly service: MomTemplatesService) {}

  @Get()
  @RequirePermission("projects.mom.read")
  @ApiOperation({ summary: "List MoM templates" })
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @RequirePermission("projects.mom.read")
  @ApiOperation({ summary: "Get a MoM template by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({ summary: "Create a MoM template" })
  create(@Body() dto: CreateMomTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({ summary: "Update a MoM template" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMomTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/publish")
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({ summary: "Publish a draft template (locks this version)" })
  publish(@Param("id", ParseIntPipe) id: number) {
    return this.service.publish(id);
  }

  @Post(":id/duplicate")
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({ summary: "Duplicate a template as an independent draft" })
  duplicate(@Param("id", ParseIntPipe) id: number) {
    return this.service.duplicate(id);
  }

  @Post(":id/new-version")
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({
    summary: "Create the next draft version of a published template",
  })
  createNewVersion(@Param("id", ParseIntPipe) id: number) {
    return this.service.createNewVersion(id);
  }

  @Delete(":id")
  @RequirePermission("projects.mom.manage_templates")
  @ApiOperation({ summary: "Archive a MoM template" })
  softDelete(@Param("id", ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }
}
