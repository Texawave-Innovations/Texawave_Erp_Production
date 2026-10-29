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
import { NextNumberQueryDto } from "./dto/document-parts.dto.js";
import {
  CreatePaymentDto,
  QueryPaymentDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";
import { PaymentsService } from "./payments.service.js";

const READ = "sales.payment.read";
// Recording, editing and deleting payments is one permission, as on the
// invoice screen ("Record Payment").
const WRITE = "sales.invoice_payment.write";

@ApiTags("sales-payments")
@Controller("sales/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({
    summary:
      "Payments received (search, customer, invoice, payment/due month, overdue only)",
  })
  findAll(@Paginate(QueryPaymentDto) query: QueryPaymentDto) {
    return this.payments.findAll(query);
  }

  // Declared before ":id" so these are not parsed as an id.
  @Get("alerts")
  @RequirePermission(READ)
  @ApiOperation({ summary: "Due-date alerts: overdue payments and balance" })
  alerts() {
    return this.payments.alerts();
  }

  @Get("next-number")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Preview the next payment number (not reserved)" })
  nextNumber(@Query() query: NextNumberQueryDto) {
    return this.payments.nextNumber(query.date);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.payments.findOne(id);
  }

  @Get(":id/receipt")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "Download the payment receipt as PDF" })
  async receipt(@Param("id", ParseIntPipe) id: number) {
    const file = await this.payments.receipt(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Record a payment against an invoice (≤ balance)" })
  create(@Body() dto: CreatePaymentDto) {
    return this.payments.create(dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Edit a payment (the invoice cannot change)" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePaymentDto) {
    return this.payments.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.payments.remove(id);
  }
}
