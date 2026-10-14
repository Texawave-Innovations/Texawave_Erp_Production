import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateRevisionLetterDto,
  QueryRevisionLetterDto,
  UpdateRevisionLetterDto,
} from "./dto/revision-letter.dto.js";
import { RevisionLettersService } from "./revision-letters.service.js";

/** Recruitment → Revision Letter. Team-scoped through the employee: reads and
 * writes are own/team/all, and a row outside the caller's scope is a 404.
 * There is no delete route and no approval workflow: legacy has neither. */
@ApiTags("hr-revision-letters")
@Controller("hr/revision-letters")
export class RevisionLettersController {
  constructor(private readonly letters: RevisionLettersService) {}

  @Get()
  @RequireScopedPermission("hr.revision_letter.read")
  @ApiOperation({ summary: "Revision letters in the caller's scope" })
  findAll(@Paginate(QueryRevisionLetterDto) query: QueryRevisionLetterDto) {
    return this.letters.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.revision_letter.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.letters.findOne(id);
  }

  @Post()
  @RequireScopedPermission("hr.revision_letter.write")
  @ApiOperation({ summary: "Issue a revision letter to an employee in scope" })
  create(@Body() dto: CreateRevisionLetterDto) {
    return this.letters.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.revision_letter.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRevisionLetterDto,
  ) {
    return this.letters.update(id, dto);
  }
}
