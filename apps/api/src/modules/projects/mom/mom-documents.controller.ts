import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateMomDocumentDto,
  QueryMomDocumentDto,
  StartMomRevisionDto,
  UpdateMomDocumentDto,
} from "./dto/document.dto.js";
import { MomDocumentsService } from "./mom-documents.service.js";

@ApiTags("Minutes of Meeting")
@ApiBearerAuth()
@Controller("mom")
export class MomDocumentsController {
  constructor(private readonly service: MomDocumentsService) {}

  @Get()
  @RequirePermission("projects.mom.read")
  @ApiOperation({ summary: "List meeting minutes (the MoM Register)" })
  findAll(@Query() query: QueryMomDocumentDto) {
    return this.service.findAll(query);
  }

  @Get("stats")
  @RequirePermission("projects.mom.read")
  @ApiOperation({
    summary: "Register stat cards: totals by status and revisions in progress",
  })
  getStats() {
    return this.service.getStats();
  }

  @Get("by-project/:projectId")
  @RequirePermission("projects.mom.read")
  @ApiOperation({
    summary: "List meeting minutes for a project (Meeting History section)",
  })
  findByProject(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.service.findByProjectId(projectId);
  }

  @Get(":id")
  @RequirePermission("projects.mom.read")
  @ApiOperation({ summary: "Get a MoM document with revisions and history" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission("projects.mom.write")
  @ApiOperation({ summary: "Create a draft MoM with auto-issued reference" })
  create(@Body() dto: CreateMomDocumentDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects.mom.write")
  @ApiOperation({
    summary:
      "Update a draft MoM, or a finalized one with a revision in progress",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMomDocumentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/finalize")
  @RequirePermission("projects.mom.write")
  @ApiOperation({ summary: "Finalize a draft MoM" })
  finalize(@Param("id", ParseIntPipe) id: number) {
    return this.service.finalize(id);
  }

  @Post(":id/revisions/start")
  @RequirePermission("projects.mom.write")
  @ApiOperation({
    summary: "Start a revision on a finalized MoM (snapshots the prior state)",
  })
  startRevision(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StartMomRevisionDto,
  ) {
    return this.service.startRevision(id, dto);
  }

  @Post(":id/revisions/finalize")
  @RequirePermission("projects.mom.write")
  @ApiOperation({ summary: "Finalize the in-progress revision" })
  finalizeRevision(@Param("id", ParseIntPipe) id: number) {
    return this.service.finalizeRevision(id);
  }

  @Post(":id/archive")
  @RequirePermission("projects.mom.delete")
  @ApiOperation({ summary: "Archive a MoM" })
  archive(@Param("id", ParseIntPipe) id: number) {
    return this.service.archive(id);
  }

  @Post(":id/restore")
  @RequirePermission("projects.mom.write")
  @ApiOperation({ summary: "Restore an archived MoM to its prior status" })
  restore(@Param("id", ParseIntPipe) id: number) {
    return this.service.restore(id);
  }

  @Delete(":id")
  @RequirePermission("projects.mom.delete")
  @ApiOperation({ summary: "Soft delete a MoM" })
  softDelete(@Param("id", ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }
}
