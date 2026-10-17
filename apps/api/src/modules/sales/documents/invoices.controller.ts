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
import { DeliveryChallansService } from "./delivery-challans.service.js";
import { SendDocumentEmailDto } from "./dto/document-parts.dto.js";
import {
  ConvertToDeliveryChallanDto,
  ConvertToTaxInvoiceDto,
  CreateInvoiceDto,
  NextInvoiceNumberQueryDto,
  QueryInvoiceDto,
  UpdateInvoiceDto,
} from "./dto/invoice.dto.js";
import { RecordPaymentDto } from "./dto/payment.dto.js";
import { InvoicesService } from "./invoices.service.js";

const READ = "sales.invoice.read";
const WRITE = "sales.invoice.write";
const DELETE = "sales.invoice.delete";
const SEND = "sales.invoice.send";
const PAYMENT = "sales.invoice_payment.write";

/** Proforma and tax invoices (`invoiceType`), with their payments. */
@ApiTags("sales-invoices")
@Controller("sales/invoices")
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly deliveryChallans: DeliveryChallansService,
  ) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Invoices (type, status, search, customer, dates)" })
  findAll(@Paginate(QueryInvoiceDto) query: QueryInvoiceDto) {
    return this.invoices.findAll(query);
  }

  // Declared before ":id" so "next-number" is not parsed as an id.
  @Get("next-number")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Preview the next PI / tax invoice number" })
  nextNumber(@Query() query: NextInvoiceNumberQueryDto) {
    return this.invoices.nextNumber(query.invoiceType, query.date);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.invoices.findOne(id);
  }

  @Get(":id/pdf")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "Download the invoice as PDF" })
  async pdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.invoices.pdf(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({
    summary:
      "Create a proforma or tax invoice; number, taxes, totals by the server",
  })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Post("preview")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Live preview of an unsaved invoice: server totals and the PDF's HTML (nothing stored)",
  })
  preview(@Body() dto: CreateInvoiceDto) {
    return this.invoices.preview(dto);
  }

  @Post(":id/preview")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Live preview of edits to a saved invoice" })
  previewUpdate(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.previewUpdate(id, dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Edit an invoice (re-priced)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.invoices.remove(id);
  }

  @Post(":id/convert-to-tax")
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Move a proforma to a new tax invoice; payments move with it",
  })
  convertToTax(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConvertToTaxInvoiceDto,
  ) {
    return this.invoices.convertToTax(id, dto);
  }

  @Post(":id/delivery-challan")
  @RequirePermission("sales.delivery_challan.write")
  @ApiOperation({ summary: "Move a tax invoice's items to a delivery challan" })
  toDeliveryChallan(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConvertToDeliveryChallanDto,
  ) {
    return this.deliveryChallans.createFromInvoice(id, dto);
  }

  @Post(":id/payments")
  @RequirePermission(PAYMENT)
  @ApiOperation({ summary: "Record a payment (≤ balance)" })
  recordPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoices.recordPayment(id, dto);
  }

  @Delete(":id/payments/:paymentId")
  @RequirePermission(PAYMENT)
  @ApiOperation({ summary: "Delete a recorded payment" })
  deletePayment(
    @Param("id", ParseIntPipe) id: number,
    @Param("paymentId", ParseIntPipe) paymentId: number,
  ) {
    return this.invoices.deletePayment(id, paymentId);
  }

  @Post(":id/email")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Email the invoice PDF (audited)" })
  email(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendDocumentEmailDto,
  ) {
    return this.invoices.email(id, dto);
  }

  @Post(":id/whatsapp")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "A wa.me share link for the invoice (audited)" })
  whatsapp(@Param("id", ParseIntPipe) id: number) {
    return this.invoices.whatsapp(id);
  }
}
