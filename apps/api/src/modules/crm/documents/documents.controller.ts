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
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CrmDocumentsService } from "./documents.service.js";
import {
  CreateCrmDocumentDto,
  QueryCrmDocumentDto,
} from "./dto/document.dto.js";

@ApiTags("crm-documents")
@Controller("crm/documents")
export class CrmDocumentsController {
  constructor(private readonly documents: CrmDocumentsService) {}

  @Get()
  @RequirePermission("crm.document.read")
  findAll(@Paginate(QueryCrmDocumentDto) query: QueryCrmDocumentDto) {
    return this.documents.findAll(query);
  }

  @Post()
  @RequirePermission("crm.document.write")
  create(@Body() dto: CreateCrmDocumentDto) {
    return this.documents.create(dto);
  }

  @Delete(":id")
  @RequirePermission("crm.document.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.documents.remove(id);
  }
}
