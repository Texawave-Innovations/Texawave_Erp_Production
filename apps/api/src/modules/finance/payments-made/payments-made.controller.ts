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
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreatePaymentMadeDto } from "./dto/create-payment-made.dto.js";
import { QueryPaymentsMadeDto } from "./dto/query-payments-made.dto.js";
import { UpdatePaymentMadeDto } from "./dto/update-payment-made.dto.js";
import { VoidPaymentMadeDto } from "./dto/void-payment-made.dto.js";
import { PaymentsMadeService } from "./payments-made.service.js";

@ApiTags("finance-payments-made")
@Controller("finance/payments-made")
export class PaymentsMadeController {
  constructor(private readonly paymentsMadeService: PaymentsMadeService) {}

  @Get()
  @RequirePermission("finance.payment_made.read")
  @ApiOperation({
    summary:
      "List supplier disbursements with pagination, vendor, bank, date, and status filters",
  })
  findAll(@Paginate(QueryPaymentsMadeDto) query: QueryPaymentsMadeDto) {
    return this.paymentsMadeService.findAll(query);
  }

  @Get(":id")
  @RequirePermission("finance.payment_made.read")
  @ApiOperation({
    summary:
      "Get payment disbursement details by ID including bank account and GL entry",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.paymentsMadeService.findOne(id);
  }

  @Post()
  @RequirePermission("finance.payment_made.write")
  @ApiOperation({
    summary:
      "Record supplier disbursement (CONFIRMED automatically creates and posts GL journal and deducts bank balance)",
  })
  create(@Body() dto: CreatePaymentMadeDto) {
    return this.paymentsMadeService.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.payment_made.write")
  @ApiOperation({
    summary:
      "Update supplier disbursement metadata (vendorName, referenceNumber, billReference, notes)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentMadeDto,
  ) {
    return this.paymentsMadeService.update(id, dto);
  }

  @Post(":id/confirm")
  @RequirePermission("finance.payment_made.write")
  @ApiOperation({
    summary:
      "Confirm a draft payment and atomically post double-entry GL journal + deduct bank balance",
  })
  confirm(@Param("id", ParseIntPipe) id: number) {
    return this.paymentsMadeService.confirm(id);
  }

  @Post(":id/void")
  @RequirePermission("finance.payment_made.write")
  @ApiOperation({
    summary:
      "Void a disbursement (atomically creates GL reversal voucher and refunds bank balance)",
  })
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto?: VoidPaymentMadeDto,
  ) {
    return this.paymentsMadeService.void(id, dto?.reason);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("finance.payment_made.write")
  @ApiOperation({
    summary: "Soft delete a DRAFT or VOID supplier disbursement",
  })
  async delete(@Param("id", ParseIntPipe) id: number) {
    await this.paymentsMadeService.delete(id);
  }
}
