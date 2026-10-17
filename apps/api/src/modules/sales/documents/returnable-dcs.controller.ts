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
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  NextNumberQueryDto,
  SendDocumentEmailDto,
} from "./dto/document-parts.dto.js";
import {
  CreateReturnableDcDto,
  MarkReturnedDto,
  QueryReturnableDcDto,
  UpdateReturnableDcDto,
} from "./dto/returnable-dc.dto.js";
import { ReturnableDcsService } from "./returnable-dcs.service.js";

const READ = "sales.returnable_dc.read";
const WRITE = "sales.returnable_dc.write";
const DELETE = "sales.returnable_dc.delete";
const SEND = "sales.returnable_dc.send";

@ApiTags("sales-returnable-dcs")
@Controller("sales/returnable-dcs")
export class ReturnableDcsController {
  constructor(private readonly rdcs: ReturnableDcsService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({
    summary: "Returnable DCs (search, customer, status, date or month)",
  })
  findAll(@Paginate(QueryReturnableDcDto) query: QueryReturnableDcDto) {
    return this.rdcs.findAll(query);
  }

  // Declared before ":id" so "next-number" is not parsed as an id.
  @Get("next-number")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Preview the next RDC number (not reserved)" })
  nextNumber(@Query() query: NextNumberQueryDto) {
    return this.rdcs.nextNumber(query.date);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rdcs.findOne(id);
  }

  @Get(":id/pdf")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "Download the returnable DC as PDF" })
  async pdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.rdcs.pdf(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Create a returnable DC (status Issued)" })
  create(@Body() dto: CreateReturnableDcDto) {
    return this.rdcs.create(dto);
  }

  @Post("preview")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Live preview of an unsaved returnable DC (nothing stored)",
  })
  preview(@Body() dto: CreateReturnableDcDto) {
    return this.rdcs.preview(dto);
  }

  @Post(":id/preview")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Live preview of edits to a returnable DC that is not returned",
  })
  previewUpdate(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReturnableDcDto,
  ) {
    return this.rdcs.previewUpdate(id, dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Edit a returnable DC that is not returned yet" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReturnableDcDto,
  ) {
    return this.rdcs.update(id, dto);
  }

  @Post(":id/return")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark the goods returned" })
  markReturned(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MarkReturnedDto,
  ) {
    return this.rdcs.markReturned(id, dto);
  }

  @Post(":id/reopen")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Undo 'returned' (back to pending return)" })
  reopen(@Param("id", ParseIntPipe) id: number) {
    return this.rdcs.reopen(id);
  }

  @Delete(":id")
  @RequirePermission(DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.rdcs.remove(id);
  }

  @Post(":id/email")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Email the returnable DC PDF (audited)" })
  email(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendDocumentEmailDto,
  ) {
    return this.rdcs.email(id, dto);
  }

  @Post(":id/whatsapp")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "A wa.me share link for the RDC (audited)" })
  whatsapp(@Param("id", ParseIntPipe) id: number) {
    return this.rdcs.whatsapp(id);
  }
}
