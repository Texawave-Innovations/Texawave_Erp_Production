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
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { DocumentFieldsService } from "./document-fields.service.js";
import {
  CreateDocumentFieldDto,
  QueryDocumentFieldDto,
  UpdateDocumentFieldDto,
} from "./dto/document-field.dto.js";
import { MAX_IMAGE_BYTES, type UploadedImage } from "./image-upload.js";

const READ = "sales.master.read";
const WRITE = "sales.master.write";

/** Sales master list → document fields: validity, delivery and payment
 * terms, HSN codes, bank accounts, seals, signatures and prepared-by for
 * quotations, proforma / tax invoices and delivery challans. */
@ApiTags("sales-master-list")
@Controller("sales/master/document-fields")
export class DocumentFieldsController {
  constructor(private readonly fields: DocumentFieldsService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Options, filtered by document type and field" })
  findAll(@Query() query: QueryDocumentFieldDto) {
    return this.fields.findAll(query);
  }

  // Declared before ":id" so "layout" is not parsed as an id.
  @Get("layout")
  @RequirePermission(READ)
  @ApiOperation({ summary: "Which fields each document type has" })
  layout() {
    return this.fields.layout();
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.fields.findOne(id);
  }

  @Get(":id/image")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "The seal / signature image" })
  async image(@Param("id", ParseIntPipe) id: number) {
    const file = await this.fields.readImage(id);
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: "inline",
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Add an option to a document field" })
  create(@Body() dto: CreateDocumentFieldDto) {
    return this.fields.create(dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Edit an option; issued documents keep what they copied",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentFieldDto,
  ) {
    return this.fields.update(id, dto);
  }

  @Put(":id/image")
  @RequirePermission(WRITE)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload or replace a seal / signature image (PNG or JPG, ≤ 2 MB, field: file)",
  })
  uploadImage(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    return this.fields.uploadImage(id, file);
  }

  @Delete(":id")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.fields.remove(id);
  }
}
