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
import { CreateExpenseFromClaimDto } from "./dto/create-expense-from-claim.dto.js";
import { CreateExpenseDto } from "./dto/create-expense.dto.js";
import { QueryExpensesDto } from "./dto/query-expenses.dto.js";
import { RecordExpensePaymentDto } from "./dto/record-expense-payment.dto.js";
import { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import { ExpensesService } from "./expenses.service.js";

@ApiTags("finance-expenses")
@Controller("finance/expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermission("finance.expense.read")
  @ApiOperation({
    summary:
      "List operating expenses with pagination, category, date, and status filters",
  })
  findAll(@Paginate(QueryExpensesDto) query: QueryExpensesDto) {
    return this.expensesService.findAll(query);
  }

  @Get(":id")
  @RequirePermission("finance.expense.read")
  @ApiOperation({
    summary:
      "Get detailed expense record by ID with category and journal links",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @RequirePermission("finance.expense.write")
  @ApiOperation({
    summary: "Create an operating expense (DRAFT or immediate PAID)",
  })
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.expense.write")
  @ApiOperation({
    summary: "Update an editable expense record (DRAFT or PENDING_APPROVAL)",
  })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(id, dto);
  }

  @Post(":id/submit")
  @RequirePermission("finance.expense.write")
  @ApiOperation({ summary: "Submit a DRAFT expense for manager approval" })
  submit(@Param("id", ParseIntPipe) id: number) {
    return this.expensesService.submit(id);
  }

  @Post(":id/approve")
  @RequirePermission("finance.expense.write")
  @ApiOperation({ summary: "Approve a PENDING_APPROVAL expense" })
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.expensesService.approve(id);
  }

  @Post(":id/reject")
  @RequirePermission("finance.expense.write")
  @ApiOperation({ summary: "Reject a PENDING_APPROVAL expense back to DRAFT" })
  reject(@Param("id", ParseIntPipe) id: number) {
    return this.expensesService.reject(id);
  }

  @Post(":id/pay")
  @RequirePermission("finance.expense.write")
  @ApiOperation({
    summary:
      "Disburse payment for an expense and atomically post double-entry GL journal",
  })
  pay(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RecordExpensePaymentDto,
  ) {
    return this.expensesService.pay(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("finance.expense.write")
  @ApiOperation({
    summary:
      "Cancel an expense (atomically creates GL reversal voucher if already paid)",
  })
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.expensesService.cancel(id);
  }

  @Post("from-claim/:claimId")
  @RequirePermission("finance.expense.write")
  @ApiOperation({
    summary:
      "Convert an approved HR Expense Claim into a Finance operating expense",
  })
  createFromClaim(
    @Param("claimId", ParseIntPipe) claimId: number,
    @Body() dto: CreateExpenseFromClaimDto,
  ) {
    return this.expensesService.createFromClaim(claimId, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("finance.expense.write")
  @ApiOperation({ summary: "Soft delete a DRAFT or CANCELLED expense" })
  async delete(@Param("id", ParseIntPipe) id: number) {
    await this.expensesService.delete(id);
  }
}
