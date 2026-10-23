import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { DocumentNumberingService } from "./document-numbering.service.js";
import { UpdateDocumentNumberingDto } from "./dto/update-document-numbering.dto.js";
import type { SalesDocumentType } from "./sales-settings.constants.js";

/** Numbering tab of Sales Settings — the 8 document-prefix fields, backed by
 * the existing `document_sequences` table. */
@ApiTags("sales-settings-document-numbering")
@Controller("sales-settings/document-numbering")
export class DocumentNumberingController {
  constructor(private readonly numbering: DocumentNumberingService) {}

  @Get()
  @RequirePermission("sales_settings.document_numbering.read")
  @ApiOperation({ summary: "List the prefix/padding for every document type" })
  findAll() {
    return this.numbering.findAll();
  }

  @Put(":docType")
  @RequirePermission("sales_settings.document_numbering.write")
  @ApiOperation({
    summary: "Create or replace a document type's prefix/padding",
  })
  upsert(
    @Param("docType") docType: string,
    @Body() dto: UpdateDocumentNumberingDto,
  ) {
    return this.numbering.upsert(docType as SalesDocumentType, dto);
  }
}
