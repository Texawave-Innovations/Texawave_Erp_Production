import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreatePaymentBatchDto,
  QueryPaymentBatchDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";
import { PaymentsService } from "./payments.service.js";

@ApiTags("hr-payments")
@Controller("hr")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get("payment-batches")
  @RequireScopedPermission("hr.payment.read")
  @ApiOperation({ summary: "List payment batches" })
  findBatches(@Paginate(QueryPaymentBatchDto) query: QueryPaymentBatchDto) {
    return this.service.findBatches(query);
  }

  @Post("payment-batches")
  @RequireScopedPermission("hr.payment.write")
  @ApiOperation({
    summary: "Generate a new payment batch for an approved payroll period",
  })
  createBatch(@Body() dto: CreatePaymentBatchDto) {
    return this.service.createBatch(dto);
  }

  @Get("payment-batches/:id")
  @RequireScopedPermission("hr.payment.read")
  @ApiOperation({ summary: "Get payment batch details and list of payments" })
  findBatchById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findBatchById(id);
  }

  @Post("payment-batches/:id/process")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.payment.write")
  @ApiOperation({
    summary: "Mark payment batch and child payments as processed/paid",
  })
  processBatch(@Param("id", ParseIntPipe) id: number) {
    return this.service.processBatch(id);
  }

  @Get("payment-batches/:id/export")
  @RequireScopedPermission("hr.payment.read")
  @ApiOperation({ summary: "Export bank transfer CSV payload for batch" })
  async exportBatch(@Param("id", ParseIntPipe) id: number) {
    const csv = await this.service.exportBatchCsv(id);
    return {
      fileName: `bank-transfer-batch-${id}.csv`,
      content: csv,
    };
  }

  @Patch("payments/:id")
  @RequireScopedPermission("hr.payment.write")
  @ApiOperation({ summary: "Update payment status or bank reference" })
  updatePayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.service.updatePayment(id, dto);
  }
}
