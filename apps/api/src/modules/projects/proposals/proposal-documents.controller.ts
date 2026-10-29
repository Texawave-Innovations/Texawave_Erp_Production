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
  CreateProposalDocumentDto,
  ExtendFollowupDto,
  QueryProposalDocumentDto,
  TransitionProposalDto,
  UpdateProposalDocumentDto,
} from "./dto/document.dto.js";
import { ProposalDocumentsService } from "./proposal-documents.service.js";

@ApiTags("Proposal Documents")
@ApiBearerAuth()
@Controller("proposals")
export class ProposalDocumentsController {
  constructor(private readonly service: ProposalDocumentsService) {}

  @Get()
  @RequirePermission("projects.proposals.read")
  @ApiOperation({ summary: "List proposal documents with filters" })
  findAll(@Query() query: QueryProposalDocumentDto) {
    return this.service.findAll(query);
  }

  @Get("stats")
  @RequirePermission("projects.proposals.read")
  @ApiOperation({
    summary: "Hub stat cards: counts by status, follow-ups due, client list",
  })
  getStats() {
    return this.service.getStats();
  }

  @Get(":id")
  @RequirePermission("projects.proposals.read")
  @ApiOperation({
    summary: "Get a proposal document with its workflow/audit history",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission("projects.proposals.write")
  @ApiOperation({
    summary: "Create a proposal document with auto-issued proposal number",
  })
  create(@Body() dto: CreateProposalDocumentDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects.proposals.write")
  @ApiOperation({ summary: "Update proposal section values and metadata" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProposalDocumentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/transition")
  @RequirePermission("projects.proposals.send")
  @ApiOperation({
    summary:
      "Move a proposal through its workflow (submit_for_review, review_approve, request_changes, send_to_client, record_accepted, record_rejected, revert_to_draft, archive)",
  })
  transition(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: TransitionProposalDto,
  ) {
    return this.service.transition(id, dto);
  }

  @Post(":id/extend-followup")
  @RequirePermission("projects.proposals.write")
  @ApiOperation({ summary: "Extend a proposal's follow-up due date" })
  extendFollowup(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ExtendFollowupDto,
  ) {
    return this.service.extendFollowup(id, dto);
  }

  @Post(":id/duplicate")
  @RequirePermission("projects.proposals.write")
  @ApiOperation({
    summary: "Duplicate a proposal as a new draft with its own number",
  })
  duplicate(@Param("id", ParseIntPipe) id: number) {
    return this.service.duplicate(id);
  }

  @Delete(":id")
  @RequirePermission("projects.proposals.delete")
  @ApiOperation({ summary: "Soft delete a proposal document" })
  softDelete(@Param("id", ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }
}
