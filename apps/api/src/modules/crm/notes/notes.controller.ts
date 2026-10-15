import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateCrmNoteDto, QueryCrmNoteDto } from "./dto/note.dto.js";
import { CrmNotesService } from "./notes.service.js";

@ApiTags("crm-notes")
@Controller("crm/notes")
export class CrmNotesController {
  constructor(private readonly notes: CrmNotesService) {}

  @Get()
  @RequirePermission("crm.note.read")
  findByAccount(
    @Query("accountId", ParseIntPipe) accountId: number,
    @Paginate(QueryCrmNoteDto) query: QueryCrmNoteDto,
  ) {
    return this.notes.findByAccount(accountId, query);
  }

  @Post()
  @RequirePermission("crm.note.write")
  create(@Body() dto: CreateCrmNoteDto) {
    return this.notes.create(dto);
  }

  @Delete(":id")
  @RequirePermission("crm.note.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.notes.remove(id);
  }
}
