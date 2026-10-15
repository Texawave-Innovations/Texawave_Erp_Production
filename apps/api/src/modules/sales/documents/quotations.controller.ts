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
import { ConvertQuotationDto } from "./dto/invoice.dto.js";
import {
  CreateQuotationDto,
  QueryQuotationDto,
  UpdateQuotationDto,
} from "./dto/quotation.dto.js";
import { InvoicesService } from "./invoices.service.js";
import { QuotationsService } from "./quotations.service.js";

const READ = "sales.quotation.read";
const WRITE = "sales.quotation.write";
const DELETE = "sales.quotation.delete";
const SEND = "sales.quotation.send";

@ApiTags("sales-quotations")
@Controller("sales/quotations")
export class QuotationsController {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly invoices: InvoicesService,
  ) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Quotations (search, customer, date range)" })
  findAll(@Paginate(QueryQuotationDto) query: QueryQuotationDto) {
    return this.quotations.findAll(query);
  }

  // Declared before ":id" so "next-number" is not parsed as an id.
  @Get("next-number")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Preview the next quotation number (not reserved)" })
  nextNumber(@Query() query: NextNumberQueryDto) {
    return this.quotations.nextNumber(query.date);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.findOne(id);
  }

  @Get(":id/pdf")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "Export the quotation as PDF" })
  async pdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.quotations.pdf(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Create a quotation; number, taxes and totals by the server",
  })
  create(@Body() dto: CreateQuotationDto) {
    return this.quotations.create(dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Edit an open quotation (re-priced)" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotations.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.quotations.remove(id);
  }

  @Post(":id/convert")
  @RequirePermission("sales.invoice.write")
  @ApiOperation({
    summary:
      "Convert to a proforma (default) or tax invoice; the quotation is then locked",
  })
  convert(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConvertQuotationDto,
  ) {
    return this.invoices.createFromQuotation(id, dto);
  }

  @Post(":id/email")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Email the quotation PDF (audited)" })
  email(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendDocumentEmailDto,
  ) {
    return this.quotations.email(id, dto);
  }

  @Post(":id/whatsapp")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "A wa.me share link for the quotation (audited)" })
  whatsapp(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.whatsapp(id);
  }
}
