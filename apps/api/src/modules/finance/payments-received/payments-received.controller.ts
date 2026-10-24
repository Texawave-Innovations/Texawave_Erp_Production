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
import { CreatePaymentAllocationDto } from "./dto/create-allocation.dto.js";
import { CreatePaymentReceivedDto } from "./dto/create-payment-received.dto.js";
import { QueryPaymentsReceivedDto } from "./dto/query-payments-received.dto.js";
import { UpdatePaymentReceivedDto } from "./dto/update-payment-received.dto.js";
import { PaymentsReceivedService } from "./payments-received.service.js";

@ApiTags("finance-payments-received")
@Controller("finance/payments-received")
export class PaymentsReceivedController {
  constructor(
    private readonly paymentsReceivedService: PaymentsReceivedService,
  ) {}

  @Get()
  @RequirePermission("finance.payment_received.read")
  @ApiOperation({
    summary:
      "List customer payments received with pagination, customer, date, and status filters",
  })
  findAll(@Paginate(QueryPaymentsReceivedDto) query: QueryPaymentsReceivedDto) {
    return this.paymentsReceivedService.findAll(query);
  }

  @Get(":id")
  @RequirePermission("finance.payment_received.read")
  @ApiOperation({
    summary:
      "Get customer receipt details by ID including invoice allocations and GL entry",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.paymentsReceivedService.findOne(id);
  }

  @Post()
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Record customer receipt (CONFIRMED automatically creates and posts GL journal)",
  })
  create(@Body() dto: CreatePaymentReceivedDto) {
    return this.paymentsReceivedService.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Update customer receipt metadata (referenceNumber, notes, customerName)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentReceivedDto,
  ) {
    return this.paymentsReceivedService.update(id, dto);
  }

  @Post(":id/confirm")
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Confirm a draft receipt and atomically post double-entry GL journal",
  })
  confirm(@Param("id", ParseIntPipe) id: number) {
    return this.paymentsReceivedService.confirm(id);
  }

  @Post(":id/void")
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Void a receipt (atomically creates GL reversal voucher and inverts account balances)",
  })
  void(@Param("id", ParseIntPipe) id: number) {
    return this.paymentsReceivedService.void(id);
  }

  @Post(":id/allocations")
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Allocate a portion of unallocated receipt balance to an invoice reference",
  })
  addAllocation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreatePaymentAllocationDto,
  ) {
    return this.paymentsReceivedService.addAllocation(id, dto);
  }

  @Delete(":id/allocations/:allocationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary:
      "Remove an invoice allocation and restore unallocated receipt balance",
  })
  async removeAllocation(
    @Param("id", ParseIntPipe) id: number,
    @Param("allocationId", ParseIntPipe) allocationId: number,
  ) {
    await this.paymentsReceivedService.removeAllocation(id, allocationId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("finance.payment_received.write")
  @ApiOperation({
    summary: "Soft delete a DRAFT or VOID customer receipt",
  })
  async delete(@Param("id", ParseIntPipe) id: number) {
    await this.paymentsReceivedService.delete(id);
  }
}
