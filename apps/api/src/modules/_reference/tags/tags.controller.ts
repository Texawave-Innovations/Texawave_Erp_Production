import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateTagDto } from "./dto/create-tag.dto.js";
import { QueryTagDto } from "./dto/query-tag.dto.js";
import { UpdateTagDto } from "./dto/update-tag.dto.js";
import { TagsService } from "./tags.service.js";

/**
 * FIXTURE reference feature — demonstrates Controller → Service → Repository,
 * `@OrgScoped()`, permission checks, pagination, and the response envelope
 * end to end. Not a real business concept; see
 * Docs/CODING_STANDARDS.md "Reference implementation".
 */
@ApiTags("reference-tags")
@Controller("reference/tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermission("reference.tags.read")
  @ApiOperation({ summary: "List tags for the current organization" })
  findAll(@Paginate(QueryTagDto) pagination: QueryTagDto) {
    return this.tags.findAll(pagination);
  }

  @Get(":id")
  @RequirePermission("reference.tags.read")
  findOne(@Param("id") id: string) {
    return this.tags.findOne(id);
  }

  @Post()
  @RequirePermission("reference.tags.write")
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto);
  }

  @Patch(":id")
  @RequirePermission("reference.tags.write")
  update(@Param("id") id: string, @Body() dto: UpdateTagDto) {
    return this.tags.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("reference.tags.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.tags.remove(id);
  }
}
